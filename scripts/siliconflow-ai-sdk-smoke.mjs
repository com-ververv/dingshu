#!/usr/bin/env node
/* global clearTimeout, console, process, setTimeout */

import 'dotenv/config';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText, stepCountIs, streamText, tool } from 'ai';
import { spawn } from 'node:child_process';
import { z } from 'zod';

const MODEL_ID = 'Pro/moonshotai/Kimi-K2.6';
const BASE_URL = 'https://api.siliconflow.cn/v1';
const LARK_CLI_BIN = process.env.LARK_CLI_BIN ?? 'lark-cli';
const apiKey = process.env.SILICONFLOW_API_KEY;
const mode = process.argv[2] ?? 'all';

if (mode === '--help' || mode === '-h') {
  console.log('Usage: npm run smoke:siliconflow -- [all|generate|stream|tool|lark]');
  console.log('Reads SILICONFLOW_API_KEY from .env or the current shell environment.');
  console.log('Optional: LARK_CLI_BIN=/path/to/lark-cli');
  process.exit(0);
}

if (!apiKey) {
  console.error('Missing SILICONFLOW_API_KEY. Add it to .env or export it in the current shell.');
  process.exit(1);
}

const siliconflow = createOpenAICompatible({
  name: 'siliconflow',
  apiKey,
  baseURL: BASE_URL,
});

const model = siliconflow.chatModel(MODEL_ID);

const logSection = (title) => {
  console.log(`\n=== ${title} ===`);
};

const printUsage = (usage) => {
  if (!usage) {
    console.log('usage: <not returned>');
    return;
  }

  console.log('usage:', JSON.stringify(usage));
};

async function runGenerateSmoke() {
  logSection('generateText');

  const startedAt = Date.now();
  const result = await generateText({
    model,
    system: '你是一个简洁的中文技术助手。',
    prompt: '请只回复一句话：Vercel AI SDK 调用 Kimi-K2.6 成功。',
    temperature: 0,
    maxOutputTokens: 64,
  });

  console.log('text:', result.text.trim());
  console.log('finishReason:', result.finishReason);
  printUsage(result.usage);
  console.log('elapsedMs:', Date.now() - startedAt);
}

async function runStreamSmoke() {
  logSection('streamText');

  const startedAt = Date.now();
  let firstTextDeltaAt = null;
  let text = '';

  const result = streamText({
    model,
    system: '你是一个简洁的中文技术助手。',
    prompt: '用一句中文回答：AI SDK 流式输出是否正常？',
    temperature: 0,
    maxOutputTokens: 96,
  });

  process.stdout.write('textStream: ');
  for await (const delta of result.textStream) {
    if (firstTextDeltaAt === null) {
      firstTextDeltaAt = Date.now();
    }
    text += delta;
    process.stdout.write(delta);
  }
  process.stdout.write('\n');

  const finishReason = await result.finishReason;
  const usage = await result.usage;

  console.log('textLength:', text.length);
  console.log('firstTextDeltaMs:', firstTextDeltaAt === null ? '<none>' : firstTextDeltaAt - startedAt);
  console.log('finishReason:', finishReason);
  printUsage(usage);
  console.log('elapsedMs:', Date.now() - startedAt);
}

async function runToolSmoke() {
  logSection('tool calling');

  const startedAt = Date.now();
  const weatherTool = tool({
    description: '查询指定城市的天气。用户询问天气时必须调用此工具。',
    inputSchema: z.object({
      city: z.string().describe('城市名称，例如上海'),
    }),
    execute: async ({ city }) => {
      console.log(`tool:get_weather input: ${JSON.stringify({ city })}`);
      return {
        city,
        weather: '晴',
        temperatureCelsius: 24,
        source: 'local-smoke-demo',
      };
    },
  });

  const result = await generateText({
    model,
    system: '你是工具调用测试助手。用户询问天气时必须调用 get_weather，然后基于工具结果回答。',
    prompt: '查一下上海今天的天气，并用一句话回答。',
    temperature: 0,
    maxOutputTokens: 256,
    stopWhen: stepCountIs(3),
    tools: {
      get_weather: weatherTool,
    },
  });

  console.log('text:', result.text.trim());
  console.log('finishReason:', result.finishReason);
  console.log('steps:', result.steps?.length ?? 0);
  console.log('toolCalls:', JSON.stringify(collectToolCalls(result)));
  printUsage(result.usage);
  console.log('elapsedMs:', Date.now() - startedAt);
}

