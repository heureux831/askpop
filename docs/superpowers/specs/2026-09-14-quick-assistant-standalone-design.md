# Quick Assistant 独立版 — 设计文档

- 日期：2026-09-14
- 状态：设计已批准，待实现计划
- 范围：把 Cherry Studio 的「快捷助手」功能剥离为一个独立、更轻量的 macOS 桌面应用

## 1. 背景与目标

Cherry Studio 的快捷助手（Quick Assistant）是一个悬浮面板，提供对话 / 翻译 / 总结 / 解释 四个功能。目标是把这一功能剥离为一个**独立、更轻量**的桌面应用，长期独立维护。

与用户的澄清对话确定的诉求：

| 维度 | 决定 |
|------|------|
| 核心动机 | 做一个更轻量的独立产品 |
| 模型配置 | 极简——几个主流供应商 + 简单 Key/模型选择 |
| 功能范围 | 对话 / 翻译 / 总结 / 解释 全保留 |
| 平台 | macOS 优先 |
| App 形态 | 普通 App（带 Dock 图标） |
| 设置入口 | 独立设置窗口 |
| 分发 | 暂时仅自用/小范围 |

## 2. 许可证约束

Cherry Studio 采用 **AGPL-3.0**。当前「仅自用/小范围」场景下，AGPL 的分发义务暂不触发，可自由复用现有代码加速开发。需记录：若未来对外分发，须满足其一——(a) 以 AGPL 开源；(b) 对复用部分净室重写；(c) 向版权方购买商业许可。

## 3. 技术路线

**路线 B：全新最小项目 + 复用现有 UI。**

核心逻辑：新建最小 Electron + React 项目，把快捷助手的 UI 与窗口配置直接搬过来（自用场景下合法），只重写后端（配置 + 流式），砍掉整个 `src/main/ai` 引擎。

| 部分 | 处理 | 说明 |
|------|------|------|
| 悬浮窗 NSPanel 配置 | 抄 | `windowRegistry.ts` 的 `WindowType.QuickAssistant` 条目 |
| HomeWindow + 子组件 | 搬 | FeatureMenus / InputBar / Footer / ClipboardPreview |
| TranslateWindow | 搬 + 简化 | 去掉多模型翻译，改单模型 + 系统提示词 |
| 对话流式 | 重写 | Vercel AI SDK 直连 |
| 模型 / 供应商 / Key 管理 | 重写 | 手写 3–5 个供应商 + `safeStorage` 存 Key |
| 设置窗口 | 新建 | 一个小 React 窗口 |
| 总结 / 解释 | 重写 | 本质是「chat + 系统提示词」 |

## 4. 技术栈

- **Electron + React + TypeScript + Vite**（electron-vite 模板）
- **Vercel AI SDK**：`ai` / `@ai-sdk/react` / `@ai-sdk/openai` / `@ai-sdk/anthropic`
- **UI**：Tailwind + shadcn/ui（抄 `@cherrystudio/ui` 所需的 Scrollbar / Separator 等组件）

## 5. 目录结构

```
quick-assistant-app/
├── electron.vite.config.ts
├── src/
│   ├── main/
│   │   ├── index.ts            # app 生命周期、全局快捷键唤起、窗口管理
│   │   ├── windows/
│   │   │   ├── quickWindow.ts   # 悬浮 NSPanel（抄 windowRegistry 配置）
│   │   │   └── settingsWindow.ts # 设置窗口
│   │   ├── config/
│   │   │   ├── store.ts         # 配置持久化（JSON 文件）
│   │   │   ├── secretStore.ts   # API Key 用 safeStorage 加密
│   │   │   └── providers.ts     # 3–5 个供应商定义
│   │   └── ipc/
│   │       ├── config.ts        # 读/写配置
│   │       └── chat.ts          # 流式桥（主进程 streamText，IPC 推 chunk）
│   ├── preload/index.ts         # contextBridge 暴露安全 API
│   ├── shared/
│   │   └── config.ts            # 配置类型 + 默认值
│   └── renderer/
│       ├── quick/               # 悬浮窗（搬 HomeWindow + 全部子组件）
│       │   ├── HomeWindow.tsx / FeatureMenus.tsx / InputBar.tsx
│       │   ├── Footer.tsx / ClipboardPreview.tsx
│       │   ├── ChatWindow.tsx / TranslateWindow.tsx
│       └── settings/            # 设置窗口（新建）
│           └── SettingsPage.tsx
```

## 6. 数据流

### 6.1 流式对话（主进程桥接）

API Key 只存在主进程（`safeStorage` 加密）。主进程用 AI SDK `streamText` 发起请求，通过 IPC 把 token 逐块推给渲染进程；渲染进程用 `useChat` + 一个极简 transport 接收。与 Cherry Studio 的 `ipcChatTransport` 架构一致，但实现量小两个数量级（无 topic、execution overlay、多模型路由）。

### 6.2 翻译 / 总结 / 解释

三者本质都是「单次流式补全 + 一个系统提示词」，复用同一条流式桥。翻译用 `useTranslate` 的简化版；总结 / 解释就是 chat 带固定提示词。

## 7. 供应商配置（极简）

```ts
providers = [
  { id: 'openai',    baseURL: 'https://api.openai.com/v1',    models: ['gpt-4o', ...] },
  { id: 'anthropic', baseURL: 'https://api.anthropic.com/v1', models: ['claude-...'] },
  { id: 'custom',    baseURL: '<用户填>',                      models: [手动输入] }
]
```

设置窗口：选供应商 → 填 Key → 选/填模型。首版模型列表用「预设 + 手动输入 model ID」，不做 `/models` 端点自动拉取。

## 8. 错误处理

- 未配置 Key → 悬浮窗提示「请先在设置中配置」并一键打开设置窗口。
- 流式 / 网络错误 → 复用 HomeWindow 现有的 `flowError` 展示区。
- Key 失效（401）→ 提示并引导到设置。

## 9. 非目标（YAGNI）

v1 明确砍掉：多模型路由、Agent、tool calling、MCP、历史记录、marketplace、主题系统（只留浅色/深色）、完整 i18n（首版只做中文，文案硬编码，不引入 `i18next`）。

## 10. 测试

- 主进程：`store` / `secretStore` / 供应商解析 / IPC handler（Vitest）。
- 渲染：HomeWindow 键盘交互、FeatureMenus、设置表单校验。
- 端到端：可选 Playwright，首版不强求。

## 11. 已确认的默认决策

1. 流式走「主进程桥接」而非渲染进程直连（Key 不进渲染层）。
2. 首版只做中文，不引入 i18n。
3. 模型列表 = 预设 + 手动输入，不做自动拉取。
