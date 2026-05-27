# Pexar Lark Agent MVP 实施计划 2：扩展 lark-cli 能力

本文基于：

- `z-product/prd/PRD.md`
- `z-product/tech/技术选型.md`
- `lark-cli --help`
- 本机已安装的 `lark-*` skills
- 已完成的 `z-product/plan/MVP实施计划.md`

执行规则：

1. 每个阶段完成后必须自测。
2. 自测通过后提交 Git。
3. 如果实现与 `z-product/tech/技术选型.md` 不一致，先修改技术方案再继续实现。
4. 不实现通用 shell 或任意 lark-cli 代理；所有能力必须进入显式 allowlist。
5. 写操作、删除操作、外发消息、外发邮件、权限变更、文件覆盖必须二次确认。
6. 真实写入测试优先使用测试资源；无法在当前环境安全验证的能力，至少完成 dry-run / help / schema / 参数构造测试并记录风险。

## 1. 当前已覆盖能力

应用已有独立 Agent 工具：

| 工具 | 覆盖 lark-cli 能力 | 风险级别 |
|------|--------------------|----------|
| `lark_doc_search` | `docs +search` | 只读 |
| `lark_doc_read` | `docs +fetch` | 只读 |
| `lark_doc_create` | `docs +create` | 写入，已审批 |
| `lark_message_search` | `im +messages-search` / `im +chat-search` | 只读 |
| `lark_message_send` | `im +messages-send` | 外发，已审批 |

这些工具保留为高频专用工具，不被计划 2 删除。

## 2. lark-cli 能力盘点

`lark-cli` 顶层领域包括：

- 协作基础：`contact`、`calendar`、`task`、`im`
- 文档与文件：`docs`、`drive`、`wiki`、`sheets`、`slides`、`markdown`、`whiteboard`
- 业务数据：`base`
- 沟通与会议：`mail`、`minutes`、`vc`
- 企业流程：`approval`、`attendance`、`okr`
- CLI 管理：`auth`、`config`、`profile`、`doctor`、`schema`、`api`、`event`、`update`

MVP 不开放：

- `api` 通用原生 API 调用。
- `config` / `profile` / `update` 修改 CLI 全局状态。
- `auth` 授权流程以现有设置页为准，不作为 Agent 工具开放。
- `event` 长连接监听暂不进入聊天工具，避免后台生命周期复杂化。
- 高风险删除类命令默认不开放，除非后续有明确业务场景。

## 3. 阶段 10：受控 lark-cli shortcut 工具骨架

目标：

- 新增一个通用但受控的 Agent 工具 `lark_cli_shortcut`。
- 用代码内 capability registry 显式登记可用 shortcut、参数、读写风险、超时和输出裁剪策略。
- 先覆盖只读和低风险查询能力，让 Agent 能回答更多飞书问题。

实现范围：

- 新增 `src/main/lark/capabilities.ts`：
  - capability id
  - domain / shortcut
  - allowed flags
  - identity
  - risk level
  - timeout
  - description
- 新增 `src/main/ai/tools/larkCliShortcut.ts`：
  - 输入 `capability`、`args`、`reason`
  - 按 registry 构造 `lark-cli <domain> <shortcut>`
  - 只允许 allowlist flag
  - 只读能力直接执行
  - 写能力发起审批
  - 输出统一 JSON 解析、裁剪、脱敏
- ChatService 注入 `lark_cli_shortcut`。
- system prompt 补充：高频专用工具优先，其余飞书能力使用 `lark_cli_shortcut`。

首批只读 capability：

| capability | lark-cli |
|------------|----------|
| `contact_search_user` | `contact +search-user` |
| `contact_get_user` | `contact +get-user` |
| `calendar_agenda` | `calendar +agenda` |
| `calendar_freebusy` | `calendar +freebusy` |
| `calendar_suggestion` | `calendar +suggestion` |
| `im_chat_list` | `im +chat-list` |
| `im_chat_messages_list` | `im +chat-messages-list` |
| `im_messages_mget` | `im +messages-mget` |
| `im_threads_messages_list` | `im +threads-messages-list` |
| `drive_search` | `drive +search` |
| `drive_export` | `drive +export` |
| `wiki_space_list` | `wiki +space-list` |
| `wiki_node_list` | `wiki +node-list` |
| `sheets_info` | `sheets +info` |
| `sheets_read` | `sheets +read` |
| `sheets_find` | `sheets +find` |
| `mail_triage` | `mail +triage` |
| `mail_message` | `mail +message` |
| `mail_thread` | `mail +thread` |
| `minutes_search` | `minutes +search` |
| `vc_search` | `vc +search` |
| `vc_notes` | `vc +notes` |
| `task_search` | `task +search` |
| `task_get_my_tasks` | `task +get-my-tasks` |
| `task_get_related_tasks` | `task +get-related-tasks` |
| `okr_cycle_list` | `okr +cycle-list` |
| `okr_cycle_detail` | `okr +cycle-detail` |

