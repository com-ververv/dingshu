# Pexar Lark Agent UI/UX 借鉴决策

参考来源：

- `ai-sdk/chatbot`：`/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot`
- `CodePilot`：`/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot`

目标项目 PRD：

- `/Users/yanghaibin/VSCodeProject/Electron/desktop-starter-app/z-product/prd/PRD.md`

## 结论

Pexar Lark Agent 的 MVP 应采用“桌面端单窗口聊天工作台”形态：

- 以 `ai-sdk/chatbot` 的聊天体验为主骨架：单对话流、底部输入框、空状态建议、消息操作、可折叠工具过程。
- 以 `CodePilot` 的桌面端 Agent 细节增强：高密度侧栏、会话状态指示、紧凑工具调用组、权限确认条、设置页分栏、长任务反馈。

不要把两个项目的大而全能力都搬进来。PRD 的核心是“用自然语言操作飞书”，MVP 应围绕飞书文档、飞书消息、设置授权和本地会话历史收敛。

## 1. 主界面布局

### 决策

直接借鉴。

采用三段式桌面工作台：

- 左侧：会话侧栏
- 中间：聊天流
- 底部：固定输入框

### 借鉴来源

`ai-sdk/chatbot` 提供清晰的聊天主体验：

- 单窗口、单对话流
- 消息列表居中
- 底部 sticky composer
- 空状态建议指令

`CodePilot` 提供更桌面化的侧栏：

- 新建会话
- 搜索入口
- 会话状态
- 设置入口
- 高密度布局

### Pexar Lark Agent 落地

首屏建议：

```text
┌──────────────────────────────────────────────────────────────┐
│ 侧边栏                    │ 聊天工作区                       │
│                           │                                  │
│ + 新建会话    搜索        │ 顶部：会话标题 / 配置状态         │
│                           │                                  │
│ 配置状态                  │ 消息流                           │
│ - API Key 已配置          │ - 用户消息                       │
│ - 飞书已授权              │ - Assistant 回复                 │
│                           │ - 飞书工具调用组                 │
│ 今天                      │ - 敏感操作确认条                 │
│ - 总结研发群    ●         │                                  │
│ - 创建飞书文档  !         │ 底部输入框                       │
│                           │                                  │
│ 设置                      │                                  │
└──────────────────────────────────────────────────────────────┘
```

建议尺寸：

- 侧栏宽度：240-280px
- 聊天内容最大宽度：760-900px
- 输入框固定在底部
- 桌面端优先，移动端不作为 MVP 目标

## 2. 会话侧栏

### 决策

直接借鉴并简化。

### 保留

从 `ai-sdk/chatbot` 借鉴：

- 历史会话按时间分组
- 单击恢复会话
- 删除会话
- 空历史提示

从 `CodePilot` 借鉴：

- 顶部新建会话按钮
- 搜索会话按钮
- 会话项 hover 后显示更多菜单
- 会话项右侧显示最近更新时间
- 会话项显示执行中和等待确认状态

### 不保留

- 项目目录分组
- 分屏会话
- Share / Public / Private
- 登录后才保存历史
- 导入外部 CLI 会话

### Pexar Lark Agent 落地

时间分组：

- 今天
- 昨天
- 近 7 天
- 近 30 天
- 更早

会话项状态：

- `正在执行`：AI 正在调用 `lark-cli`
- `等待确认`：敏感飞书操作等待用户确认
- `执行失败`：上一轮工具调用失败
- `空闲`：无状态图标

视觉建议：

- 执行中：绿色或品牌色脉冲点
- 等待确认：黄色小图标
- 失败：红色小点或错误徽标
- hover 后把更新时间替换为三点菜单

## 3. 聊天消息流

### 决策

直接借鉴 `ai-sdk/chatbot` 的简洁消息流，吸收 `CodePilot` 的流式状态。

### 保留

- 用户消息右对齐或气泡化
- Assistant 消息左对齐
- hover 显示消息操作
- 支持复制
- 支持编辑用户消息并重新提交
- 支持重新生成 assistant 回复
- streaming 时展示 thinking 状态

### 暂缓

- 点赞 / 点踩
- 复杂 widget 渲染
- 图片生成卡片
- 批量任务 dashboard

