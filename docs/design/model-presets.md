# 模型预设与深度思考

沿用 frontend-design 的桌面设置方向：纸白 #FAFBFD、侧栏 #F0F3F7、墨蓝 #243247、辅助灰 #7B8798、交互蓝 #356DE8、成功绿 #368575。SF Pro／苹方用于名称与表单，模型 ID 使用等宽字体。全部左对齐。

布局：供应商 → 模型预设 → 模型 ID → 深度思考开关与支持的参数 → 地址与 Key。保存始终位于固定底栏。

```
供应商 [DeepSeek]
模型预设 [DeepSeek Flash]
模型 ID [deepseek-flash]
深度思考                         [开关]
沿用服务商默认 / 已自定义          恢复默认
思考强度 [高]
API 地址 / Key
```

复核：只显示当前预设支持的思考强度或预算。未知模型不猜测请求参数；提示选择兼容预设。始终推理的模型禁用关闭操作并解释原因。保留“服务商默认”语义，避免升级后静默更改旧模型行为。参数预设以本地注册表维护，可离线使用；自定义地址不因选择预设而被替换。

参考概念（未复制实现）：
- Pi 将模型目录、协议兼容性与可用 thinking levels 分开：https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/models.md
- OpenCode 按 provider/model 管理 options 与 variants：https://opencode.ai/docs/models/
- DeepSeek thinking.type 和 reasoning_effort：https://api-docs.deepseek.com/guides/thinking_mode/
- OpenAI GPT-5.4 reasoning effort：https://developers.openai.com/api/docs/models/gpt-5.4
- Anthropic extended/adaptive thinking：https://platform.claude.com/docs/en/build-with-claude/extended-thinking

本轮内置 OpenAI、Anthropic、DeepSeek 常用型号，保留手填模型 ID 和显式兼容预设；不依赖远程模型目录可用性。模型存在于预设不代表账户有调用权限。
