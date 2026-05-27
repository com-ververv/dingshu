import { tool } from 'ai';
import type { ToolExecutionOptions } from 'ai';
import { z } from 'zod';
import { createApprovalId, waitForApproval } from '../approval';
import { previewJson, type ChatToolEventSink } from '../events';
import { classifyLarkCliError, getLarkCliBin, runLarkCli } from '../../lark/cli';
import { getLarkCapability, listLarkCapabilities } from '../../lark/capabilities';

const TOOL_NAME = 'lark_cli_shortcut';
const MAX_OUTPUT_PREVIEW_LENGTH = 6_000;

const stringLikeValue = z.union([z.string(), z.number(), z.boolean()]);

function normalizeFlagName(flag: string): string {
  return flag.replace(/^--/, '');
}

export function buildLarkShortcutFlagArgs(
  args: Record<string, string | number | boolean>,
  allowedFlags: readonly string[]
): string[] {
  const allowed = new Set(allowedFlags.map(normalizeFlagName));
  const result: string[] = [];

  for (const [rawName, value] of Object.entries(args)) {
    const name = normalizeFlagName(rawName);
    if (!allowed.has(name)) {
      throw new Error(`capability does not allow flag --${name}`);
    }
    if (value === false || value === undefined || value === null) {
      continue;
    }
    result.push(`--${name}`);
    if (value !== true) {
      result.push(String(value));
    }
  }

  return result;
}

