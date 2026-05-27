# CodePilot UI/UX 参考借鉴

参考项目：`/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot`

目标项目 PRD：`/Users/yanghaibin/VSCodeProject/Electron/desktop-starter-app/z-product/prd/PRD.md`

## 结论

CodePilot 更像完整的桌面 Agent 工作台。对 Pexar Lark Agent 来说，最值得借鉴的是桌面端高密度工作台、会话状态、工具执行过程、权限确认和设置页组织方式。

不建议照搬 CodePilot 的大而全能力。Pexar Lark Agent MVP 应保持专注：用自然语言操作飞书，围绕聊天、飞书工具调用、会话历史、本地凭证配置和授权状态构建体验。

## 1. 左侧栏与桌面工作台

### 可借鉴点

CodePilot 的侧栏比通用 chatbot 更接近桌面软件：

- 顶部固定“新建会话 + 搜索”
- 中部放功能入口和会话列表
- 会话列表可显示状态
- 设置和状态入口常驻
- 面板宽度较窄，信息密度高

参考文件：

- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/layout/ChatListPanel.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/layout/SessionListItem.tsx`

### Pexar Lark Agent 建议

MVP 侧边栏建议包含：

- 新建会话
- 搜索会话
- 会话历史
- 设置入口
- 飞书授权状态
- API Key 配置状态

会话列表不需要项目目录分组。PRD 明确是飞书助手，不是代码工作区工具，因此按时间分组更合适：

- 今天
- 昨天
- 近 7 天
- 近 30 天
- 更早

但可以借鉴 CodePilot 的会话项细节：

- 单行标题
- 右侧显示最近更新时间
- hover 后显示更多菜单
- active 状态明确
- 执行中和等待确认有小图标提示

## 2. 会话项状态指示

### 可借鉴点

CodePilot 在会话列表里使用：

- 绿色脉冲点：会话正在 streaming 或执行工具
- 黄色提示图标：等待用户审批
- hover 后显示三点菜单

这对 Pexar Lark Agent 非常有价值，因为飞书动作经常涉及外部系统状态。

参考文件：

- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/layout/SessionListItem.tsx`

### Pexar Lark Agent 建议

会话项状态可定义为：

- `正在执行`：AI 正在调用 lark-cli 或等待飞书 API 返回
- `等待确认`：发送消息、修改文档、删除内容等敏感动作等待用户确认
- `执行失败`：上一轮工具调用失败
- `已完成`：正常空闲

视觉建议：

- 执行中：绿色或品牌色小脉冲点
- 等待确认：黄色小圆点或铃铛
- 失败：红色小点，但不要过度抢眼

## 3. 工具调用紧凑展示

### 可借鉴点

CodePilot 的 `ToolActionsGroup` 比普通工具卡更适合频繁工具调用：

- 一行展示工具调用总数和状态
- 展开后显示工具列表
- 每个工具行包含图标、摘要、状态点
- 连续读取/搜索类工具自动合并为 context group
- 正在执行时显示 spinner，完成后显示 check，失败显示 error

参考文件：

- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/ai-elements/tool-actions-group.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/chat/StreamingMessage.tsx`

### Pexar Lark Agent 建议

飞书工具调用适合做成紧凑组，而不是每次都占一个大卡片。

例如用户问：

> 总结一下「研发群」今天的讨论

工具组可以显示：

```text
3 个动作 · 1 正在执行
  查询群：研发群
  拉取消息：今天 00:00-现在
  整理摘要：进行中
```

飞书动作分类建议：

- 文档：创建、读取、搜索、更新
- 消息：发送、查询、总结
- 联系人：搜索人员、解析 open_id
- 群组：搜索群、读取群成员
- 授权：检查授权、刷新 token

状态文案建议：

- 准备调用
- 正在执行
- 已完成
- 等待确认
- 已拒绝
- 执行失败

## 4. 权限确认与敏感操作

### 可借鉴点

CodePilot 的 `PermissionPrompt` 有一个很适合 Agent 产品的交互模型：

- 在聊天底部出现权限确认条
- 展示工具名和参数
- 支持拒绝
- 支持仅本次允许
- 支持本会话允许
- 审批完成后只保留简短状态，避免堆积

参考文件：

- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/chat/PermissionPrompt.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/ai-elements/confirmation.tsx`