验收：

- `npm run lint` 通过。
- `npx tsc --noEmit` 通过。
- 至少真实执行 5 个只读 capability：
  - 联系人搜索
  - 今日日程
  - 任务列表
  - 表格 info 或 read
  - 会议 / 消息 / 文档类查询之一
- Agent 能在聊天中调用 `lark_cli_shortcut` 并基于真实结果回答。

执行记录：

- 已新增 `src/main/lark/capabilities.ts`，登记首批只读 capability，并声明 domain、shortcut、identity、risk、timeout、allowed flags。
- 已新增 `lark_cli_shortcut` Agent 工具，按 capability registry 构造 `lark-cli` 参数数组，拒绝未登记 capability 和越权 flag。
- 已接入 ChatService；高频文档/消息工具继续优先使用专用工具，低频联系人、日程、任务、邮箱、会议、表格、知识库等能力走 `lark_cli_shortcut`。
- 已新增 `larkCliShortcut.test.ts`，覆盖参数构造、布尔 flag、越权 flag 拒绝和 `sheets` 不追加 `--format` 的特殊情况。
- 已通过 `npm run test -- --run src/main/ai/tools/larkCliShortcut.test.ts`、`npm run lint`、`npx tsc --noEmit`。
- 已通过 `npm run smoke:siliconflow -- generate`，确认充值后 Kimi-K2.6 可正常生成。
- 已真实验证 7 个只读 capability 返回 `ok = true`：`contact_search_user`、`calendar_agenda`、`task_get_my_tasks`、`wiki_space_list`、`drive_search`、`im_chat_list`、`vc_search`。
- `minutes_search` 已真实调用但当前授权缺少 `minutes:minutes.search:read` scope，CLI 返回 `missing_scope`，属于授权范围问题，后续设置页需要提示补授权。

## 4. 阶段 11：写操作与审批扩展

目标：

- 让 Agent 能处理更多“创建 / 更新 / 评论 / 草稿”类飞书任务。
- 所有写操作统一使用审批卡片，拒绝时不执行。

新增 capability：

| capability | lark-cli | 风险 |
|------------|----------|------|
| `calendar_create` | `calendar +create` | 创建日程 |
| `calendar_update` | `calendar +update` | 修改日程 |
| `calendar_rsvp` | `calendar +rsvp` | 代表用户回复日程 |
| `task_create` | `task +create` | 创建任务 |
| `task_update` | `task +update` | 修改任务 |
| `task_complete` | `task +complete` | 完成任务 |
| `task_comment` | `task +comment` | 添加任务评论 |
| `docs_update` | `docs +update` | 更新文档 |
| `drive_add_comment` | `drive +add-comment` | 文档评论 |
| `sheets_append` | `sheets +append` | 追加表格数据 |
| `sheets_write` | `sheets +write` | 覆盖单元格 |
| `mail_draft_create` | `mail +draft-create` | 创建草稿 |
| `mail_reply` | `mail +reply` | 默认草稿；发送必须显式审批 |
| `mail_forward` | `mail +forward` | 默认草稿；发送必须显式审批 |

暂不开放：

- 删除、移动、权限变更、版本回滚。
- 直接发送邮件的 `--confirm-send`，除非后续有单独审批设计。
- `base` 高风险结构变更，如字段删除、表删除、权限角色变更。

验收：

- 拒绝审批不会产生副作用。
- 至少真实创建 1 个安全测试资源：任务、草稿或文档评论三选一。
- 错误路径不伪造成功。

执行记录：

