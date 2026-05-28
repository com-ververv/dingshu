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
type ShortcutArgs = Record<string, string | number | boolean>;

function normalizeFlagName(flag: string): string {
  return flag.replace(/^--/, '');
}

export function buildLarkShortcutFlagArgs(
  args: ShortcutArgs,
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

function hasShortcutArgs(args: ShortcutArgs): boolean {
  return Object.keys(args).length > 0;
}

function coerceShortcutArgs(value: unknown): ShortcutArgs | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const result: ShortcutArgs = {};
  for (const [key, rawValue] of Object.entries(value)) {
    if (typeof rawValue === 'string' || typeof rawValue === 'number' || typeof rawValue === 'boolean') {
      result[key] = rawValue;
    }
  }

  return hasShortcutArgs(result) ? result : undefined;
}

function findJsonObjectSnippets(text: string): string[] {
  const snippets: string[] = [];

  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== '{') {
      continue;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
      const char = text[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (inString) {
        continue;
      }
      if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          snippets.push(text.slice(start, index + 1));
          break;
        }
      }
    }
  }

  return snippets;
}

function maybeUnescapeJsonText(text: string): string {
  return text.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
}

function parseArgsFromJsonSnippet(snippet: string, capabilityId: string): ShortcutArgs | undefined {
  try {
    const parsed = JSON.parse(snippet) as { args?: unknown; capability?: unknown };
    const parsedCapability = typeof parsed.capability === 'string' ? parsed.capability : undefined;
    if (parsedCapability && parsedCapability !== capabilityId) {
      return undefined;
    }
    return coerceShortcutArgs(parsed.args);
  } catch {
    return undefined;
  }
}

function extractArgsObjectAfterLabel(text: string): ShortcutArgs | undefined {
  const labelMatch = /(?:^|[\s,{])args\s*[:=]\s*\{/i.exec(text);
  if (!labelMatch) {
    return undefined;
  }

  const objectStart = labelMatch.index + labelMatch[0].lastIndexOf('{');
  const [snippet] = findJsonObjectSnippets(text.slice(objectStart));
  if (!snippet) {
    return undefined;
  }

  try {
    return coerceShortcutArgs(JSON.parse(snippet));
  } catch {
    return undefined;
  }
}

function extractQuotedText(text: string): string | undefined {
  const match = /[「“"']([^」”"']{1,80})[」”"']/.exec(text);
  return match?.[1]?.trim();
}

function extractContactSearchQuery(reason: string): string | undefined {
  const quoted = extractQuotedText(reason);
  if (quoted) {
    return quoted;
  }

  const patterns = [
    /(?:查询|查找|搜索)\s*(?:用户|联系人|同事)?\s*([^\s，。,.、]{1,40})\s*(?:的)?\s*(?:邮箱|邮件|email|Email|EMAIL)/,
    /(?:邮箱|邮件|email|Email|EMAIL).*?(?:用户|联系人|同事)?\s*([^\s，。,.、]{1,40})/,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(reason);
    const query = match?.[1]?.trim();
    if (query) {
      return query;
    }
  }

  return undefined;
}

function extractChatId(reason: string): string | undefined {
  return /\boc_[A-Za-z0-9]+\b/.exec(reason)?.[0];
}

function inferShortcutArgsFromReason(capabilityId: string, reason: string): ShortcutArgs | undefined {
  if (capabilityId === 'contact_search_user') {
    const query = extractContactSearchQuery(reason);
    return query ? { query } : undefined;
  }

  if (capabilityId === 'im_chat_messages_list') {
    const chatId = extractChatId(reason);
    return chatId ? { 'chat-id': chatId, 'page-size': 20 } : undefined;
  }

  return undefined;
}

export function normalizeLarkShortcutArgs(
  args: ShortcutArgs,
  capabilityId: string,
  reason?: string
): { args: ShortcutArgs; recoveredFromReason: boolean } {
  if (hasShortcutArgs(args) || !reason) {
    return { args, recoveredFromReason: false };
  }

  const candidates = Array.from(new Set([reason, maybeUnescapeJsonText(reason)]));
  for (const candidate of candidates) {
    for (const snippet of findJsonObjectSnippets(candidate)) {
      const recoveredArgs = parseArgsFromJsonSnippet(snippet, capabilityId);
      if (recoveredArgs) {
        return { args: recoveredArgs, recoveredFromReason: true };
      }
    }

    const recoveredArgs = extractArgsObjectAfterLabel(candidate);
    if (recoveredArgs) {
      return { args: recoveredArgs, recoveredFromReason: true };
    }
  }

  const inferredArgs = inferShortcutArgsFromReason(capabilityId, reason);
  if (inferredArgs) {
    return { args: inferredArgs, recoveredFromReason: true };
  }

  return { args, recoveredFromReason: false };
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
        .default({})
        .describe(
          '传给 shortcut 的结构化参数对象，必须作为 args 字段传入，不能写进 reason。key 使用 flag 名称，不带或可带 --；value 为字符串、数字或布尔值。例如 {"chat-id":"oc_xxx","page-size":20}。'
        ),
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
      const normalized = normalizeLarkShortcutArgs(args, capabilityId, reason);
      try {
        shortcutArgs = buildLarkShortcutFlagArgs(normalized.args, capability.allowedFlags);
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
        args: normalized.args,
        capability: capability.id,
        command: `lark-cli ${commandArgs.join(' ')}`,
        description: capability.description,
        recoveredArgsFromReason: normalized.recoveredFromReason || undefined,
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
