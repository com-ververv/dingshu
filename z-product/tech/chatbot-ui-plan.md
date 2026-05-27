# Chatbot UI 第一版执行计划

## 目标

实现一个最小可验收的 Electron Chatbot 界面，验证：

- Renderer 能通过 preload 暴露的 IPC API 发起聊天请求。
- Main Process 能用 Vercel AI SDK `streamText` 调用 SiliconFlow `Pro/moonshotai/Kimi-K2.6`。
- Assistant 内容能流式显示。
- 用户能停止生成。
- API Key 只在主进程读取，不暴露给 Renderer。

## 第一版范围

- 替换当前 welcome 页面为聊天界面，保留 header 和设置入口。
- Renderer 自维护极薄消息状态机，不先接 `useChat`。
- Main Process 新增：
  - `chat:send`
  - `chat:stop`
  - `chat:delta`
  - `chat:done`
  - `chat:error`
- 模型固定 `Pro/moonshotai/Kimi-K2.6`。
- API Key 暂时从 `process.env.SILICONFLOW_API_KEY` 读取。
- 使用 `streamText` 的 `textStream`，先只渲染文本。

## 暂不做

- 本地 HTTP `/api/chat`。
- 自定义 `IpcChatTransport + useChat`。
- AI Elements 全量迁移。
- 会话持久化和侧边栏。
- lark-cli 工具调用 UI。
- 工具审批和恢复。
- Markdown/Reasoning/Tool parts 完整渲染。

## 验收

- `SILICONFLOW_API_KEY=<key> npm run dev` 启动后可发送一条消息并看到流式回复。
- 停止按钮可中断生成。
- 缺失 API Key 时 UI 显示可操作错误。
- `npm run lint` 通过。
