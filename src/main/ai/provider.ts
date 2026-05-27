import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export const SILICONFLOW_MODEL_ID = 'Pro/moonshotai/Kimi-K2.6';
export const SILICONFLOW_BASE_URL = 'https://api.siliconflow.cn/v1';

export function createSiliconFlowProvider(apiKey: string) {
  return createOpenAICompatible({
    name: 'siliconflow',
    apiKey,
    baseURL: SILICONFLOW_BASE_URL,
  });
}