### Pexar Lark Agent 建议

PRD 的开放问题提到“敏感操作是否加二次确认”。建议 MVP 中至少对以下动作加确认：

- 发送飞书消息
- 更新已有飞书文档
- 删除或覆盖内容
- 批量发送
- 修改权限或分享范围

确认条内容建议：

- 动作名称：`发送飞书消息`
- 目标：`研发群`
- 内容预览：最多展示前 3 行
- 参数详情：可展开查看完整 JSON 或 lark-cli 参数
- 按钮：`拒绝`、`仅本次允许`

`本会话允许` 可作为 P1，因为它涉及安全边界设计。MVP 可以先只支持单次确认。

## 5. 设置页结构

### 可借鉴点

CodePilot 的设置页使用左侧分类导航、右侧内容区。它适合桌面端长期维护配置。

参考文件：

- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/settings/SettingsLayout.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/settings/ProviderManager.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/settings/ProviderForm.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/settings/PresetConnectDialog.tsx`

### Pexar Lark Agent 建议

设置页分类建议：

- 通用
- 模型
- 飞书应用
- 飞书授权
- 关于

MVP 配置项：

- 硅基流动 API Key
- 固定模型展示：`Pro/moonshotai/Kimi-K2.6`
- 飞书 appId
- 飞书 appSecret
- 飞书账号授权入口
- 授权状态
- 测试连接

可借鉴 CodePilot 的凭证体验：

- 编辑时不回显真实 key
- 空输入表示保留已有 key
- 提供清除凭证入口
- 保存前校验必填项
- 提供“测试连接”按钮
- 错误时展示可理解的恢复建议

## 6. 配置缺失提示

### 可借鉴点

CodePilot 有 SetupCenter 和配置状态卡，虽然 PRD 明确 MVP 不做首次引导，但它的“配置完成度”概念值得借鉴。

参考文件：

- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/setup/SetupCenter.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/chat/ChatEmptyState.tsx`

### Pexar Lark Agent 建议

不要做首次启动向导。改为在聊天界面用轻量状态提示：

- 缺少硅基流动 API Key
- 缺少飞书 appId/appSecret
- 飞书账号未授权
- lark-cli 不可用
- 网络不可用

提示应直接给出动作按钮：

- `打开设置`
- `开始飞书授权`
- `测试连接`

## 7. 输入框交互

### 可借鉴点

CodePilot 的输入框支持：

- slash command
- badge
- 文件或对象 mention
- 发送中禁止危险命令
- 草稿按会话保存

参考文件：

- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/chat/MessageInput.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/chat/SlashCommandPopover.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/chat/MessageInputParts.tsx`

### Pexar Lark Agent 建议

MVP 可以简化实现：

- 输入草稿按会话保存
- 发送中显示停止按钮
- 支持 `/new`、`/clear`、`/settings`、`/auth`
- 空输入禁用发送

P1 可以引入飞书对象引用：

- `@群名`
- `@联系人`
- `@文档标题`

对象引用不必一开始实现完整 picker，但 UI 上可预留机制。

## 8. 流式状态与长任务反馈

### 可借鉴点

CodePilot 对 streaming 状态处理比较成熟：

- 等待初始内容时显示 thinking
- 工具执行时显示具体工具摘要
- 长时间执行时显示 elapsed timer
- 超长时间时提示可能卡住
- 可提供 force stop

参考文件：

- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/chat/StreamingMessage.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/chat/ChatView.tsx`

### Pexar Lark Agent 建议

飞书 API 和 lark-cli 可能出现授权、网络、限流、群消息量过大等延迟。建议：

- 3 秒内：`正在思考...`
- 调用工具时：`正在查询飞书消息...`
- 超过 15 秒：`执行时间较长，仍在等待飞书返回`
- 超过 60 秒：展示 `停止` 或 `重试`

