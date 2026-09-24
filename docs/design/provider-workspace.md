# 服务商、模型与快捷任务工作台

本轮使用 frontend-design Skill，延续桌面工具而非网页营销布局。白色 #FAFBFD、侧栏 #F0F3F7、正文 #243247、次要文字 #7B8798、交互蓝 #356DE8、状态绿 #368575。SF Pro/苹方用于界面，等宽字体只用于 API ID。

布局左对齐，三级导航：应用设置导航 → 带本地 SVG 标志的服务商列表 → 服务商连接表单及模型表格。模型行区分 API ID、显示名称、温度。助手使用按服务商分组的模型选择器。快捷任务独立管理，可增删、上下排序及编辑提示词。

```
模型服务 | [logo] OpenAI    | [logo] DeepSeek       保存服务商
助手管理 | [logo] DeepSeek  | 地址 / Key
快捷任务 | [logo] Claude    | 模型       API ID       温度
通用设置 | …               | + 添加模型
```

复核：保留既有工作台的安静风格，辨识度来自服务商品牌标志与模型表格，减少重复卡片。思考展示为 144px 高的矩形内容区，12px 字号，独立滚动；正文开始输出时折叠为一行，可重新展开。只在答案文本更新时跟随主对话滚动。

参考概念，不复制 Cherry Studio 实现：
- https://github.com/CherryHQ/cherry-studio/blob/main/docs/references/provider-model/provider-registry.md
- https://github.com/CherryHQ/cherry-studio/blob/main/packages/provider-registry/data/providers.json
- https://api-docs.deepseek.com/guides/thinking_mode/
- https://ai.google.dev/gemini-api/docs/openai
- https://docs.ollama.com/api/openai-compatibility

SVG 使用 Lobe Icons（MIT），归属及许可证保留在 THIRD_PARTY_NOTICES.md。

截图复核：服务商标志与行表格在同一视图中可辨认；缩短连接表单间距后露出更多模型。补上任务选中底色和对应图标，让排序时当前任务明确。长表单自然滚动，保存动作留在固定底栏。思考框采用纯文本，避免 Markdown 布局波动；追加长内容时窗口与主滚动位置由端到端测试锁定验证。
