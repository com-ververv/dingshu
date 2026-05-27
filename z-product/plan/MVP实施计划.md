# Pexar Lark Agent MVP 实施计划

本文基于：

- `z-product/prd/PRD.md`
- `z-product/tech/技术选型.md`

执行规则：

1. 每个阶段完成后必须自测。
2. 自测通过后提交 Git。
3. 如果实现过程中发现计划或代码与 `技术选型.md` 不一致，先评估并更新 `技术选型.md`，再继续实现。
4. 敏感凭证不得进入 Git；开发期 `.env` 只作为本地调试来源，产品化阶段迁移到 `secure_settings + safeStorage`。

## 阶段 1：Agent 与工具基础层

目标：

- 从 `src/ipc/chat.ts` 拆出主进程 AI 和 lark 工具基础层。
- 保留当前 `streamText + tools + stopWhen` 路线，作为 M1 可运行路径。
- 定义统一工具事件，渲染进程可展示工具调用过程。
- 让 `lark_doc_search` 继续可用，并显示“正在搜索飞书文档 / 成功 / 失败”。

实现范围：

- 新增 `src/main/ai/` 或等价主进程目录：
  - provider
  - chat service
  - tool service
  - lark doc search tool
- IPC 增加工具事件：
  - `chat:tool-call-start`
  - `chat:tool-call-result`
- Renderer 增加工具调用折叠/状态展示。

验收：

- 普通聊天可流式输出。
- “帮我查看与测试相关的飞书文档”会调用 lark search。
- UI 能看到工具调用过程。
- `npm run lint`、`npm run package` 通过。

## 阶段 2：M1 S1 创建飞书云文档

目标：

- 跑通 PRD M1：聊天框完成 S1“创建飞书云文档”。

实现范围：

- 新增 `lark_doc_create` 工具。
- 写操作增加二次确认。
- UI 展示审批卡片：目标、标题、内容摘要、风险、确认/取消。
- 批准后调用 lark-cli 创建文档，返回文档链接。

验收：

- 连续 5 次真实创建文档成功。
- 拒绝审批时不创建文档，assistant 说明未执行。
- 停止生成时不会继续创建文档。

## 阶段 3：文档读取与搜索增强

目标：

- 完善 S3“搜索文档”，支持搜索后读取详情和总结。

实现范围：

- 强化 `lark_doc_search` 结果结构。
- 新增 `lark_doc_read` 工具。
- 支持“打开第一篇并总结”“读取这个飞书链接内容”。
- 工具结果做长度裁剪和脱敏。

验收：

- 能搜索文档、读取指定文档、基于正文总结。
- 无权限、无结果、链接无效有明确错误。

## 阶段 4：会话本地持久化

目标：

- 满足 PRD 会话管理。

实现范围：

- 新增数据库迁移：
  - `schema_migrations`
  - `conversations`
  - `messages`
  - `tool_calls`
- 保存聊天消息和工具调用事件。
- 侧边栏支持查看、恢复、删除会话。

验收：

- 重启应用后恢复最近会话。
- 删除会话后列表不再显示。
- 重新生成不破坏历史数据。

执行记录：

- 已完成数据库迁移 runner、`conversations` / `messages` / `tool_calls` / `secure_settings` 表和索引。
- 已完成聊天消息与工具事件落库、侧边栏会话列表、最近会话自动恢复、软删除会话。
- 已通过 `npm run lint`、`npx tsc --noEmit`、`npm run package`。
- 已通过应用启动后的 SQLite 表和迁移版本检查，确认迁移生效；已确认迁移 SQL 被打入 `app.asar`。

## 阶段 5：设置面板 MVP

目标：

- 满足 PRD 设置面板和未配置提示。

实现范围：

- SiliconFlow API Key 配置。
- 飞书 appId / appSecret 配置。
- 飞书授权入口。
- 凭证保存到 `secure_settings + safeStorage`。
- Renderer 只展示配置状态，不获取明文。

验收：

- 未配置时聊天区提示缺少配置。
- 保存凭证后可正常聊天和调用飞书工具。
- `safeStorage` 不可用时阻止保存。

执行记录：

- 已完成 `secure_settings + safeStorage` 凭证保存、配置状态 IPC 和设置面板 AI/Lark 配置页。
- 聊天主进程已优先从本地加密设置读取 SiliconFlow API Key，`.env` 只保留为开发 fallback。
- 已完成飞书 appId/appSecret 保存后初始化隔离 lark-cli profile；授权入口使用 `lark-cli auth login --no-wait --json` 设备码流程。
- 已通过 `npm run lint`、`npx tsc --noEmit`、`npm run package`。
- 已把本机 SiliconFlow API Key 写入本地 `secure_settings` 密文，并验证 safeStorage 解密匹配；应用可在不显式传入 `SILICONFLOW_API_KEY` 的情况下启动。

## 阶段 6：消息查询

目标：

- 覆盖 PRD S2“查询群消息”。

实现范围：

- 新增 `lark_message_search` 工具。
- 支持群名、关键词、时间范围。
- 输出引用来源和时间范围。

验收：

- “总结研发群今天的讨论”能查询并总结。
- 找不到群、无权限、无结果时有明确提示。

## 阶段 7：消息发送

目标：

- 覆盖 MVP 消息发送能力。

实现范围：

- 新增 `lark_message_send` 工具。
- 写操作二次确认。
- UI 展示发送目标和内容摘要。

验收：

- 批准后发送消息成功。
- 拒绝后不发送。
- 错误时不伪造成功。

## 阶段 8：内置 lark-cli 与打包资源

目标：

- 满足 PRD “内置 lark-cli，无需额外依赖”。

实现范围：

- 引入并锁定 `@larksuite/cli` 或 vendored 平台二进制。
- 开发、package、make 三种模式解析 lark-cli 路径。
- 打包校验 checksum。
- 子进程使用隔离 profile 目录。

验收：

- 干净机器无需全局安装 lark-cli 即可执行飞书工具。
- macOS / Windows 路径和权限验证通过。

## 阶段 9：MVP 发布验证

目标：

- 达到可发 MVP 包状态。

实现范围：

- macOS Apple Silicon / Intel。
- Windows 10/11。
- 网络错误、未授权、key 错误、lark-cli 异常。
- 签名、公证和自动更新回归。

验收：

- `npm run make` 成功。
- 打包产物中聊天、文档创建、文档搜索、消息查询可用。
- 已知风险记录在发布说明中。
