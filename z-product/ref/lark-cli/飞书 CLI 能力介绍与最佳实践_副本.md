# 飞书 CLI 能力介绍与最佳实践

> English Version：[Lark CLI: Let AI Actually Do Your Work in Lark](https://bytedance.larkoffice.com/wiki/P6DiwXsrZiMYBOk2ikzc9Btanee) （海外 Lark 已支持）
> 
> 

#### **飞书 CLI 正式开源，给每个 Agent 一双操作飞书的手**

你的 AI Agent 很聪明，但它看不到你的日历，读不了你的群聊，打不开你的文档。它就像一个能力很强但没有手的人，只能跟你聊天，不能帮你干活。

飞书 CLI 就是给 Agent 的那双手。装上之后，你的 Agent 可以直接读你的飞书消息、查你的日历、写文档、建多维表格、搜知识库、发邮件。不是生成一段文字让你复制粘贴，而是直接在飞书里帮你把事情办了。

以前是你操作飞书，现在是 AI 操作飞书，你只管拍板。

**零门槛，真开源**

无需登记，无需审核。飞书 CLI 现已面向所有用户开源。我们相信，开源不应设置人为障碍。

无论你想让 Claude Code、Codex 还是其他 Agent 直接操作飞书，或是希望围绕飞书构建新一代自动化工作流，欢迎立即获取代码，即刻上手：👉 [**\[GitHub 开源地址\]**](https://github.com/larksuite/cli)



**🦞 如果你是 OpenClaw用户：**你可以给openclaw 发送一句话 即可一键安装飞书CLI：[OpenClaw 飞书官方插件使用指南（公开版）](https://bytedance.larkoffice.com/docx/MFK7dDFLFoVlOGxWCv5cTXKmnMh?contentTheme=DARK&last_doc_message_id=7631786885724113852&preview_comment_id=7631787091671715013&sourceType=feed&theme=light#TnV6dVFXood1lOxYOWQcU7nqn8g)



**🦞**** 如果你是飞书 aily 用户：**用户无需单独安装飞书 CLI。飞书 aily 已内置全部 CLI 能力。

**入群参与讨论、订阅后续更新**

---

## 等一下，CLI 是什么？跟我有什么关系？

你可能觉得 CLI（命令行工具）是程序员的东西，跟自己没关系。换个方式理解：

**你跟 AI 的对话，其实不是两个人的私聊，而是一个三人群聊。**

群里有三个人：你、AI、你的电脑（或者说飞书）。

- 你发消息 = 你在跟 AI 说话

- AI 执行命令 = AI 在跟飞书说话

- 飞书返回结果 = 飞书在回复你们俩

**以前的问题是：飞书没有加入这个群聊。**AI 再聪明，它跟飞书之间没有沟通渠道，所以只能给你建议，不能帮你干活。

**飞书 CLI 就是把飞书拉进了这个群聊。** 装上之后，AI 终于能直接跟飞书对话了：帮你查日历、发消息、写文档、建表格。

所以 CLI 跟你的关系是：**你完全不需要学它，甚至不需要知道它存在。** 你只管用自然语言跟 AI 说话，AI 会自己用 CLI 去操作飞书。你只需要安装一次，之后就忘了它吧。

---

## 谁会用到它

- **使用 ****Trae、****Claude Code、****Codex****、Cursor 等 AI 工具的用户**

直接安装 CLI，让 AI 代你操作飞书——总结昨日工作、整理群聊消息、批量更新多维表格数据。一行命令完成安装，几分钟即可上手。

- **构建企业级 AI Agent 的团队**

如果你正在开发需要与飞书深度集成的 AI 产品——无论是 AI 员工、AI 客服还是自动化工作流——CLI 提供飞书官方推荐的最佳实践，覆盖核心业务域的高频操作，同时支持用户身份与应用身份，可直接集成进你的 Agent。企业agent接入cli 方式参见 [开发文档](https://open.larkoffice.com/document/mcp_open_tools/feishu-cli/embed-feishu-cli-in-agent)

- **使用 OpenClaw 的用户**

如果你在 OpenClaw 中安装了飞书插件，你可以给openclaw 发送一句话 即可一键安装飞书CLI：详见 [OpenClaw 飞书官方插件使用指南（公开版）](https://bytedance.larkoffice.com/docx/MFK7dDFLFoVlOGxWCv5cTXKmnMh?contentTheme=DARK&last_doc_message_id=7631786885724113852&preview_comment_id=7631787091671715013&sourceType=feed&theme=light#TnV6dVFXood1lOxYOWQcU7nqn8g)

---

## 📦 快速安装

- 方式一：手动安装。在终端中输入一行命令完成安装（Trae 建议通过这种方式安装）

```Plain Text
npx @larksuite/cli@latest install
```



- 方式二：AI agent 工具自动安装。将以下信息发送给你的 AI Agent 工具（如 Cursor、Codex、Claude code），立即完成安装

```Plain Text
帮我安装飞书 CLI：https://open.feishu.cn/document/no_class/mcp-archive/feishu-cli-installation-guide.md
```



### 配置时的注意事项

1. 配置飞书应用：扫码配置应用时，可以创建一个**新应用**，也可以选择一个**已有应用**。

2. 用户授权：如果你希望 AI 可以访问你个人的日历、消息、文档，并以你的名义执行操作。需要完成一次用户授权（如果暂时跳过，后续 AI 在需要访问你个人数据时，也会自动发起授权提示）

3. 配置完成后，**为了确保**** skills**** 完整加载，需要重启你的 AI Agent 工具**（如 Trae、Cursor、Codex、Claude code），然后便可以发送指令开始操作飞书。





### 🎉 开启我的第一个任务

打开你的 AI Agent 工具（如 Trae、Cursor、Claude Code），在对话框中输入：

```Plain Text
帮我创建一篇云文档，介绍飞书 CLI 的能力有哪些，以及基于你对我的了解，我可以先开始用哪些能力
```

## 🎬 能做什么

### 场景 1：开完会，事就办了

会议里随口提一句“我之后把那个文档发给你”，开完会就忘了。**现在 agent 直接从妙记里把这个待办识别出来，帮你把文档发了、会约了、调研做了。你只需要确认一下，剩下的它全干。**

比如会上说要给谁发东西，agent 帮你发。说回头试一个新产品，agent 把链接找到发给你。说要约 follow up，agent 查完日历直接把会建好。做之前会先让你过目。

**进阶玩法：Wake Word 指令。**你可以设置一个触发词（比如“龙虾龙虾”），开会的时候随口说“龙虾龙虾，帮我把这个方案整理成文档发给老板”，会后 agent 自动从妙记逐字稿里识别出你的指令，提取为最高优先级待办，直接执行。你不需要记住自己在会上说了什么，agent 替你记着。

```Plain Text
读一下这个妙记，然后把里面的待办提取出来，直接帮我办了。做之前给我看一下你的计划。
```



### 场景 2：人与 AI 共创文档

写方案要反复和 AI 对话、复制粘贴、格式排版，效率低。现在有两种玩法：

**AI 起草，你来把关。** AI 在飞书文档里直接创建初稿，你在文档里用评论提修改意见，AI 读取评论、修改正文，持续迭代，全程不离开飞书。

**你起草，AI 当审稿人。** 你写好初稿后，让 AI 阅读全文，以评论的形式指出逻辑漏洞、数据缺失、表述不清的地方，和你在评论区讨论。就像有一个随时在线的资深同事帮你 review。

**Markdown 无缝转飞书文档****。** 你在 AI 工具里用 Markdown 写了一篇技术方案，想发给同事看？直接说\&\#34;把这个 Markdown 创建成飞书文档\&\#34;，agent 自动转换格式，高亮块、表格、代码块、分栏全部保留。反过来也行，从飞书文档导出成 Markdown。

**模式 A：写文档**

```Plain Text
根据我的所在部门、飞书消息、飞书云文档、日程等信息，帮我创建一篇飞书云文档，写一篇个人使用说明书。
```

![Image](https://internal-api-drive-stream.larkoffice.com/space/api/box/stream/download/authcode/?code=NzNjZmQ4N2M0MzdjMmI1MDdmNDA1MTMwOTQ4ZTBmMDNfMTdmMGEwODFlZDUxMjQ2MDZmOTYxYzFlZGVhYTMyOTZfSUQ6NzYyMjEyMzYwMzM0OTM1OTgwMl8xNzc5ODA4NTE4OjE3Nzk4OTQ5MThfVjM)

```Plain Text
{{文档链接}} 根据我的评论修改文档，修改后，用划词评论标识出修改点。
```

![Image](https://internal-api-drive-stream.larkoffice.com/space/api/box/stream/download/authcode/?code=MGE0ZDUxMTk5NTEzOWE2NDRkMmQyZGExNTU5MmQ0MGVfZmQ4ODEyMjUxNjk1MzdiZWQ2NTgwZGUyNjc0YjI0ZjdfSUQ6NzYyMjEyMzYwNDExNjkzMzU3NV8xNzc5ODA4NTE4OjE3Nzk4OTQ5MThfVjM)

![Image](https://internal-api-drive-stream.larkoffice.com/space/api/box/stream/download/authcode/?code=MjE3OThiODQ2OGNkOTdlM2I5MTcyZjEyOGNjODc1ODFfNDQ1NmI4MTA1NWNmNWQzZDgzZmIyYzU3ZjgzZjY0ZTFfSUQ6NzYyMjEyMzYwNDgyOTgzNDQ2NF8xNzc5ODA4NTE4OjE3Nzk4OTQ5MThfVjM)



**模式 B：AI 当审稿人**

```Plain Text
{{文档链接}}阅读一下这篇文档，看下作为提供给外部用户的说明文档，是否足够清晰、简洁。不要直接改文档，只把你觉得有优化空间的位置划词评论出来，在评论里写上修改意见。
```

![Image](https://internal-api-drive-stream.larkoffice.com/space/api/box/stream/download/authcode/?code=MmYxMzM0MWZlZTkwZTAxZDEyMzk1ODJkYjRiZDQ4ZDNfMzg3NDkyYzNkY2IyODQwMGRhMzI3NzBmOGYxNjIzY2NfSUQ6NzYyMjE0MzkwNDY2NTc2Njg0NF8xNzc5ODA4NTE4OjE3Nzk4OTQ5MThfVjM)

**模式 C：****Markdown转飞书文档**

```Plain Text
把这篇 Markdown 内容创建成飞书文档，排版要好看
```

### 场景 3：跨时区多人智能约会

约一个 5 人会议，手动翻日历找共同空闲时间，来回沟通 20 分钟。团队还分布在不同时区，手动算时差更头疼。现在告诉 AI \&\#34;帮我约这个群里的人下周开个会\&\#34;，AI 自动拉群成员、查每个人的日历空闲、考虑所有人的时区，推荐几个\&\#34;所有人都在合理工作时间\&\#34;的选项。你选一个，会就建好了。

```Plain Text
帮我看一下【XX】群里所有人的日历，然后下周找一个大家都合适的时间开一小时的讨论会
```



![Image](https://internal-api-drive-stream.larkoffice.com/space/api/box/stream/download/authcode/?code=Nzc4ZDE0NGQ0OGY5MmFjM2UzMTRjYWVjYTlmYmIyMGNfYWQ5YmVlMjgxOWNjZGI0ZDlhMGVhYWQ4ZmNlODljOTlfSUQ6NzYyMjEyMzYwNDE4MTM3MjExMV8xNzc5ODA4NTE4OjE3Nzk4OTQ5MThfVjM)



### 场景 4：会议审计到多维表格仪表盘

你知道自己每天在开会，但不知道时间到底花在了哪里。一句话，agent 拉取你过去两周的日历数据，自动给每场会议打标签（1:1/产品讨论/团队会/个人事务），写入多维表格，生成仪表盘。饼图看占比，柱状图看趋势。一张图告诉你该砍哪些会。

更进一步：agent 批量分析你的妙记，给每场会打一个\&\#34;产出密度\&\#34;分数，哪些会没有产出任何决策、哪些议题在重复讨论，直接帮团队减负。

```Plain Text
拉取我过去两周的日历，把每个日程分类打标，写入多维表格，然后做一个仪表盘，我要看时间花在了哪里
```

```Plain Text
分析我过去一个月所有的会议妙记，给每场会打个产出分数，告诉我哪些会建议砍掉
```



![Image](https://internal-api-drive-stream.larkoffice.com/space/api/box/stream/download/authcode/?code=YjZjYjRhNDA4MjFhMzM0ZDJmMjU2ZWZmZTMxYjAyZGFfMjhkZmZiMGYxNzMyOTViNjgxZjYwMGIzZGFkNjMwNGVfSUQ6NzYyMjEyMzYwMTQ0OTY2NzUyOF8xNzc5ODA4NTE4OjE3Nzk4OTQ5MThfVjM)

AI根据过往日历信息，自动创建多维表格仪表盘



### 场景 5：未读邮件智能分类与处理

每天收几十封邮件，混杂着通知、审批、客户邮件，手动整理费时费力。AI 定期扫描未读邮件，按优先级分类，重要邮件摘要推送到群聊，低优先级自动归档，还能帮每封邮件起草回复。

**用 CLI 之后**：AI 定期扫描未读邮件，按优先级分类，重要邮件摘要推送到群聊，低优先级自动归档。

> 飞书 CLI 的邮箱能力做了重点增强，补齐了增删改查的完整能力，让飞书邮箱也能融入 AI 工作流。
> 
> 

```Plain Text
查看我所有的未读邮件，重要邮件发摘要到 aurora 项目群，并给每封邮件写一个草稿回复。
```

![Image](https://internal-api-drive-stream.larkoffice.com/space/api/box/stream/download/authcode/?code=ZGQ5ZmQwYzNmYWZjOTUyZjNiOGI3ZmM0NTkyNzJlZTVfMDBlNzFlZTI2ZmUwNmE5NGZiODA4ZTI0YzRjOGI2NjVfSUQ6NzYyMjEyMzYwMzMxOTk2NjkxMV8xNzc5ODA4NTE4OjE3Nzk4OTQ5MThfVjM)

![Image](https://internal-api-drive-stream.larkoffice.com/space/api/box/stream/download/authcode/?code=YmVjYmJkNTkwMzliZWU4ODRhYTI1NDZhYzNiYzNmMmVfZDg4YmFmYTc5MGU1ZmJhNjJmNTNiOWFmZDY2ZmQ5YmNfSUQ6NzYyMjEyMzYwNDE4Mzk3NzE1OF8xNzc5ODA4NTE4OjE3Nzk4OTQ5MThfVjM)



---

## 💗 为什么选择飞书 CLI

### 你的 AI 缺两样东西：context 和手

市面上的 AI 模型都很聪明，但聪明不等于有用。一个 AI 如果不知道你今天开了什么会、跟谁聊了什么、手上有哪些待办，它就只能给你通用的回答。而且就算它知道了，如果不能直接帮你操作飞书，它还是只能说\&\#34;你应该去建个文档\&\#34;，而不是替你建。

飞书 CLI 同时解决了这两个问题：让 AI 拿到你在飞书上沉淀的所有工作 context（消息、文档、日历、妙记、多维表格），同时给它操作这些东西的能力。既能看，也能动手。

### 为 AI 而设计

飞书 CLI 不是把现有 API 简单包装成命令行。它是为 AI Agent 的使用方式专门设计的：出错时告诉 AI 怎么修（不只是\&\#34;错了\&\#34;），缺权限时自动引导补授权，命令设计上优化了 token 消耗。AI 用它的成功率远高于直接调 API。

### 全面开源，自由调用

不管你用 Claude Code、Codex、Cursor 还是其他 Agent，只要能跑命令行，就能通过 CLI 操作飞书。无需登记，无需审核。

### 覆盖全，迭代快

目前覆盖飞书最核心的业务域：**即时消息、云文档、****电子表格****、多维表格、日历、视频会议、邮箱、任务、知识库、通讯录、搜索等**。不少是此前 API 缺失、开发者呼声最高的能力。同时支持用户身份和应用身份两种认证，覆盖个人和企业场景。持续快速迭代中。



---

## 🧾 附录

### 认证与配置

> 执行 `lark\-cli help` 可查看命令总览
> 
> 

|**我想要……**|**命令**|
|---|---|
|初始化应用配置|lark\-cli config init|
|登录（用户身份）|lark\-cli auth login|
|查看当前登录状态|lark\-cli auth status|
|为某个业务域申请权限|lark\-cli auth login \-\-domain \&lt;domain\&gt;|
|检查当前已有权限|lark\-cli auth check|
|登出|lark\-cli auth logout|

### 各业务域核心能力

|**业务域**|**能做什么**|
|---|---|
|消息与群组|搜索消息和群聊、发消息、回复话题、管理成员与表情回应、收发图片文件|
|云文档|创建文档、读取内容、更新正文、插入图片附件、搜索云文档|
|云空间|上传下载文件、整理目录、导入导出文档、管理权限、处理评论|
|电子表格|创建表格、读写单元格、批量追加、查找替换、筛选视图、导出下载|
|多维表格|管理数据表、字段、记录、视图、表单、仪表盘、自动化与权限角色|
|日历|查日程、约会议、查忙闲、推荐时间、预定会议室、回复邀约|
|视频会议|搜索会议、获取纪要和逐字稿、关联日程文档|
|妙记|搜索妙记、下载音视频、获取总结待办章节|
|邮箱|搜索、读取、起草、发送、回复、转发、归档邮件，管理文件夹标签规则|
|任务|创建任务、更新状态、拆分子任务、管理清单和协作成员|
|知识库|查询空间、管理成员、管理节点和文档层级|
|通讯录|查询用户、搜索同事、查看部门|
|幻灯片|创建演示文稿、读取页面内容、增删幻灯片|
|画板|读取画板、导出图片、用 DSL/PlantUML/Mermaid 更新画板|
|OKR|查看周期、管理目标与关键结果、维护对齐关系和量化指标|
|审批|查询审批实例、处理审批任务|
|考勤|查询考勤打卡记录|

---

## 🙋 常见问题

- **飞书 CLI 支持 Claude code、codex 等 AI Agent 平台吗？**

支持。

- **企业管理员有办法去控制权限吗？**

CLI 只是提供一键创建应用的能力，应用的管控仍然 follow 企业统一管控规则。

- **安装后提示命令不存在？**

确认 CLI 所在目录已加入系统 PATH。npm 安装可执行 `npm root \-g` 查看全局目录。

- **授权失败，提示\&\#34;授权码已过期\&\#34;？** 

OAuth 授权码有效期只有几分钟，超时后重新执行 `auth login` 即可。

- **调用 API 提示权限不足？** 

根据报错提示补充授权：`auth login \-\-scope \&\#34;\&lt;missing\_scope\&gt;\&\#34;`。CLI 会告诉你缺少什么权限，并提供申请链接。应用身份调用还需在飞书开放平台后台开通对应权限。

- **如何在自动化任务或 AI 工作流中使用？** 

先在本地完成一次配置和授权，然后把 CLI 接入脚本或 AI Agent 平台即可复用。

- **CLI 和**** OpenClaw ****飞书****官方****插件是什么关系？** 

飞书在 OpenClaw 等平台上的官方插件，底层就是基于这套 CLI 构建的。如果你已经在用飞书插件，不需要再单独安装 CLI——直接用就行。插件的能力会很快和 CLI 对齐。

- **支持国际版 Lark 吗？** 

支持。通过 config init 并配置 国际版 Lark 的应用即可使用。

- **如何获取帮助？** 

执行 `lark\-cli help` 查看命令总览，`lark\-cli \&lt;command\&gt; \-\-help` 查看具体用法，`schema` 命令可快速查询接口详情。



## **入群参与讨论、订阅后续更新**

## ⛲️许愿池

想让 CLI 支持什么新能力？在这里许个愿吧。你可以提交自己的需求，也可以给别人的愿望 \+1。我们会定期查看并回复，票数高的需求会优先安排。你的每一票都在影响我们的迭代计划～💗

- 👉 [点击填表许愿](https://bytedance.larkoffice.com/share/base/form/shrcnFYECazRm9hPygXwLkEhmKf?prefill_%E6%A8%A1%E5%9D%97=CLI)

- 点击 \+1，为你感同身受的许愿投票 （当前需要点击进入[原表格](https://bytedance.larkoffice.com/base/Ebxvb6usfakMENs2GHIcL5Ern2f?table=tbl3HAHYqRF0ZSM6&view=vewUF0arsE)投票）



## 更新日志

1\.0\.8 以上，可使用以下指令一键更新到最新版本：

`lark\-cli update`

### V 1\.0\.41 更新

- 支持本地 PowerPoint（\.pptx）文件直接导入成飞书幻灯片，最大500MB

- 支持用 lark\-cli 编辑妙记了：重命名标题、替换发言人都能一键完成

- 妙记产物里新增了 AI 自动提取的关键词

![Image](https://internal-api-drive-stream.larkoffice.com/space/api/box/stream/download/authcode/?code=ODJhNzU2ODE5MWRmOTFiODllMjdhMDk0YjRmZDJhMzBfNTQ5YzY1YjJiNGY1MzA2NjA1YTlmNjNiMTFlZTZkN2ZfSUQ6NzY0NDE5MDU4MDU4MjUxNzcxMV8xNzc5ODA4NTE4OjE3Nzk4OTQ5MThfVjM)

![Image](https://internal-api-drive-stream.larkoffice.com/space/api/box/stream/download/authcode/?code=MGVjMzI2MDA0NjAyNmQ4YjgwOTA3M2Q1ZWJiMWYxOWVfZjRmYzlkOTc5ZTMxMmVhZDA0YTJkMDU2ZTk3YzNlNGZfSUQ6NzY0NDE5MDU3NzUyOTQwODQ2NV8xNzc5ODA4NTE4OjE3Nzk4OTQ5MThfVjM)

### **V 1\.0\.40更新**

- 一些问题修复和体验优化


**V 1\.0\.39更新**

- 现在可以把飞书幻灯片直接导出为 PPTX 或 PDF 文件了

- 发消息时可以直接在 Markdown 里插入网络图片链接，发出去就能看到图片

- 现在可以给云空间里的普通文件（比如 txt、csv、图片、压缩包等）添加评论了



### **V 1\.0\.38更新**

- 一些问题修复和体验优化



### **V 1\.0\.37更新**

- 可以用 lark\-cli 来部署网页：支持创建、更新、查看、发布 HTML 应用

\[飞书20260526\-151833\.mp4\]

- 知识库空间成员管理上线了：可以一键加人、移除成员、查看成员名单。

- 优化上传文件和创建文档后的飞书链接

- 优化 bot 的文档、表格资源的权限授予提示



### **V 1\.0\.36更新**

- 一些问题修复和体验优化



### **V 1\.0\.35更新**

- 支持对比两个版本的 Markdown 文档，或者把云端文档和本地 \.md 文件对比

- 支持直接获取多维表格表单的字段信息，并一键填写提交，附件会自动上传

- 创建 Markdown 文档时可以直接放到知识库节点下



### **V 1\.0\.34更新**

- 现在可以在多维表格里一次上传、下载或删除多个附件了（单次最多 50 个，每个最大 2GB）

- 支持创建、查询和删除知识库节点，也可以直接新建知识库空间了

- 查看邮件草稿时，可以看到这封草稿的优先级

- 给一个飞书文档或知识库链接，现在可以快速看出它的类型、标题和真实地址

- 把飞书文档导出成 Markdown 现在更干净了



### **V 1\.0\.33更新**

- 云空间支持本地目录和云端文件夹双向同步

- 云空间文件现在可以查看历史版本，并随时下载、回滚或删除某个版本

- Markdown 文件现在可以做局部修改



### **V 1\.0\.32更新**

- 现在可以查看你能访问的所有知识空间列表了

- 可以列出某个知识空间或节点下的全部子节点

- 支持把一个知识库节点（含整个子树）复制到目标空间或目标父节点下

- 在文档里插入图片时，可以指定显示的宽度和高度



### **V 1\.0\.31更新**

- 云盘文件同步新增\&\#34;智能\&\#34;模式，根据修改时间自动跳过没有变化的文件，大批量同步速度提高

- 现在可以在搜索或列出群聊列表时，过滤掉已静音的群，找群更专注不被打扰

- 审批任务现在支持增加审批人和回退到之前的审批节点了



### **V 1\.0\.30更新**

- 支持创建话题群了

![Image](https://internal-api-drive-stream.larkoffice.com/space/api/box/stream/download/authcode/?code=ZGNkNDYxMjcxNmNkZmNiYmExMmEzZGI3NTBhMTRjMDNfYmNkYTcxYWNiMDAzYzZmYTk2YTg4YjE4NjA2OGNkOWRfSUQ6NzYzOTM1MzU4MjUwNDQzMDU0MV8xNzc5ODA4NTE4OjE3Nzk4OTQ5MThfVjM)

- 一些问题修复和体验优化



### **V 1\.0\.29更新**

- 一些问题修复和体验优化



### **V 1\.0\.28更新**

- 支持标记消息/话题，并可以查看标记列表、取消标记，方便随时找回重要内容

```Plain Text
## 帮我查找我在【标签测试1】发送的消息，帮我收藏这个消息       
## 查看我现在消息收藏列表
```



![Image](https://internal-api-drive-stream.larkoffice.com/space/api/box/stream/download/authcode/?code=YzczYzc4MjU3Mzc2NDEwNmViZDc3M2NhZjc0NmU5OTlfOTk1NDYzMjM4NGQ5OTk4MTI1NGI1NzUxZTg3YjgwZDNfSUQ6NzYzODYzNDg1NjE2MzI5ODUyOF8xNzc5ODA4NTE4OjE3Nzk4OTQ5MThfVjM)

- 同步云盘时，如果远端存在多个同名文件，现在可以选择处理方式：失败提示、重命名保留全部、保留最新或保留最旧



### **V 1\.0\.27更新**

- 一些问题修复和体验优化



### **V 1\.0\.26更新**

- 在查消息时,现在每条消息都会带上一条直达链接,点击就能跳到飞书 App 里的原消息

- 一些已知问题修复和体验优化

![Image](https://internal-api-drive-stream.larkoffice.com/space/api/box/stream/download/authcode/?code=Yjk0ZWFlOWI3ODUwMDFkNDM1OWIwZmJmZDE4NzIzZjhfZDhmZmJjMWRlMmZjYTVkMjg2YmJlODNhNTRiNzE5MWJfSUQ6NzYzNzUyMTg5MjM2MjM5MDcxNF8xNzc5ODA4NTE4OjE3Nzk4OTQ5MThfVjM)



### **V 1\.0\.25更新**

- 一些问题修复和体验优化



### **V 1\.0\.24更新**

- 支持给任务上传附件

- 电子表格管理功能优化，支持新建、复制、删除、重命名工作表



### **V 1\.0\.23更新**

- 支持一句话生成一份妙记了：把一个已上传的音视频交给飞书 CLI，就能直接生成对应妙记。

```Shell
帮我把本地的/AI合规需求评审.mp4，生成妙计
```

![Image](https://internal-api-drive-stream.larkoffice.com/space/api/box/stream/download/authcode/?code=OTA1ZTA2NDM2MTk5NTI5MjVhMzEzMDQ0YzNlMjM1YzJfMDRlYTdlOGE1OWQwYWQyZjJkNmUyMGIwY2UwYzhlMmNfSUQ6NzYzNjk5MDU2MzQ3NjM0NDAyN18xNzc5ODA4NTE4OjE3Nzk4OTQ5MThfVjM)

![Image](https://internal-api-drive-stream.larkoffice.com/space/api/box/stream/download/authcode/?code=OGJjZWQ5MWMyN2EzODBmNTE0NzA5ZGNjM2U5YWY5OTdfOTUwNGQxNGRiODhhNGVkMjhmODc2MTQzNTllNTJiZWZfSUQ6NzYzNjk5MDU2MjQzNjUxNzA1NV8xNzc5ODA4NTE4OjE3Nzk4OTQ5MThfVjM)

- 支持本地文件夹一键同步到云空间了。

- 支持直接创建、下载、覆盖云空间里的 Markdown 文件了。

- 支持用飞书 CLI 对比本地文件夹和云空间文件夹的差异。



### **V 1\.0\.22****更新**

- 任务成员支持 AI 智能体作为参与者

- 新建任务时现在可以直接指定关注人

- 新增 42 套官方演示文稿模板，覆盖办公、产品、运营、营销、人事、行政、个人等 8 大场景，做幻灯片时直接套用即可

🌟** 产物**：[个人简介](https://apaascorehr.feishu.cn/slides/XaCYsdvE5lfmwjdUqiQc1uDVnuQ)

```Shell
1. 我想做个幻灯片，现在有哪些模板可以用
```



![Image](https://internal-api-drive-stream.larkoffice.com/space/api/box/stream/download/authcode/?code=NmVmMjYwMzBhNDkxYTc2OTk1NTMwYjIxOTk2ZTU5NDFfYjQxYzkxOWIyNzM1MzAxMWY4NzhiNWJhNWIzOWRiZDJfSUQ6NzYzNjk5MDQ5NTE2MzgyOTQ2Ml8xNzc5ODA4NTE4OjE3Nzk4OTQ5MThfVjM)

```Shell
我想做我的个人简介，选择一个合适的模板帮我创建，后续我会再补充具体信息
```



![Image](https://internal-api-drive-stream.larkoffice.com/space/api/box/stream/download/authcode/?code=MzdkZGYwMTkyZjhlZDY3NjUxNGI2OWUwZjg2OWFhN2ZfY2ZjM2NkYjg1M2U0MmFkZGZhZWVlMmZiMWY3YTNhMjVfSUQ6NzYzNjk5MDQ5NjAzNjAxNTMxMV8xNzc5ODA4NTE4OjE3Nzk4OTQ5MThfVjM)

![Image](https://internal-api-drive-stream.larkoffice.com/space/api/box/stream/download/authcode/?code=MDhhMWEwMzA5ZGRkODE4M2QyNjk1ZmYzMzAzZThiMjFfYTU2ZGU2MmYxMjRhYjE5MDcxYjM3ZTc2MDY1MzRmNTVfSUQ6NzYzNjk5MDQ5NTA4MDM2OTM0MV8xNzc5ODA4NTE4OjE3Nzk4OTQ5MThfVjM)

- 发邮件时可以直接附上日历邀请，对方查收邮件就能一键加入日程

```Shell
我希望给安一全发送一封邮件，邀请他参加明天的会议沟通日程
```

![Image](https://internal-api-drive-stream.larkoffice.com/space/api/box/stream/download/authcode/?code=NzE4ZDZiNzYyNWZmZTQ5NjQ3ODhlOWVlMjJjZWY0ZGJfY2E5Njc5N2ZiYjllZTg5NTFkZGYyNTI2ODUxODhiMDJfSUQ6NzYzNjk5MDQ5Mjg1MDg4Mzc5NF8xNzc5ODA4NTE4OjE3Nzk4OTQ5MThfVjM)

- 现在可以一次性按多个姓名并行搜索同事



### **V 1\.0\.21 更新**

- 查找会议室时支持一次输入多个会议室名称

- 支持管理 OKR 的进展记录（新建、查看、更新、删除），还能在进展里插入图片

- 可以给演示文稿（Slides）添加评论了

- 通讯录支持按\&\#34;聊过天的人\&\#34;、\&\#34;外部联系人\&\#34;等条件筛选，还能看到对方的多语言名字、邮箱、部门等信息

- 支持搜索日历上的日程啦

- 创建日历日程时支持以表格形式展示结果



### **V 1\.0\.20 更新**

- 现在可以把邮件直接分享到群聊或某个人的聊天里

- 发邮件时支持请求\&\#34;已读回执\&\#34;，对方读了会通知你；也可以回送或拒绝已读回执

- 支持修改日程：改标题、改时间、改描述，增加或移除参会人和会议室

- 支持搜索自己云文档（文档、表格、多维表格等）：按关键词、按编辑时间、按评论时间、按创建人等条件查找

- 在群聊消息搜索里可以指定\&\#34;@了谁\&\#34;来过滤结果

- 上传文件时支持直接指定知识库节点作为目标位置

- 支持一次性获取群聊中所有机器人成员的列表

- 文档/表格等文件导入的使用说明更完整，常见类型（Word、纯文本、网页、Excel、CSV）都配了可直接复制的示例



### **V 1\.0\.19 更新**

**✨ 新增能力**

- 写文档、读文档、改文档都提供了全新版本，支持更丰富的结构化编辑方式（按章节替换、按关键词查找、按段落插入等）。

- 发邮件时可以请求对方已读回执了

- 上传文件时，可以直接把文件传到知识库的节点下了



### **V 1\.0\.18 更新**

**✨ 新增能力**

- 支持直接从剪贴板粘贴图片插入到飞书文档中，不用先保存成文件

- 支持将多维表格导出为 \.base 文件，也可以把 \.base 文件导回多维表格

- 支持删除知识库空间

- 支持对幻灯片进行元素级精细编辑，比如替换某一页里的单个图形或文字



### **V 1\.0\.17 更新**

**✨ 新增能力**

- 现在可以一键获取多维表格记录的分享链接了，支持单条或批量获取

- 支持向文档所有者发起权限申请

- 画板支持插入图片



### **V 1\.0\.16 更新**

**✨ 新增能力**

- 支持在文档的指定位置插入图片和文件了，不再只能添加到文档末尾

- 支持获取日历日程的分享链接了



### **V 1\.0\.15 更新**

**✨ 新增能力**

- 支持在电子表格中添加、修改和删除浮动图片

- 审批流程新增了催办功能，还能查看自己发起过的审批记录

- 支持三方单据的审批操作



### **V 1\.0\.14 更新**

**✨ 新增能力**

- 新增了 **OKR** 管理能力

- 发邮件时支持设置定时发送了

- 发邮件时支持设置优先级，可以标记为紧急、普通或低优先级

- 创建或复制多维表格后，你会自动获得完整的操作权限

- 往文档里插入文件时，可以选择卡片、预览播放器、内嵌等的展示方式

- 现在可以直接给电子表格的单元格添加评论

- 知识库现在支持新建知识空间



### **V 1\.0\.13 更新**

✨ **新增能力**

- 用自己的飞书账号发消息时，支持图片、文件、音频、视频

- 应用创建知识库节点后，会自动给用户授权

- 可以直接创建云空间文件夹，并且能指定放到哪个目录下



### **V 1\.0\.12 更新**

**✨ 新增能力**

- 发邮件时可以按名字搜索收件人了

- 发出去的邮件支持24小时内撤回

- 邮件支持添加个性化签名，写信、回复、转发都能自动带上

- 做幻灯片时可以直接插入本地图片



### **V 1\.0\.11 更新**

**新增能力**

- 支持管理表格中的下拉选项了，可以创建、修改、查看和删除下拉列表

- 支持搜索和查询飞书任务，还能设置任务的父子关系、订阅任务变更通知

- 支持按清单搜索任务了



### **V 1\.0\.10 更新**

**✨ 新增能力**

- 知识库现在支持管理成员了，可以添加、移除和查看知识库的成员

- 支持在云空间中创建文件快捷方式了，可以把常用文件的入口放到指定文件夹

- 支持直接修改云空间中文件的标题，支持文档、表格、多维表格、知识库页面及文件夹等

- 添加任务到清单时，可以指定放到某个自定义分组里



### **V 1\.0\.9 更新**

**新增能力**

- **考勤：**支持查询自己的考勤打卡记录

- **幻灯片：**支持创建幻灯片

- **会议：**支持搜索会议录制内容，可以按关键词、参与人、时间等条件进行筛选

- **电子表格：**支持在电子表格中添加、插入、移动和删除行或列；支持在电子表格中合并和拆分单元格、查找替换内容、设置单元格样式

- **云盘：**支持删除云空间中的文件和文件夹



### **V 1\.0\.8 更新**

**新增能力**

- 支持批量添加和修改多维表格中的记录

- 支持按条件筛选多维表格中的记录字段

- 支持在多维表格中搜索记录

- 可以查看和设置多维表格视图中显示哪些字段

- 支持对多维表格的仪表盘进行排版布局，还能添加文字说明块

- 支持下载多维表格中的附件文件

- 画板现在支持导出成图片、代码和原始数据等多种形式

- 支持搜索和预订会议室

- 列出收件箱的邮箱摘要时支持翻页

- 支持给飞书文件的评论回复 reaction



### **V 1\.0\.7 更新**

- 现在可以把本地图片直接写入到电子表格的单元格里了

- 支持在知识库中创建新的文档节点

- 邮件功能升级：可以用别名发送邮件，还能管理邮件规则（自动分类、转发等）

- 搜索文档时，可以按文件夹或知识空间来缩小搜索范围了

- 用飞书应用创建的文档、表格等内容，现在会自动把编辑权限授予给你，不用再手动设置权限了

- 支持预览文档中的图片、视频等媒体文件

- 可以从日历日程中自动获取会议纪要了

- 搜索文档时支持更精确的搜索方式，比如精确匹配关键词、排除不想要的结果、只搜标题等

- 优化云文档导出后的格式



### **V 1\.0\.6 更新**

**新增能力**

- 写邮件时可以直接在正文里引用电脑上的图片了，发送时会自动嵌入邮件

- 新增了「查询会议录制」功能，输入会议号就能找到对应的录制内容，方便后续下载或查看纪要

- 往文档里上传图片或文件时，超大文件（超过 20MB）也能顺利上传了

**✨ 体验优化**

- 完善了任务查询功能的使用说明，现在能更清楚地区分「查全部任务」「查已完成」和「查未完成」



### **V 1\.0\.5 更新**

- 飞书云盘支持上传超过 20 MB 的大文件了

- 支持同时配置多个飞书应用（bot），可以随时新增、切换、重命名或删除。

- 支持根据当前使用的账号类型，自动隐藏不适用的操作，避免误操作报错

- 云文档创建/更新可以直接指定本地文件路径作为内容输入

- 补充多维表格工作流的消息触发节点在群聊和单聊场景下配置方式的差异



### **V 1\.0\.4 更新**

- 现在可以用自己的飞书账号创建群聊了。

- 现在支持移除群成员操作了。

- 修复了一些已知问题



### **V 1\.0\.3 更新**

- 消息的发送和回复支持以自己的账号操作，消息将以本人名义发出，而非以应用名义发送。

- 云空间新增导入、导出、移动文件及查询任务结果的快捷操作。

- 妙记支持批量下载会议媒体文件。

- 新增对命令输出的 JSON 结果进行实时过滤的能力，便于快速提取所需字段。

- 新增审批能力，支持查询、撤回、复制审批，以及同意、拒绝、转交审批任务。

- 安装 CLI 时新增国内镜像源兜底，网络环境受限时下载更稳定。