function parseOutput(stdout: string): unknown {
  const text = stdout.trim();
  if (!text) {
    return { ok: true };
  }
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

function summarizeCapabilities(): string {
  return listLarkCapabilities()
    .map((capability) => `${capability.id}: ${capability.description}`)
    .join('\n');
}

export function createLarkCliShortcutTool(requestId: string, emitToolEvent: ChatToolEventSink) {
  return tool({
    description: `调用已登记的飞书 lark-cli shortcut。仅能使用 allowlist 能力，不能执行任意命令。已支持能力：\n${summarizeCapabilities()}`,
    inputSchema: z.object({
      args: z
        .record(z.string(), stringLikeValue)
        .optional()
        .describe('传给 shortcut 的参数对象，key 使用 flag 名称，不带或可带 --；value 为字符串、数字或布尔值。'),
      capability: z.string().describe('能力 ID，例如 calendar_agenda、task_get_my_tasks、sheets_read。'),
      reason: z.string().optional().describe('为什么需要调用这个飞书能力，用于审批和工具过程展示。'),
    }),
    execute: async ({ args = {}, capability: capabilityId, reason }, options: ToolExecutionOptions) => {
      const startedAt = Date.now();
      const capability = getLarkCapability(capabilityId);

      if (!capability) {
        const output = {
          ok: false,
          error: `Unsupported lark capability: ${capabilityId}`,
          supportedCapabilities: listLarkCapabilities().map((item) => item.id),
        };
        emitToolEvent({
          requestId,
          type: 'tool-call-result',
          toolCallId: options.toolCallId,
          toolName: TOOL_NAME,
          status: 'failed',
          outputPreview: previewJson(output),
          errorMessage: output.error,
          elapsedMs: Date.now() - startedAt,
        });
        return output;
      }

      let shortcutArgs: string[];
      try {
        shortcutArgs = buildLarkShortcutFlagArgs(args, capability.allowedFlags);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const output = {
          ok: false,
          capability: capability.id,
          error: message,
        };
        emitToolEvent({
          requestId,
          type: 'tool-call-result',
          toolCallId: options.toolCallId,
          toolName: TOOL_NAME,
          status: 'failed',
          outputPreview: previewJson(output),
          errorMessage: message,
          elapsedMs: Date.now() - startedAt,
        });
        return output;
      }

      const commandArgs = [
        capability.domain,
        capability.shortcut,
        '--as',
        capability.identity === 'auto' ? 'user' : capability.identity,
        ...shortcutArgs,
      ];
      if (capability.supportsFormat !== false) {
        commandArgs.push('--format', 'json');
      }
      const input = {
        capability: capability.id,
        command: `lark-cli ${commandArgs.join(' ')}`,
        description: capability.description,
        reason,
        risk: capability.risk,
      };
      const inputPreview = previewJson(input);

      if (capability.risk === 'write') {
        const approvalId = createApprovalId(TOOL_NAME, options.toolCallId);
        emitToolEvent({
          requestId,
          type: 'tool-call-confirmation-required',
          approvalId,
          toolCallId: options.toolCallId,
          toolName: TOOL_NAME,
          action: capability.description,
          riskSummary: '这会修改飞书数据，执行前需要确认。',
          targetPreview: capability.id,
          inputPreview,
        });

        const decision = await waitForApproval(
          {
            approvalId,
            inputPreview,
            riskSummary: '这会修改飞书数据，执行前需要确认。',
            targetPreview: capability.id,
            toolCallId: options.toolCallId,
            toolName: TOOL_NAME,
          },
          options.abortSignal
        );

        if (!decision.approved) {
          const output = {
            ok: false,
            denied: true,
            reason: decision.reason ?? '用户拒绝执行',
          };
          emitToolEvent({
            requestId,
            type: 'tool-call-result',
            toolCallId: options.toolCallId,
            toolName: TOOL_NAME,
            status: 'cancelled',
            outputPreview: previewJson(output),
            elapsedMs: Date.now() - startedAt,
          });
          return output;
        }
      }

      emitToolEvent({
        requestId,
        type: 'tool-call-start',
        toolCallId: options.toolCallId,
        toolName: TOOL_NAME,
        inputPreview,
      });

      try {
        const result = await runLarkCli(commandArgs, {
          timeoutMs: capability.timeoutMs,
          abortSignal: options.abortSignal,
        });

        if (result.exitCode === null) {
          const output = {
            ok: false,
            cancelled: true,
            capability: capability.id,
            executable: getLarkCliBin(),
          };
          emitToolEvent({
            requestId,
            type: 'tool-call-result',
            toolCallId: options.toolCallId,
            toolName: TOOL_NAME,
            status: 'cancelled',
            outputPreview: previewJson(output),
            elapsedMs: Date.now() - startedAt,
          });
          return output;
        }

        if (result.exitCode !== 0) {
          const rawError = result.stderr || result.stdout || 'lark-cli failed without output';
          const output = {
            ok: false,
            capability: capability.id,
            executable: getLarkCliBin(),
            exitCode: result.exitCode,
            error: previewJson(rawError),
            errorType: classifyLarkCliError(rawError),
          };
          emitToolEvent({
            requestId,
            type: 'tool-call-result',
            toolCallId: options.toolCallId,
            toolName: TOOL_NAME,
            status: 'failed',
            outputPreview: previewJson(output),
            errorMessage: output.error,
            elapsedMs: Date.now() - startedAt,
          });
          return output;
        }

        const parsed = parseOutput(result.stdout);
        const output = {
          ok: true,
          capability: capability.id,
          executable: getLarkCliBin(),
          data: parsed,
          stderr: result.stderr.trim() ? previewJson(result.stderr, 1_000) : undefined,
        };
        emitToolEvent({
          requestId,
          type: 'tool-call-result',
          toolCallId: options.toolCallId,
          toolName: TOOL_NAME,
          status: 'completed',
          outputPreview: previewJson(output, MAX_OUTPUT_PREVIEW_LENGTH),
          elapsedMs: Date.now() - startedAt,
        });
        return output;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        emitToolEvent({
          requestId,
          type: 'tool-call-result',
          toolCallId: options.toolCallId,
          toolName: TOOL_NAME,
          status: 'failed',
          errorMessage: message,
          elapsedMs: Date.now() - startedAt,
        });
        throw error;
      }
    },
  });
}