### Pexar Lark Agent 落地

MVP 消息操作：

- 复制
- 编辑并重新发送
- 重新生成

消息内容应优先支持：

- Markdown
- 飞书文档链接
- 飞书群名 / 联系人 / 文档标题的可读展示
- 工具执行摘要

## 4. 底部输入框

### 决策

直接借鉴 `ai-sdk/chatbot` 的 composer，改造吸收 `CodePilot` 的草稿和命令机制。

### 保留

从 `ai-sdk/chatbot` 借鉴：

- 底部固定输入框
- 空输入禁用发送
- 发送中显示停止按钮
- 空状态建议指令
- 输入框聚焦态

从 `CodePilot` 借鉴：

- 草稿按会话保存
- slash commands
- 发送中禁止危险命令
- 未来可扩展对象引用

### MVP 输入框功能

- 输入文本
- 发送 / 停止
- 按会话保存草稿
- 空输入禁用发送
- 支持粘贴长文本
- 支持 slash command

### MVP slash commands

- `/new` 新建会话
- `/clear` 清空当前会话
- `/settings` 打开设置
- `/auth` 飞书授权
- `/search` 搜索文档或历史

### 暂缓

- `/model`：PRD 固定 `Pro/moonshotai/Kimi-K2.6`
- 文件上传
- 多模态图片输入
- 复杂 badge 系统
- 完整对象 picker

### P1 可扩展

飞书对象引用：

- `@群名`
- `@联系人`
- `@文档标题`

## 5. 空状态与建议指令

### 决策

直接借鉴 `ai-sdk/chatbot`，内容按 PRD 改写。

### 设计原则

空状态不是营销页，不解释产品功能，直接给用户可执行任务。

### 推荐空状态

标题：

- `今天要处理什么飞书任务？`

副标题：

- `可以创建文档、查询群消息、搜索云文档或发送消息。`

建议指令：

- `把这段内容创建为飞书文档`
- `总结一下「研发群」今天的讨论`
- `找一下上周的评估报告`
- `给某人发送一条飞书消息`

### 配置缺失时

如果配置缺失，空状态优先展示配置问题，而不是任务建议：

- `请先配置硅基流动 API Key`
- `请先填写飞书 appId 和 appSecret`
- `请先完成飞书账号授权`

按钮：

- `打开设置`
- `开始授权`
- `测试连接`

## 6. 工具调用展示

### 决策

采用混合方案：

- MVP 默认用 `CodePilot` 的紧凑工具调用组。
- 单个重要工具或失败详情可使用 `ai-sdk/chatbot` 的大卡片展开模式。

### 原因

飞书任务通常会有多个连续工具调用。例如总结群消息可能包含：

1. 搜索群
2. 读取群消息
3. 分页拉取历史
4. 生成摘要

如果每个步骤都用大卡片，会占用太多空间。紧凑工具组更适合 MVP。

### 工具组展示建议

折叠态：

```text
4 个动作 · 1 正在执行 · 查询群消息
```

展开态：

```text
✓ 搜索群：研发群
✓ 获取群 ID：oc_xxx
● 拉取消息：今天 00:00-现在
  生成摘要：等待中
```

### 工具分类

- 文档：创建、读取、搜索、更新
- 消息：发送、查询、总结
- 联系人：搜索人员、解析 open_id
- 群组：搜索群、读取成员
- 授权：检查授权、刷新 token
- 系统：检查网络、检查 lark-cli

### 状态文案

- 准备调用
- 正在执行
- 已完成
- 等待确认
- 已拒绝
- 执行失败

### 参数和结果展示

默认只展示摘要：

- 目标群
- 文档标题
- 搜索关键词
- 命中数量
- 生成链接
- 失败原因

展开后展示：

- `lark-cli` 命令
- 参数 JSON
- stderr / stdout 摘要
- 原始错误码

## 7. 敏感操作确认

### 决策

MVP 必须做。

借鉴 `CodePilot` 的 `PermissionPrompt` 底部确认条，但先只支持“拒绝”和“仅本次允许”。

### 必须确认的动作

- 发送飞书消息
- 更新已有飞书文档
- 删除或覆盖内容
- 批量发送
- 修改文档权限或分享范围

### 暂不强制确认的动作

