import { stepCountIs, streamText } from 'ai';
import type { ChatToolEventSink } from './events';
import { createSiliconFlowProvider, SILICONFLOW_MODEL_ID } from './provider';
import { createLarkDocCreateTool } from './tools/larkDocCreate';
import { createLarkDocReadTool } from './tools/larkDocRead';
import { createLarkDocSearchTool } from './tools/larkDocSearch';
import { createLarkMessageSearchTool } from './tools/larkMessageSearch';
import { createLarkMessageSendTool } from './tools/larkMessageSend';

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type StreamChatOptions = {
  abortSignal: AbortSignal;
  apiKey: string;
  emitToolEvent: ChatToolEventSink;
  messages: ChatMessage[];
  requestId: string;
};

export function streamChat(options: StreamChatOptions) {
  const siliconflow = createSiliconFlowProvider(options.apiKey);

  return streamText({
    model: siliconflow.chatModel(SILICONFLOW_MODEL_ID),
    system:
      '你是 Pexar Lark Agent 的桌面聊天助手。默认用中文回答，回答要简洁、具体、可执行。用户要求查看、查找、搜索飞书文档或测试相关资料时，必须先调用 lark_doc_search 工具，再基于工具结果回答；用户要求读取、打开、总结某个飞书文档链接或 token 时，必须调用 lark_doc_read 工具；用户要求创建、生成、保存飞书云文档时，必须先整理标题和 Markdown 正文，然后调用 lark_doc_create 工具；用户要求查询、搜索、总结群消息、聊天记录、某群今天讨论时，必须调用 lark_message_search 工具，并在回答中说明查询范围、来源和无结果情况；用户要求发送、通知、转发消息到飞书群时，必须先整理目标群和消息正文，然后调用 lark_message_send 工具，默认使用 bot 身份发送；不要声称自己无法访问飞书，除非工具返回失败。',
    messages: options.messages,
    temperature: 0.4,
    maxOutputTokens: 2048,
    stopWhen: stepCountIs(4),
    toolChoice: 'auto',
    tools: {
      lark_doc_create: createLarkDocCreateTool(options.requestId, options.emitToolEvent),
      lark_doc_read: createLarkDocReadTool(options.requestId, options.emitToolEvent),
      lark_doc_search: createLarkDocSearchTool(options.requestId, options.emitToolEvent),
      lark_message_search: createLarkMessageSearchTool(options.requestId, options.emitToolEvent),
      lark_message_send: createLarkMessageSendTool(options.requestId, options.emitToolEvent),
    },
    abortSignal: options.abortSignal,
  });
}
