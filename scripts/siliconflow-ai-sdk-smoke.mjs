#!/usr/bin/env node
/* global console, process */

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText, stepCountIs, streamText, tool } from 'ai';
import { z } from 'zod';

const MODEL_ID = 'Pro/moonshotai/Kimi-K2.6';
const BASE_URL = 'https://api.siliconflow.cn/v1';
const apiKey = process.env.SILICONFLOW_API_KEY;
const mode = process.argv[2] ?? 'all';

if (mode === '--help' || mode === '-h') {
  console.log('Usage: SILICONFLOW_API_KEY=<key> npm run smoke:siliconflow -- [all|generate|stream|tool]');
  process.exit(0);
}

if (!apiKey) {
  console.error('Missing SILICONFLOW_API_KEY. Example: SILICONFLOW_API_KEY=<key> npm run smoke:siliconflow');
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
]);

async function main() {
  console.log(`model: ${MODEL_ID}`);
  console.log(`baseURL: ${BASE_URL}`);
  console.log(`mode: ${mode}`);

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