- 搜索文档
- 读取文档
- 查询群消息
- 搜索联系人
- 检查授权状态

### 确认条内容

发送消息示例：

```text
发送飞书消息
目标：研发群
内容预览：
明天 10 点同步评审结论...

[拒绝] [仅本次允许]
```

更新文档示例：

```text
更新飞书文档
文档：项目评估报告
变更摘要：追加“风险与建议”章节

[拒绝] [仅本次允许]
```

### P1 可扩展

- 本会话允许同类操作
- 为某个群聊允许发送消息
- 为某个文档允许更新
- 操作前编辑参数

## 8. 设置页

### 决策

借鉴 `CodePilot` 的设置分栏和凭证处理方式，范围按 PRD 收敛。

### 设置页结构

```text
设置

通用       语言、主题、数据位置
模型       硅基流动 API Key、固定模型、测试连接
飞书应用   appId、appSecret、凭证保存状态
飞书授权   当前授权账号、授权/重新授权、权限检查
关于       版本、更新、日志目录
```

### MVP 必填配置

- 硅基流动 API Key
- 飞书 appId
- 飞书 appSecret
- 飞书账号授权

### 凭证体验

借鉴 CodePilot：

- 编辑时不回显真实 key
- 留空表示保留已有凭证
- 提供清除凭证入口
- 保存前校验必填项
- 提供测试连接
- 错误提示给出可操作建议

### 侧边栏状态

设置入口旁展示配置总状态：

- 绿色：模型和飞书都可用
- 黄色：配置不完整
- 红色：授权失败或连接失败

## 9. 流式输出和长任务反馈

### 决策

借鉴 `CodePilot` 的长任务反馈。

### MVP 状态

- 0-3 秒：`正在思考...`
- 工具调用开始：`正在调用飞书...`
- 具体工具：`正在查询群消息...`
- 超过 15 秒：`执行时间较长，仍在等待飞书返回`
- 超过 60 秒：展示 `停止` 或 `重试`

### 失败反馈

失败时不要只显示原始异常。应展示：

- 用户可理解的原因
- 技术详情可展开
- 下一步动作

示例：

```text
飞书授权已失效，无法读取群消息。

[重新授权] [查看详情]
```

## 10. 文档预览 / 右侧面板

### 决策

MVP 暂缓，P1 引入轻量版。

### 可借鉴来源

`ai-sdk/chatbot` 的 Artifact 面板适合文档生成预览，但完整版本管理、diff、代码/图片/表格 artifact 对当前 PRD 过重。

### P1 落地

只做飞书文档预览：

- 创建前显示标题和正文预览
- 支持复制内容
- 支持确认创建
- 创建成功后显示飞书文档链接

暂不做：

- 多版本 diff
- 内嵌编辑器
- 表格 artifact
- 图片 artifact

## 11. 视觉风格

### 决策

借鉴两个项目的克制工具风格。

### 设计原则

- 直接进入工作台，不做 landing page
- 高信息密度但保持清晰
- hover 才显示辅助操作
- 卡片圆角小，边框轻
- 动效短且轻
- 主要使用中性色
- 状态色只用于成功、等待、失败

### 建议

- 主色可接近飞书蓝
- 大面积背景使用中性色
- 工具状态使用语义色
- 文案默认中文
- 所有状态提示要可操作

## 12. 组件治理

### 决策

借鉴 CodePilot 的 UI governance 思路，但按当前项目规模轻量落地。

### 建议分层

```text
src/renderer/components/ui/          基础组件
src/renderer/components/patterns/    设置卡片、状态提示、空状态等展示模式
src/renderer/components/chat/        聊天业务组件
src/renderer/components/settings/    设置业务组件
```

### 建议规范

- 图标统一来源
- 颜色使用语义 token
- 工具调用、确认条、状态提示抽成可复用模式
- 避免单个组件无限增长
- 复杂交互优先拆 hooks

## 13. 不做清单

以下功能不进入 MVP：

- Web 登录体系
- 云端同步
- 多用户
- public/private 分享
- 多模型选择器
- 多服务商管理
- MCP 管理
- Skills 市场
- 插件系统
- 分屏双会话
- 项目目录分组
- 文件树
- Git 面板
- 终端
- Assistant Workspace
- 记忆系统
- 每日签到
- 图片生成
- 任务调度
- 多平台 Bridge
- Token 成本分析
- 复杂 Artifact 编辑器
- 点赞 / 点踩反馈