这能降低用户对“卡死”的误判。

## 9. 空状态与入口选择

### 可借鉴点

CodePilot 的空状态用卡片引导用户选择项目或助手模式。Pexar 不需要双入口，但可以借鉴“空状态给出明确下一步”的方式。

参考文件：

- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/src/components/chat/ChatEmptyState.tsx`

### Pexar Lark Agent 建议

空状态不要做营销介绍，应直接展示飞书任务入口：

- `把这段内容创建为飞书文档`
- `总结一下「研发群」今天的讨论`
- `找一下上周的评估报告`
- `给某人发送一条飞书消息`

如果配置缺失，空状态优先显示配置问题，而不是建议任务。

## 10. 视觉与组件治理

### 可借鉴点

CodePilot 有 UI governance，强调：

- primitives / patterns / feature / app 分层
- 统一图标入口
- 语义化颜色 token
- 组件行数限制
- 视觉回归测试

参考文件：

- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/CodePilot/docs/ui-governance.md`

### Pexar Lark Agent 建议

当前项目是 Electron + React + Tailwind，可以借鉴这些治理原则：

- `components/ui` 放基础组件
- `components/patterns` 放设置卡片、状态提示、空状态等纯展示模式
- `components/chat` 放聊天业务组件
- 状态色使用语义 token
- 图标统一来源
- 设置页、聊天页、工具卡片保持统一密度和圆角

## 11. 不建议照搬的功能

以下 CodePilot 功能超出 PRD，不建议进入 MVP：

- 多模型/多服务商切换
- MCP 管理
- Skills 市场
- 插件系统
- 分屏双会话
- 文件树
- Git 面板
- 终端
- Assistant Workspace
- 记忆系统
- 每日签到
- Media Studio / 图片生成
- 任务调度
- 多平台 Bridge
- 项目目录分组
- Token 成本分析

这些能力会显著扩大产品边界，削弱“用自然语言操作飞书”的 MVP 聚焦。

## 12. MVP 推荐借鉴优先级

### P0

- 桌面式左侧栏
- 新建会话和会话搜索入口
- 会话项状态：执行中、等待确认、失败
- 紧凑工具调用组
- 敏感操作单次确认
- 设置页分栏
- API Key 和飞书授权状态提示

### P1

- 工具执行计时
- 超时提示和停止按钮
- 会话重命名
- lark-cli 参数展开查看
- 测试连接和诊断
- 飞书对象引用输入

### P2

- 右侧飞书文档预览
- 批量工具调用合并
- 本会话允许某类操作
- 结构化错误恢复建议
- 导出诊断日志

## 13. 建议界面结构

主窗口建议：

```text
┌──────────────────────────────────────────────────────────────┐
│ 侧边栏                    │ 聊天工作区                       │
│                           │                                  │
│ + 新建会话    搜索        │ 顶部：会话标题 / 授权状态         │
│                           │                                  │
│ 状态：                    │ 消息流                           │
│ - API Key 已配置          │ - 用户消息                       │
│ - 飞书已授权              │ - Assistant 回复                 │
│                           │ - 工具调用组                     │
│ 今天                      │ - 权限确认条                     │
│ - 总结研发群    ●         │                                  │
│ - 创建飞书文档  !         │                                  │
│                           │ 底部输入框                       │
│ 设置                      │                                  │
└──────────────────────────────────────────────────────────────┘
```

设置页建议：

```text
┌──────────────────────────────────────────────────────────────┐
│ 设置                                                         │
│                                                              │
│ 通用       │ 语言、主题、数据位置                            │
│ 模型       │ 硅基流动 API Key、固定模型、测试连接             │
│ 飞书应用   │ appId、appSecret、凭证保存状态                   │
│ 飞书授权   │ 当前授权账号、授权/重新授权、权限检查            │
│ 关于       │ 版本、更新、日志目录                             │
└──────────────────────────────────────────────────────────────┘
```
