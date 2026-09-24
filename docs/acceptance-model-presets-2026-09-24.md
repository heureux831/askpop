# 0.3.0 模型预设与深度思考验收

## 实现

本地模型能力注册表包含 OpenAI、Anthropic、DeepSeek 的 14 个预设。每个预设声明模型 ID、思考参数类型、可否关闭、支持的强度或预算。自定义端点可显式选用兼容预设；官方地址自动识别已登记型号及 deepseek-v4-flash 别名。

深度思考可以开启、关闭或恢复服务商默认。旧配置缺少该字段时不注入思考参数。始终推理的模型不能关闭；未知型号需要选择兼容预设。配置验证在保存之前完成，错误不会覆盖已有 Key。

不同接口的实际请求：

| 类型 | 开启 | 关闭 |
| --- | --- | --- |
| DeepSeek | thinking.enabled + reasoning_effort | thinking.disabled，并移除 effort |
| OpenAI 可关闭型号 | reasoning_effort 为选择的强度 | reasoning_effort 为 none |
| Claude 4.6 | thinking.adaptive + output_config.effort | thinking.disabled |
| Claude 4.5 | thinking.enabled + budget_tokens，并预留回答预算 | thinking.disabled |

## 验证

- 类型检查通过。
- 79 项单元测试通过，包含使用真实 AI SDK + 模拟 HTTP 响应检查实际序列化请求，验证各提供商参数及兼容代理 URL 不被替换。
- Electron 端到端流程通过：选择预设、关闭思考、保存、发出流式请求；随后在设置中开启思考并选 low，再次发出请求，服务器确认实际参数变化。
- 重启后 presetId、thinking、thinkingEffort 和原有 Key 保留。
- 模型设置截图已检查：开关及参数集中在同一区域，表单可滚动，保存按钮固定。长表单需要滚动才能显示地址和 Key。
- 打包产物和包内运行依赖检查通过。

测试使用隔离配置和本地模拟服务；没有修改用户的真实模型设置。本轮没有对所有服务商执行付费 API 调用。模型预设目录不保证账户权限或未来接口可用性。

## 产物

- dist/mac-arm64/AskPop.app
- dist/AskPop-0.3.0-arm64.dmg
- test-results/model-thinking.png

目前为本地 0.3.0 构建，未执行 GitHub Release 发布。Apple Silicon 安装包未签名／公证。

参考资料及设计说明见 [model-presets.md](design/model-presets.md)。
