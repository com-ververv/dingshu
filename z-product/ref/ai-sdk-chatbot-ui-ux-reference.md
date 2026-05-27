# ai-sdk/chatbot UI/UX 参考借鉴

参考项目：`/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot`

目标项目 PRD：`/Users/yanghaibin/VSCodeProject/Electron/desktop-starter-app/z-product/prd/PRD.md`

## 结论

`ai-sdk/chatbot` 最值得借鉴的是高密度工具型聊天界面，而不是它的 Next.js、Auth、云端历史、分享、模型网关等产品结构。

Pexar Lark Agent 应该参考其：

- 单窗口聊天工作台布局
- 会话历史侧边栏
- 底部固定输入框
- 可折叠工具调用过程
- 消息复制、编辑、重新生成等操作
- 空状态建议指令

同时应移除或弱化：

- Web 登录体系
- 云端同步与分享
- 模型选择器
- 公共/私密可见性
- 复杂 Artifact 编辑器
- 云端文件上传流程

## 1. 聊天主界面

### 可直接借鉴

`chatbot` 的主界面是典型三段式工作台：

- 左侧：会话历史
- 中间：单对话流
- 底部：sticky composer

这与 PRD 中的“单窗口、单对话流、本地历史会话”高度一致。

参考文件：

- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/components/chat/shell.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/components/chat/messages.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/components/chat/multimodal-input.tsx`

### 建议落地

Pexar Lark Agent 首屏可以采用：

- 左侧 260px 左右会话栏
- 右侧主聊天区占满剩余空间
- 消息内容最大宽度控制在 760-900px
- 输入框固定在底部
- 空会话时中间展示一句短提示，底部上方展示 3-4 个飞书场景建议

建议空状态文案：

- 标题：`今天要处理什么飞书任务？`
- 副标题：`可以创建文档、查询群消息、搜索云文档或发送消息。`

## 2. 会话管理

### 可直接借鉴

`chatbot` 的历史会话按时间分组：

- Today
- Yesterday
- Last 7 days
- Last 30 days
- Older

这比简单列表更适合桌面端长期使用。

参考文件：

- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/components/chat/sidebar-history.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/components/chat/sidebar-history-item.tsx`

### 建议落地

中文分组：

- 今天
- 昨天
- 近 7 天
- 近 30 天
- 更早

会话项建议支持：

- 单击恢复会话
- hover 显示更多菜单
- 删除当前会话
- 清空全部会话时使用确认弹窗

不建议照搬：

- Share
- Public / Private
- 登录后才保存历史

PRD 要求历史本地保存，不上云、不同步，因此侧边栏应始终可用。

## 3. 底部输入框

### 可直接借鉴

`chatbot` 的 composer 有几个体验细节值得保留：

- 输入中自动保存草稿
- 发送中显示停止按钮
- 支持编辑上一条用户消息
- 空状态展示 suggested actions
- 支持 slash commands
- 输入框聚焦态有轻微阴影变化

参考文件：

- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/components/chat/multimodal-input.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/components/chat/slash-commands.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/components/chat/suggested-actions.tsx`

### 建议落地

底部输入框保留轻量工具栏：

- 左侧：设置状态、飞书授权状态、可选附件入口
- 右侧：发送 / 停止按钮
- 输入为空时禁用发送
- 发送中允许停止

建议 suggested actions：

- `把这段内容创建为飞书文档`
- `总结一下「研发群」今天的讨论`
- `找一下上周的评估报告`
- `给某人发送一条飞书消息`

建议 slash commands：

- `/new` 新建会话
- `/clear` 清空当前会话
- `/settings` 打开设置
- `/auth` 飞书授权
- `/search` 搜索文档或历史

不建议保留：

- `/model`，PRD 固定 `Pro/moonshotai/Kimi-K2.6`
- 与公开分享相关的命令
- 删除全部会话这类高风险命令直接执行

## 4. 工具调用过程

### 可直接借鉴

PRD 明确要求“展示工具调用过程（可折叠/展开）”。`chatbot` 的 Tool 组件结构非常适合迁移：

- Header 展示工具名
- Badge 展示状态
- Content 展示参数和结果
- 支持折叠/展开
- 错误结果单独样式

参考文件：

- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/components/ai-elements/tool.tsx`
- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/components/chat/message.tsx`

### 建议落地

针对 `lark-cli`，工具调用卡片可展示：

- 工具名称：`飞书文档 / 搜索文档 / 查询群消息 / 发送消息`
- 执行动作：`lark doc create`、`lark im search` 等
- 参数摘要：目标群、文档标题、搜索关键词
- 结果摘要：成功链接、命中数量、失败原因

建议状态文案：

- `等待确认`
- `准备调用`
- `正在执行`
- `已完成`
- `已拒绝`
- `执行失败`

涉及敏感动作时建议保留确认态：

- 发送消息
- 删除或覆盖文档
- 修改权限

## 5. 消息操作

### 可直接借鉴

`chatbot` 在 hover 时显示消息操作，界面干净，适合桌面端：

- 复制
- 编辑用户消息
- 重新生成
- 点赞/点踩

参考文件：

- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/components/chat/message-actions.tsx`