## 14. 最终优先级

### P0：MVP 必须有

- 单窗口聊天工作台
- 左侧会话侧栏
- 会话本地保存、恢复、删除
- 底部固定输入框
- 流式输出
- 紧凑工具调用组
- 敏感飞书操作单次确认
- 消息复制
- 重新生成
- 设置页
- API Key / appId / appSecret / 飞书授权状态
- 配置缺失提示

### P1：MVP 后增强

- 会话搜索
- 会话重命名
- 编辑用户消息并重新提交
- 工具执行计时和超时提示
- `lark-cli` 参数和输出详情
- 测试连接和诊断
- 飞书对象引用：`@群`、`@联系人`、`@文档`
- 飞书文档创建前预览
- 本会话允许某类敏感操作

### P2：可选增强

- 右侧文档预览面板
- 批量工具调用合并策略优化
- 结构化错误恢复建议
- 诊断日志导出
- 操作前编辑工具参数
- 更完整的键盘快捷键

## 15. 推荐实现顺序

1. 搭好聊天工作台布局：侧栏、消息流、底部输入框。
2. 接入本地会话历史：新建、恢复、删除。
3. 做配置状态：API Key、飞书应用、飞书授权。
4. 做基础聊天流式输出。
5. 做 `lark-cli` 工具调用展示。
6. 做敏感操作确认条。
7. 做空状态建议指令。
8. 做消息复制和重新生成。
9. 做设置页测试连接。
10. 再考虑会话搜索、重命名、对象引用和文档预览。

## 16. 核心取舍

如果只能选最重要的 5 个借鉴点：

1. `ai-sdk/chatbot` 的单对话聊天骨架。
2. `ai-sdk/chatbot` 的底部输入框和空状态建议。
3. `CodePilot` 的桌面侧栏和会话状态指示。
4. `CodePilot` 的紧凑工具调用组。
5. `CodePilot` 的敏感操作权限确认条。

这 5 个点足以支撑 Pexar Lark Agent 的 MVP 体验，并且不会把产品带偏成通用 Agent 平台。

## 17. 可移植源码参考

本章只列源代码绝对路径和移植说明，不包含代码片段。移植时优先参考组件结构、状态流和交互模式，不建议直接整文件复制。

### 17.1 聊天工作台布局

源代码绝对路径：

- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/components/chat/shell.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/components/chat/messages.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/components/chat/multimodal-input.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/layout/ChatListPanel.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/layout/AppShell.tsx`

移植说明：

- 以 `shell.tsx` 的“消息区 + 底部输入框”作为主聊天骨架。
- 以 `ChatListPanel.tsx` 的桌面侧栏作为侧栏参考，但删掉项目目录、分屏、插件导航等复杂功能。
- Pexar MVP 只保留一个主聊天区，不迁移 artifact panel 和 split screen。

### 17.2 会话侧栏和会话项

源代码绝对路径：

- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/components/chat/sidebar-history.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/components/chat/sidebar-history-item.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/layout/ChatListPanel.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/layout/SessionListItem.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/layout/chat-list-utils.ts`

移植说明：

- 时间分组参考 `sidebar-history.tsx`。
- 会话项 hover 菜单、更新时间替换为操作按钮、执行中/等待确认状态参考 `SessionListItem.tsx`。
- 不迁移 CodePilot 的项目分组、工作目录、分屏会话和导入 CLI 会话能力。

### 17.3 底部输入框

源代码绝对路径：

- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/components/chat/multimodal-input.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/components/ai-elements/prompt-input.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/components/chat/slash-commands.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/chat/MessageInput.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/chat/MessageInputParts.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/chat/SlashCommandPopover.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/lib/message-input-logic.ts`

移植说明：

- 输入框布局、发送/停止按钮、空输入禁用参考 `multimodal-input.tsx`。
- 草稿按会话保存、slash command 处理参考 `MessageInput.tsx` 和 `message-input-logic.ts`。
- Pexar MVP 不迁移附件上传、多模态图片、模型选择、badge 系统和 CLI tools popover。
- slash command 只保留 `/new`、`/clear`、`/settings`、`/auth`、`/search`。

### 17.4 空状态和建议指令

源代码绝对路径：

- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/components/chat/greeting.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/components/chat/suggested-actions.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/lib/constants.ts`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/chat/ChatEmptyState.tsx`

移植说明：

- 空状态视觉和 suggested actions 交互参考 `greeting.tsx`、`suggested-actions.tsx`。
- 配置缺失时的卡片式提示参考 `ChatEmptyState.tsx`。
- 文案必须替换为飞书任务，不保留 Next.js、项目目录、Assistant Workspace 等内容。

### 17.5 紧凑工具调用组

源代码绝对路径：

- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/ai-elements/tool-actions-group.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/chat/StreamingMessage.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/components/ai-elements/tool.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/components/chat/message.tsx`

移植说明：

- MVP 默认参考 CodePilot 的 `ToolActionsGroup`：一行摘要、展开列表、状态点。
- 单个重要工具、失败详情或参数/结果 JSON 展示可参考 chatbot 的 `Tool` 组件。
- Pexar 工具分类应改为文档、消息、联系人、群组、授权、系统。
- 先不迁移 CodePilot 的 widget、image、agent、terminal 专用 renderer。

### 17.6 敏感操作确认条

源代码绝对路径：

- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/chat/PermissionPrompt.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/ai-elements/confirmation.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/chat/ChatView.tsx`

移植说明：

- 底部权限确认条结构参考 `PermissionPrompt.tsx`。
- 状态组件拆分思路参考 `confirmation.tsx`。
- 与流式会话的暂停/继续连接方式参考 `ChatView.tsx` 中 `pendingPermission` 和 `respondToPermission` 的使用。
- MVP 只保留“拒绝”和“仅本次允许”，暂缓“本会话允许”。

### 17.7 设置页和凭证表单

源代码绝对路径：

- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/settings/SettingsLayout.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/settings/ProviderManager.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/settings/ProviderForm.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/settings/PresetConnectDialog.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/settings/ProviderDoctorDialog.tsx`

移植说明：

- 设置页左侧分类、右侧内容布局参考 `SettingsLayout.tsx`。
- 凭证编辑时不回显真实 key、留空表示保留、清除凭证等逻辑参考 `ProviderForm.tsx` 和 `PresetConnectDialog.tsx`。
- 测试连接和诊断体验参考 `ProviderManager.tsx`、`ProviderDoctorDialog.tsx`。
- Pexar 只保留硅基流动 API Key、固定模型、飞书 appId/appSecret、飞书授权，不迁移多服务商管理。

### 17.8 配置缺失提示和设置入口

源代码绝对路径：

- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/setup/SetupCenter.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/setup/ProviderCard.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/setup/ProjectDirCard.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/chat/ChatEmptyState.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/layout/AppShell.tsx`

移植说明：

- PRD 明确不做首次引导，所以不要迁移 SetupCenter 的 onboarding 流程。
- 只借鉴配置完成度、状态卡片和“打开设置”事件入口。
- 聊天页配置缺失提示优先级高于 suggested actions。

### 17.9 流式状态和长任务反馈

源代码绝对路径：

- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/chat/StreamingMessage.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/chat/ChatView.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/lib/stream-session-manager.ts`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/hooks/useStreamSubscription.ts`

移植说明：

- thinking 阶段、elapsed timer、长时间运行警告参考 `StreamingMessage.tsx`。
- streaming snapshot 和工具状态更新方式参考 `ChatView.tsx`、`stream-session-manager.ts`。
- Pexar MVP 不需要完整 stream session manager，可先在当前会话状态里保存 `startedAt`、`statusText`、`toolActions`。

### 17.10 右侧飞书文档预览面板

源代码绝对路径：

- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/components/chat/artifact.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/components/chat/document-preview.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/components/chat/artifact-actions.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/hooks/use-artifact.ts`

移植说明：

- MVP 暂缓右侧面板。
- P1 只借鉴 artifact 的“聊天区收窄 + 右侧预览”布局。
- 不迁移版本管理、diff、代码编辑器、图片和表格 artifact。

### 17.11 消息操作