async function runLarkCliSmoke() {
  logSection('AI SDK tool -> lark-cli');

  const startedAt = Date.now();
  const larkCliTool = tool({
    description: 'Run a safe lark-cli read-only smoke command. Use this to verify local lark-cli and read access.',
    inputSchema: z.object({
      command: z.enum(['version', 'doctor_offline', 'docs_search']).describe('Safe lark-cli command to run'),
      query: z.string().optional().describe('Search keyword for docs_search'),
    }),
    execute: async ({ command, query }) => {
      const args = getLarkCliArgs(command, query);
      const result = await runLarkCli(args, {
        timeoutMs: command === 'docs_search' ? 30_000 : 15_000,
      });

      console.log(`tool:lark_cli_smoke command: ${command}`);
      console.log(`tool:lark_cli_smoke exitCode: ${result.exitCode}`);

      return {
        command,
        executable: LARK_CLI_BIN,
        exitCode: result.exitCode,
        stdout: truncate(result.stdout, 4_000),
        stderr: truncate(result.stderr, 2_000),
      };
    },
  });

  const result = await generateText({
    model,
    system:
      '你是本地集成测试助手。用户要求验证 lark-cli 或飞书读取能力时，必须调用 lark_cli_smoke 工具，然后用中文简要总结结果。不要编造工具输出之外的内容。',
    prompt: '验证是否能从飞书读取内容。请搜索“测试”，并总结返回了多少条结果以及第一条标题。',
    temperature: 0,
    maxOutputTokens: 256,
    stopWhen: stepCountIs(3),
    tools: {
      lark_cli_smoke: larkCliTool,
    },
  });

  console.log('text:', result.text.trim());
  console.log('finishReason:', result.finishReason);
  console.log('steps:', result.steps?.length ?? 0);
  console.log('toolCalls:', JSON.stringify(collectToolCalls(result)));
  printUsage(result.usage);
  console.log('elapsedMs:', Date.now() - startedAt);
}

function getLarkCliArgs(command, query) {
  if (command === 'version') {
    return ['--version'];
  }
  if (command === 'doctor_offline') {
    return ['doctor', '--offline'];
  }
  return ['docs', '+search', '--as', 'user', '--query', query || '测试', '--page-size', '3', '--format', 'json'];
}

function runLarkCli(args, { timeoutMs }) {
  return new Promise((resolve, reject) => {
    const child = spawn(LARK_CLI_BIN, args, {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NO_COLOR: '1',
      },
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill('SIGTERM');
      reject(new Error(`lark-cli timed out after ${timeoutMs}ms: ${LARK_CLI_BIN} ${args.join(' ')}`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (exitCode, signal) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      resolve({
        exitCode,
        signal,
        stdout,
        stderr,
      });
    });
  });
}

function truncate(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...<truncated>` : value;
}

function collectToolCalls(result) {
  const calls = [];
  for (const step of result.steps ?? []) {
    for (const call of step.toolCalls ?? []) {
      calls.push({
        toolName: call.toolName,
        input: call.input,
      });
    }
  }
  return calls;
}

const modes = new Map([
  ['generate', runGenerateSmoke],
  ['stream', runStreamSmoke],
  ['tool', runToolSmoke],
  ['lark', runLarkCliSmoke],
]);

async function main() {
  console.log(`model: ${MODEL_ID}`);
  console.log(`baseURL: ${BASE_URL}`);
  console.log(`mode: ${mode}`);
  if (mode === 'lark') {
    console.log(`larkCliBin: ${LARK_CLI_BIN}`);
  }

  if (mode === 'all') {
    for (const run of modes.values()) {
      await run();
    }
    return;
  }

  const run = modes.get(mode);
  if (!run) {
    console.error(`Unknown mode: ${mode}. Use one of: all, ${[...modes.keys()].join(', ')}`);
    process.exit(1);
  }

  await run();
}

main().catch((error) => {
  console.error('\nSmoke demo failed.');
  if (error instanceof Error) {
    console.error(error.stack ?? error.message);
  } else {
    console.error(error);
  }
  process.exit(1);
});