### 建议落地

Pexar Lark Agent MVP 建议支持：

- 复制
- 编辑并重新提交用户消息
- 重新生成 assistant 回复

可暂缓：

- 点赞/点踩

原因：PRD 成功指标关注场景成功率，MVP 初期更需要明确失败原因和日志，而不是泛化反馈按钮。

## 6. 设置和授权

### chatbot 可借鉴的部分

`chatbot` 不适合照搬设置体系，但可以参考其状态提示方式：

- 顶部或弹窗提示缺失配置
- toast 展示操作结果
- 按钮动作直接引导用户处理

### Pexar Lark Agent 设置页建议

设置页应覆盖 PRD 中的三类配置：

- 硅基流动 API Key
- 飞书 appId / appSecret
- 飞书账号授权入口

聊天界面发现未配置时，不应直接失败，应显示明确提示：

- `请先在设置中填写硅基流动 API Key`
- `请先完成飞书账号授权`
- `飞书 appId/appSecret 缺失，无法调用 lark-cli`

建议设置入口常驻在侧边栏底部，状态用小圆点表达：

- 绿色：已配置并授权
- 黄色：配置不完整
- 红色：授权失败

## 7. Artifact 面板

### 可改造借鉴

`chatbot` 的 Artifact 右侧面板适合“生成内容预览/编辑”，但完整版本管理、diff、代码/图片/表格 artifact 对 Pexar Lark Agent MVP 偏重。

参考文件：

- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/components/chat/artifact.tsx`

### 建议落地

只保留轻量版本：

- 创建飞书文档前，右侧显示文档标题和正文预览
- 支持复制内容
- 支持“创建到飞书”
- 成功后显示飞书文档链接

暂不做：

- 多版本 diff
- 内嵌代码编辑器
- 表格编辑器
- 图片 artifact

## 8. 视觉风格

### 可借鉴

`chatbot` 视觉偏克制，适合桌面效率工具：

- 低饱和背景
- 小字号高密度布局
- 轻边框
- hover 才显示辅助操作
- 卡片圆角较小
- 动效短且轻

参考文件：

- `/Users/yanghaibin/VSCodeProject/NodeJS/ai-sdk/chatbot/app/globals.css`

### 建议落地

Pexar Lark Agent 不应做营销化首页，应直接进入工作台。

视觉关键词：

- 安静
- 稳定
- 本地可控
- 飞书工具感
- 信息密度高但不拥挤

建议颜色：

- 主色可采用接近飞书蓝的强调色
- 大面积仍使用中性色
- 工具状态使用少量语义色：绿色成功、黄色等待、红色失败

## 9. 不建议照搬清单

以下功能与 PRD 不一致，不建议进入 MVP：

- Auth.js 登录注册
- Guest 用户
- Vercel AI Gateway 提示
- 云端 Postgres 历史
- Vercel Blob 文件上传
- public/private 会话分享
- Deploy with Vercel 按钮
- 多模型选择器
- 投票系统
- 复杂 artifact 编辑器
- Web-first 响应式优先级高于桌面体验

## 10. MVP 推荐界面结构

建议主窗口结构：

```text
┌────────────────────────────────────────────────────────────┐
│ Sidebar                    │ Chat Workspace                │
│                            │                               │
│ + 新建会话                 │ 顶部：当前会话标题/状态       │
│                            │                               │
│ 今天                       │ 消息流                        │
│ - 创建飞书文档             │ - 用户消息                    │
│ - 总结研发群               │ - Assistant 回复              │
│                            │ - lark-cli 工具调用卡片       │
│ 近 7 天                    │                               │
│ - 搜索评估报告             │                               │
│                            │                               │
│                            │ Suggested Actions             │
│ 设置 / 授权状态            │ Composer                      │
└────────────────────────────────────────────────────────────┘
```

如果后续引入文档预览：

```text
┌────────────────────────────────────────────────────────────┐
│ Sidebar │ Chat 40%                  │ Preview 60%          │
│         │                           │                      │
│         │ 对话与工具调用             │ 飞书文档预览/结果链接  │
└────────────────────────────────────────────────────────────┘
```

## 优先级建议

P0：

- 主聊天工作台
- 会话侧边栏
- 底部输入框
- 工具调用折叠卡片
- 设置缺失提示

P1：

- Suggested actions
- Slash commands
- 消息复制、编辑、重新生成
- 会话按时间分组
- 授权状态指示

P2：

- 右侧文档预览面板
- 敏感操作确认流程
- 执行日志详情
- 失败原因结构化展示