源代码绝对路径：

- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/components/chat/message-actions.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/components/chat/message-editor.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/components/chat/message.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/chat/MessageItem.tsx`

移植说明：

- hover 后显示复制、编辑、重新生成参考 chatbot。
- Pexar MVP 必须有复制和重新生成；编辑用户消息可作为 P1。
- 不迁移点赞/点踩。

### 17.12 视觉和组件治理

源代码绝对路径：

- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/app/globals.css`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/app/globals.css`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/docs/ui-governance.md`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/ui/icon.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/patterns/StatusBanner.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/patterns/SettingsCard.tsx`

移植说明：

- 颜色 token、轻边框、hover 操作、状态色参考两个项目的 `globals.css`。
- 组件分层参考 `docs/ui-governance.md`。
- 图标统一入口可参考 `icon.tsx`，但是否采用 Phosphor 取决于当前项目依赖。

### 17.13 建议落地到当前项目的文件

当前项目建议新增或改造以下文件：

- `/Users/yanghaibin/VSCodeProject/Electron/desktop-starter-app/src/renderer/components/chat/ChatWorkspace.tsx`
- `/Users/yanghaibin/VSCodeProject/Electron/desktop-starter-app/src/renderer/components/chat/ChatSidebar.tsx`
- `/Users/yanghaibin/VSCodeProject/Electron/desktop-starter-app/src/renderer/components/chat/SessionItem.tsx`
- `/Users/yanghaibin/VSCodeProject/Electron/desktop-starter-app/src/renderer/components/chat/MessageList.tsx`
- `/Users/yanghaibin/VSCodeProject/Electron/desktop-starter-app/src/renderer/components/chat/MessageItem.tsx`
- `/Users/yanghaibin/VSCodeProject/Electron/desktop-starter-app/src/renderer/components/chat/ChatComposer.tsx`
- `/Users/yanghaibin/VSCodeProject/Electron/desktop-starter-app/src/renderer/components/chat/ChatEmptyState.tsx`
- `/Users/yanghaibin/VSCodeProject/Electron/desktop-starter-app/src/renderer/components/chat/LarkToolActionsGroup.tsx`
- `/Users/yanghaibin/VSCodeProject/Electron/desktop-starter-app/src/renderer/components/chat/LarkPermissionPrompt.tsx`
- `/Users/yanghaibin/VSCodeProject/Electron/desktop-starter-app/src/renderer/components/chat/StreamingStatusBar.tsx`
- `/Users/yanghaibin/VSCodeProject/Electron/desktop-starter-app/src/renderer/components/chat/LarkDocPreview.tsx`
- `/Users/yanghaibin/VSCodeProject/Electron/desktop-starter-app/src/renderer/components/settings/SettingsLayout.tsx`
- `/Users/yanghaibin/VSCodeProject/Electron/desktop-starter-app/src/renderer/components/settings/SecretField.tsx`

P0 优先落地：

- `/Users/yanghaibin/VSCodeProject/Electron/desktop-starter-app/src/renderer/components/chat/ChatWorkspace.tsx`
- `/Users/yanghaibin/VSCodeProject/Electron/desktop-starter-app/src/renderer/components/chat/ChatSidebar.tsx`
- `/Users/yanghaibin/VSCodeProject/Electron/desktop-starter-app/src/renderer/components/chat/SessionItem.tsx`
- `/Users/yanghaibin/VSCodeProject/Electron/desktop-starter-app/src/renderer/components/chat/ChatComposer.tsx`
- `/Users/yanghaibin/VSCodeProject/Electron/desktop-starter-app/src/renderer/components/chat/ChatEmptyState.tsx`
- `/Users/yanghaibin/VSCodeProject/Electron/desktop-starter-app/src/renderer/components/chat/LarkToolActionsGroup.tsx`
- `/Users/yanghaibin/VSCodeProject/Electron/desktop-starter-app/src/renderer/components/chat/LarkPermissionPrompt.tsx`
- `/Users/yanghaibin/VSCodeProject/Electron/desktop-starter-app/src/renderer/components/settings/SettingsLayout.tsx`
- `/Users/yanghaibin/VSCodeProject/Electron/desktop-starter-app/src/renderer/components/settings/SecretField.tsx`