- 已在 capability registry 中新增阶段 11 写能力：日程创建/更新/RSVP、任务创建/更新/完成/评论、文档更新、文档评论、表格追加/覆盖写入、邮件草稿/回复草稿/转发草稿。
- 写能力统一声明 `risk = write`，执行前进入 `lark_cli_shortcut` 审批流程。
- 邮件相关能力未开放 `--confirm-send`，只能创建草稿，不能由 Agent 直接发送邮件。
- 已新增单测覆盖写能力 allowlist、`dry-run` flag 构造，以及邮件 `confirm-send` 越权 flag 拒绝。
- 已通过 `npm run test -- --run src/main/ai/tools/larkCliShortcut.test.ts`、`npm run lint`、`npx tsc --noEmit`。
- 已真实创建测试任务成功：`Codex Stage11 Test Task 2026-05-27T17-15-06-232Z`，返回 `guid = 8cf64367-971b-484e-b544-bbf5cfe2aca1`。

## 5. 阶段 12：文件、表格和多维表格增强

目标：

- 覆盖产品使用中常见的文件上传下载、表格读取写入、多维表格查询。
- 对本地文件路径做限制和校验，避免模型任意读取用户文件。

实现范围：

- 允许用户在 UI 明确选择文件后，工具只可使用已授权路径。
- 新增或登记能力：
  - `drive_upload`
  - `drive_download`
  - `drive_import`
  - `drive_export_download`
  - `sheets_create`
  - `sheets_create_sheet`
  - `sheets_export`
  - `base_table_list`
  - `base_field_list`
  - `base_record_search`
  - `base_record_list`
  - `base_data_query`
  - `base_record_upsert`
- `base_record_upsert`、上传、导入、覆盖下载全部需要审批。

验收：

- 只读 Base 查询可用。
- 表格读取 / 查找可用。
- 文件下载只能写入应用工作目录或用户明确选择的路径。

执行记录：

- 已登记文件、表格和 Base 能力：`drive_upload`、`drive_download`、`drive_import`、`drive_export_download`、`sheets_create`、`sheets_create_sheet`、`sheets_export`、`base_table_list`、`base_field_list`、`base_record_search`、`base_record_list`、`base_data_query`、`base_record_upsert`。
- 本地文件上传、导入、下载、导出下载、表格导出统一标记为 `risk = write`，需要审批；后续 UI 文件选择完成前，真实执行必须由用户明确确认路径。
- Base 读取能力标记为只读；`base_record_upsert` 标记为写入并需要审批。
- 已新增单测覆盖文件/Base 能力风险等级、Base 查询参数构造和越权文件路径 flag 拒绝。
- 已通过 `npm run test -- --run src/main/ai/tools/larkCliShortcut.test.ts`、`npm run lint`、`npx tsc --noEmit`。
- 已用 `--dry-run` 验证 `drive +upload`、`sheets +create`、`base +record-list`、`base +record-upsert` 参数构造，均只输出 dry-run 请求，不产生副作用。

## 6. 阶段 13：能力发现、错误提示与测试矩阵

目标：

- 用户能知道当前 Agent 支持哪些飞书能力。
- 工具失败时能给出“缺少授权 / 缺少参数 / 无权限 / CLI 异常”的明确提示。

实现范围：

- 新增只读工具或 IPC：列出当前 allowlist capability。
- 设置页展示 lark-cli 版本、路径、profile 状态、已登记能力数量。
- 对 stderr 做分类：
  - auth
  - permission
  - missing_argument
  - not_found
  - network
  - timeout
  - unknown
- 增加脚本级 smoke：
  - capability registry 参数构造测试
  - allowlist 拒绝未知 capability
  - 写操作审批拒绝测试

验收：

- `npm run lint`、`npx tsc --noEmit`、`npm run package` 通过。
- `npm run smoke:siliconflow -- generate` 通过。
- 至少 8 个真实只读 capability 验证通过或记录权限失败原因。

## 7. 阶段 14：发布验证与技术方案同步

目标：

- 确保扩展能力与技术方案一致，并达到可验收状态。

实现范围：

- 更新 `z-product/tech/技术选型.md`：
  - 补充 `lark_cli_shortcut` allowlist 架构。
  - 补充能力分级和审批策略。
  - 补充暂不开放通用 `lark-cli api` 的原因。
- 更新本计划执行记录。
- 打包验证 bundled lark-cli 仍可执行。

验收：

- `npm run make` 通过。
- 打包产物内 `lark-cli --version` 可执行。
- 执行记录写入本文。
