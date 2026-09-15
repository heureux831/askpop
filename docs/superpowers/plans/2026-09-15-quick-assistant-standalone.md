# Quick Assistant 独立版 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从零构建一个 macOS 轻量悬浮快捷助手桌面应用，提供对话 / 翻译 / 总结 / 解释 四个功能。

**Architecture:** Electron + React + Vite（electron-vite 双页：`quick.html` 悬浮窗 + `settings.html` 设置窗）。API Key 只存主进程（`safeStorage` 加密）；主进程用 Vercel AI SDK `streamText` 发起请求，通过 IPC 把 token 逐块推给渲染进程；渲染进程用自定义 `useChatStream` hook 累积。悬浮窗复用 Cherry Studio 的 NSPanel 窗口配置，叶子 UI 组件（FeatureMenus/InputBar/Footer/ClipboardPreview）搬移适配，消息渲染与编排逻辑全新重写。

**Tech Stack:** Electron 33 · React 18 · TypeScript 5.6 · electron-vite 2 · Vite 5 · Tailwind 3 · Vercel AI SDK v4（`ai` + `@ai-sdk/openai` + `@ai-sdk/anthropic`）· Vitest 2 · react-hotkeys-hook · lucide-react。

## Global Constraints

- **平台：仅 macOS。** 不写任何 Windows/Linux 分支代码。悬浮窗用 `type: 'panel'`（NSPanel）+ `transparent: true` + `vibrancy`。
- **仅中文文案。** 不引入 `i18next`；所有用户可见字符串直接硬编码为中文。
- **主题：只留浅色/深色。** 不引入完整主题系统，仅支持跟随系统 + 手动切换明暗。
- **供应商：`openai` / `anthropic` / `custom`（OpenAI 兼容）三种。** 模型列表 = 预设默认 + 手动输入 model ID，不做 `/models` 端点自动拉取。
- **API Key 永不进入渲染进程。** `config:get` 只返回 `hasApiKey: boolean`，不返回明文。
- **命名与目录：** 主进程在 `src/main/`，渲染进程在 `src/renderer/`（`quick/` 与 `settings/` 两个子目录），共享类型在 `src/shared/`。
- **测试：** 纯逻辑（store / secretStore / resolve / streamManager / useChatStream / 设置校验）必须 Vitest 覆盖；UI 叶子组件与窗口配置用构建/冒烟验证。禁止行为钉死型测试（只断言「当前实现输出什么」的测试没有价值）。

## 计划相对 spec 的三处修正（更轻、更简单）

1. **消息渲染链 + HomeWindow 是「重写」而非「搬」。** `HomeWindow.tsx`（533 行）与 `Messages.tsx` / `Message.tsx` 深度耦合 Cherry Studio 的 execution overlay、message parts、`MessageContentProvider`。直接搬会拖入半个渲染层，违背「轻量」。改为重写一个极简的 `HomeWindow`（~150 行）+ `MessageList`（纯文本 + 简单 markdown）。
2. **去掉 `@ai-sdk/react` 的 `useChat`。** 手写一个 `ChatTransport` 需要精确匹配 AI SDK v5 内部接口，脆弱且不必要。改为 `ai` 核心包在主进程 `streamText`，渲染进程用自定义 `useChatStream` hook（~80 行），完全可控。
3. **手写 4 个极简 UI 组件替代 shadcn CLI。** `Input` / `Separator` / `Scrollbar` / `Tooltip` 用 Tailwind + 原生元素（Scrollbar 用原生 `overflow-y-auto` + 自定义滚动条 CSS，Tooltip 用 `title` 属性）即可，避免 shadcn CLI 的交互式初始化和 Radix 依赖。

---

### Task 1: 脚手架（Electron + Vite + React + Tailwind）

**Files:**
- Create: `package.json`, `electron.vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`, `tailwind.config.js`, `postcss.config.js`, `.gitignore`
- Create: `src/renderer/quick.html`, `src/renderer/settings.html`, `src/renderer/quick/main.tsx`, `src/renderer/settings/main.tsx`, `src/renderer/assets/main.css`
- Create: `src/main/index.ts`, `src/preload/index.ts`

**Interfaces:**
- Produces: 可运行的空壳 App，`pnpm dev` 弹出两个空窗口（quick + settings）。后续任务在此骨架上叠加。

- [ ] **Step 1: 写 `package.json`**

```json
{
  "name": "quick-assistant-app",
  "version": "0.1.0",
  "description": "A lightweight floating quick-assistant for macOS",
  "main": "./out/main/index.js",
  "type": "module",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "typecheck": "tsc --noEmit -p tsconfig.node.json && tsc --noEmit -p tsconfig.web.json",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "ai": "^4.0.0",
    "@ai-sdk/openai": "^1.0.0",
    "@ai-sdk/anthropic": "^1.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "electron": "^33.0.0",
    "electron-vite": "^2.3.0",
    "jsdom": "^25.0.0",
    "lucide-react": "^0.451.0",
    "postcss": "^8.4.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hotkeys-hook": "^4.5.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: 写 `electron.vite.config.ts`（双渲染入口 + 路径别名）**

```ts
import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@renderer': resolve('src/renderer')
      }
    },
    build: {
      rollupOptions: {
        input: {
          quick: resolve('src/renderer/quick.html'),
          settings: resolve('src/renderer/settings.html')
        }
      }
    }
  }
})
```

- [ ] **Step 3: 写 tsconfig 三件套**

`tsconfig.json`：

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ]
}
```

`tsconfig.node.json`：

```json
{
  "compilerOptions": {
    "composite": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "types": ["node", "electron-vite/node"],
    "baseUrl": ".",
    "paths": { "@shared/*": ["src/shared/*"] }
  },
  "include": ["src/main/**/*", "src/preload/**/*", "src/shared/**/*", "electron.vite.config.ts"]
}
```

`tsconfig.web.json`：

```json
{
  "compilerOptions": {
    "composite": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"],
      "@renderer/*": ["src/renderer/*"]
    }
  },
  "include": ["src/renderer/**/*", "src/shared/**/*"]
}
```

- [ ] **Step 4: 写 `tailwind.config.js`、`postcss.config.js`、`.gitignore`**

```js
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: { extend: {} },
  plugins: []
}
```

```js
// postcss.config.js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } }
```

`.gitignore`：

```
node_modules
out
dist
*.log
```

- [ ] **Step 5: 写两个 HTML 入口 + 各自的 main.tsx + 全局样式**

`src/renderer/quick.html` 与 `src/renderer/settings.html` 结构相同（仅 `<title>` 与 `<script>` 入口不同）：

```html
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>快捷助手</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./quick/main.tsx"></script>
  </body>
</html>
```

`src/renderer/assets/main.css`：

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`src/renderer/quick/main.tsx` 与 `src/renderer/settings/main.tsx`（本任务最小版本）：

```tsx
import '../assets/main.css'
import { createRoot } from 'react-dom/client'

createRoot(document.getElementById('root')!).render(<div>quick</div>)
```

- [ ] **Step 6: 写最小 `src/main/index.ts` 与 `src/preload/index.ts`**

`src/main/index.ts`（本任务只开两个空窗口，窗口细节后续任务替换）：

```ts
import { app, BrowserWindow } from 'electron'
import { join } from 'path'

function createWindow(html: string) {
  const win = new BrowserWindow({ width: 600, height: 500, show: false })
  win.on('ready-to-show', () => win.show())
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/${html}`)
  } else {
    win.loadFile(join(__dirname, `../renderer/${html}`))
  }
  return win
}

app.whenReady().then(() => {
  createWindow('quick.html')
  createWindow('settings.html')
})

app.on('window-all-closed', () => app.quit())
```

`src/preload/index.ts`（最小）：

```ts
import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('api', {})
```

- [ ] **Step 7: 安装依赖并跑通 dev**

Run: `pnpm install && pnpm dev`
Expected: 弹出两个窗口（quick 显示 "quick"，settings 显示 "settings"），无报错。

- [ ] **Step 8: 提交**

```bash
git add -A
git commit -m "chore: scaffold electron-vite react app with two windows"
```

---

### Task 2: 共享配置与 IPC 类型

**Files:**
- Create: `src/shared/config.ts`, `src/shared/ipc.ts`
- Test: `src/shared/__tests__/config.test.ts`

**Interfaces:**
- Produces:
  - `type ProviderId = 'openai' | 'anthropic' | 'custom'`
  - `interface ProviderDef { id; label; defaultBaseURL; defaultModel }`
  - `const PROVIDERS: ProviderDef[]`（三项，`custom` 的 defaultBaseURL/defaultModel 为空字符串）
  - `interface StoredConfig { providerId; baseURL; modelId; hotkey }`
  - `const DEFAULT_CONFIG: StoredConfig`
  - `interface PublicConfig { providerId; baseURL; modelId; hasApiKey; hotkey }`
  - `interface ResolvedConfig { providerId; baseURL; modelId; apiKey; hotkey }`
  - `const IPC = { channels, events }`（所有 IPC 通道名的唯一来源）

- [ ] **Step 1: 写失败测试**

`src/shared/__tests__/config.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, PROVIDERS } from '../config'

describe('PROVIDERS', () => {
  it('包含 openai / anthropic / custom 三项', () => {
    expect(PROVIDERS.map((p) => p.id)).toEqual(['openai', 'anthropic', 'custom'])
  })

  it('custom 供应商默认 baseURL/model 为空，由用户填写', () => {
    const custom = PROVIDERS.find((p) => p.id === 'custom')!
    expect(custom.defaultBaseURL).toBe('')
    expect(custom.defaultModel).toBe('')
  })

  it('openai 与 anthropic 提供非空默认 baseURL 和 model', () => {
    for (const p of PROVIDERS.filter((p) => p.id !== 'custom')) {
      expect(p.defaultBaseURL).not.toBe('')
      expect(p.defaultModel).not.toBe('')
    }
  })
})

describe('DEFAULT_CONFIG', () => {
  it('默认供应商为 openai，model/baseURL 留空以回退到供应商默认值', () => {
    expect(DEFAULT_CONFIG.providerId).toBe('openai')
    expect(DEFAULT_CONFIG.modelId).toBe('')
    expect(DEFAULT_CONFIG.baseURL).toBe('')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm exec vitest run src/shared/__tests__/config.test.ts`
Expected: FAIL（模块 `../config` 不存在）

- [ ] **Step 3: 实现**

`src/shared/config.ts`：

```ts
export type ProviderId = 'openai' | 'anthropic' | 'custom'

export interface ProviderDef {
  id: ProviderId
  label: string
  defaultBaseURL: string
  defaultModel: string
}

export const PROVIDERS: ProviderDef[] = [
  { id: 'openai', label: 'OpenAI', defaultBaseURL: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
  {
    id: 'anthropic',
    label: 'Anthropic',
    defaultBaseURL: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-20241022'
  },
  { id: 'custom', label: 'Custom（OpenAI 兼容）', defaultBaseURL: '', defaultModel: '' }
]

export interface StoredConfig {
  providerId: ProviderId
  baseURL: string
  modelId: string
  hotkey: string
}

export const DEFAULT_CONFIG: StoredConfig = {
  providerId: 'openai',
  baseURL: '',
  modelId: '',
  hotkey: 'CommandOrControl+Shift+Space'
}

export interface PublicConfig {
  providerId: ProviderId
  baseURL: string
  modelId: string
  hasApiKey: boolean
  hotkey: string
}

export interface ResolvedConfig {
  providerId: ProviderId
  baseURL: string
  modelId: string
  apiKey: string
  hotkey: string
}
```

`src/shared/ipc.ts`：

```ts
export const IPC = {
  channels: {
    configGet: 'config:get',
    configSet: 'config:set',
    configSetKey: 'config:setKey',
    chatStream: 'chat:stream',
    chatAbort: 'chat:abort',
    quickHide: 'quick:hide',
    quickSetPin: 'quick:setPin'
  },
  events: {
    chatChunk: 'chat:chunk',
    chatDone: 'chat:done',
    chatError: 'chat:error',
    quickShown: 'quick:shown'
  }
} as const
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm exec vitest run src/shared/__tests__/config.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat(shared): add config types, providers list, and ipc channel map"
```

---

### Task 3: 主进程配置持久化（store）

**Files:**
- Create: `src/main/config/store.ts`
- Test: `src/main/config/__tests__/store.test.ts`

**Interfaces:**
- Consumes: `StoredConfig`, `DEFAULT_CONFIG` from `@shared/config`
- Produces: `loadConfig(): StoredConfig`、`saveConfig(cfg: StoredConfig): void`、`getConfigPath(): string`（供测试注入临时目录）

- [ ] **Step 1: 写失败测试**

`src/main/config/__tests__/store.test.ts`：

```ts
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_CONFIG, type StoredConfig } from '@shared/config'
import { loadConfig, saveConfig, setConfigPath } from '../store'

describe('config store', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'qa-store-'))
    setConfigPath(join(dir, 'config.json'))
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('文件不存在时返回默认配置', () => {
    expect(loadConfig()).toEqual(DEFAULT_CONFIG)
  })

  it('保存后能读回，并写入磁盘 JSON', () => {
    const cfg: StoredConfig = { providerId: 'anthropic', baseURL: '', modelId: 'claude-3-5-sonnet-20241022', hotkey: 'Cmd+Space' }
    saveConfig(cfg)
    expect(loadConfig()).toEqual(cfg)
    const raw = JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8'))
    expect(raw.providerId).toBe('anthropic')
  })

  it('读到非法 JSON 时回退默认值且不抛异常', () => {
    writeFileSync(join(dir, 'config.json'), '{not json', 'utf8')
    expect(loadConfig()).toEqual(DEFAULT_CONFIG)
  })

  it('部分字段缺失时用默认值补齐', () => {
    writeFileSync(join(dir, 'config.json'), JSON.stringify({ providerId: 'custom' }), 'utf8')
    expect(loadConfig()).toEqual({ ...DEFAULT_CONFIG, providerId: 'custom' })
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm exec vitest run src/main/config/__tests__/store.test.ts`
Expected: FAIL（`../store` 不存在）

- [ ] **Step 3: 实现**

`src/main/config/store.ts`：

```ts
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

import { DEFAULT_CONFIG, type StoredConfig } from '@shared/config'

let configPath = ''

export function setConfigPath(path: string): void {
  configPath = path
}

export function getConfigPath(): string {
  if (configPath) return configPath
  return join(app.getPath('userData'), 'config.json')
}

export function loadConfig(): StoredConfig {
  const path = getConfigPath()
  if (!existsSync(path)) return { ...DEFAULT_CONFIG }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<StoredConfig>
    return { ...DEFAULT_CONFIG, ...raw }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveConfig(cfg: StoredConfig): void {
  writeFileSync(getConfigPath(), JSON.stringify(cfg, null, 2), 'utf8')
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm exec vitest run src/main/config/__tests__/store.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat(main): add config store with json persistence"
```

---

### Task 4: 主进程 API Key 安全存储（secretStore）

**Files:**
- Create: `src/main/config/secretStore.ts`
- Test: `src/main/config/__tests__/secretStore.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `setApiKey(plain: string): void`、`getApiKey(): string | null`、`setCipherProvider(fn)`（测试注入加解密，替代真实 `safeStorage`）

- [ ] **Step 1: 写失败测试**

`src/main/config/__tests__/secretStore.test.ts`：

```ts
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { getApiKey, setApiKey, setCipherProvider, setSecretPath } from '../secretStore'

describe('secretStore', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'qa-secret-'))
    setSecretPath(join(dir, 'secrets.bin'))
    // 注入一个可逆的伪加解密：Base64，模拟 safeStorage.encryptString/decryptString
    setCipherProvider({
      encrypt: (s: string) => Buffer.from(s, 'utf8').toString('base64'),
      decrypt: (b: Buffer) => Buffer.from(b.toString('utf8'), 'base64').toString('utf8')
    })
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('未设置时返回 null', () => {
    expect(getApiKey()).toBeNull()
  })

  it('设置后能读回明文', () => {
    setApiKey('sk-test-123')
    expect(getApiKey()).toBe('sk-test-123')
  })

  it('密钥落盘为密文而非明文', () => {
    setApiKey('sk-secret')
    const raw = require('fs').readFileSync(join(dir, 'secrets.bin'), 'utf8')
    expect(raw).not.toContain('sk-secret')
  })

  it('密文无法解密时返回 null 而不抛异常', () => {
    require('fs').writeFileSync(join(dir, 'secrets.bin'), Buffer.from('garbage', 'utf8'))
    expect(getApiKey()).toBeNull()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm exec vitest run src/main/config/__tests__/secretStore.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

`src/main/config/secretStore.ts`：

```ts
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app, safeStorage } from 'electron'

interface CipherProvider {
  encrypt(plain: string): string
  decrypt(data: Buffer): string
}

let secretPath = ''
let cipher: CipherProvider | null = null

export function setSecretPath(path: string): void {
  secretPath = path
}

export function setCipherProvider(p: CipherProvider | null): void {
  cipher = p
}

function getSecretFilePath(): string {
  if (secretPath) return secretPath
  return join(app.getPath('userData'), 'secrets.bin')
}

function getCipher(): CipherProvider {
  if (cipher) return cipher
  return {
    encrypt: (plain) => safeStorage.encryptString(plain).toString('base64'),
    decrypt: (data) => safeStorage.decryptString(Buffer.from(data.toString('utf8'), 'base64'))
  }
}

export function setApiKey(plain: string): void {
  if (!plain) {
    setSecretFilePathAndClear()
    return
  }
  const encrypted = getCipher().encrypt(plain)
  writeFileSync(getSecretFilePath(), Buffer.from(encrypted, 'utf8'))
}

export function getApiKey(): string | null {
  if (!existsSync(getSecretFilePath())) return null
  try {
    return getCipher().decrypt(readFileSync(getSecretFilePath()))
  } catch {
    return null
  }
}

function setSecretFilePathAndClear(): void {
  try {
    writeFileSync(getSecretFilePath(), Buffer.alloc(0))
  } catch {
    // 忽略清除失败
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm exec vitest run src/main/config/__tests__/secretStore.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat(main): add api key secret store backed by safeStorage"
```

---

### Task 5: 配置解析与模型解析（resolve）

**Files:**
- Create: `src/main/config/resolve.ts`
- Test: `src/main/config/__tests__/resolve.test.ts`

**Interfaces:**
- Consumes: `loadConfig`/`saveConfig` from `./store`；`getApiKey`/`setApiKey` from `./secretStore`；`PROVIDERS`/`ResolvedConfig`/`PublicConfig` from `@shared/config`
- Produces: `getResolvedConfig(): ResolvedConfig`、`getPublicConfig(): PublicConfig`、`resolveModel(cfg: ResolvedConfig): LanguageModel`

- [ ] **Step 1: 写失败测试**

`src/main/config/__tests__/resolve.test.ts`：

```ts
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DEFAULT_CONFIG } from '@shared/config'
import { getPublicConfig, getResolvedConfig, resolveModel } from '../resolve'
import { setApiKey, setCipherProvider, setSecretPath } from '../secretStore'
import { setConfigPath, saveConfig } from '../store'

describe('getResolvedConfig', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'qa-resolve-'))
    setConfigPath(join(dir, 'config.json'))
    setSecretPath(join(dir, 'secrets.bin'))
    setCipherProvider({
      encrypt: (s) => Buffer.from(s).toString('base64'),
      decrypt: (b) => Buffer.from(b.toString(), 'base64').toString()
    })
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('baseURL/modelId 留空时回退到供应商默认值', () => {
    saveConfig({ ...DEFAULT_CONFIG, providerId: 'openai' })
    const cfg = getResolvedConfig()
    expect(cfg.baseURL).toBe('https://api.openai.com/v1')
    expect(cfg.modelId).toBe('gpt-4o')
  })

  it('显式填写的 baseURL/modelId 优先于默认值', () => {
    saveConfig({ ...DEFAULT_CONFIG, providerId: 'openai', baseURL: 'https://x.com/v1', modelId: 'my-model' })
    expect(getResolvedConfig().baseURL).toBe('https://x.com/v1')
    expect(getResolvedConfig().modelId).toBe('my-model')
  })

  it('apiKey 从 secretStore 读出', () => {
    saveConfig(DEFAULT_CONFIG)
    setApiKey('sk-abc')
    expect(getResolvedConfig().apiKey).toBe('sk-abc')
  })

  it('getPublicConfig 不泄露 apiKey，只暴露 hasApiKey', () => {
    saveConfig(DEFAULT_CONFIG)
    setApiKey('sk-abc')
    const pub = getPublicConfig()
    expect(pub).not.toHaveProperty('apiKey')
    expect(pub.hasApiKey).toBe(true)
  })
})

describe('resolveModel', () => {
  it('anthropic 走 createAnthropic，其余走 createOpenAI', () => {
    const anthropic = resolveModel({ providerId: 'anthropic', baseURL: 'https://api.anthropic.com/v1', modelId: 'claude-3-5-sonnet-20241022', apiKey: 'k', hotkey: '' })
    const openai = resolveModel({ providerId: 'openai', baseURL: 'https://api.openai.com/v1', modelId: 'gpt-4o', apiKey: 'k', hotkey: '' })
    expect(anthropic.modelId).toBe('claude-3-5-sonnet-20241022')
    expect(openai.modelId).toBe('gpt-4o')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm exec vitest run src/main/config/__tests__/resolve.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

`src/main/config/resolve.ts`：

```ts
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'

import { PROVIDERS, type PublicConfig, type ResolvedConfig } from '@shared/config'

import { getApiKey } from './secretStore'
import { loadConfig } from './store'

export function getResolvedConfig(): ResolvedConfig {
  const stored = loadConfig()
  const provider = PROVIDERS.find((p) => p.id === stored.providerId) ?? PROVIDERS[0]
  return {
    providerId: stored.providerId,
    baseURL: stored.baseURL || provider.defaultBaseURL,
    modelId: stored.modelId || provider.defaultModel,
    apiKey: getApiKey() ?? '',
    hotkey: stored.hotkey
  }
}

export function getPublicConfig(): PublicConfig {
  const c = getResolvedConfig()
  return {
    providerId: c.providerId,
    baseURL: c.baseURL,
    modelId: c.modelId,
    hasApiKey: c.apiKey !== '',
    hotkey: c.hotkey
  }
}

export function resolveModel(cfg: ResolvedConfig): LanguageModel {
  if (cfg.providerId === 'anthropic') {
    return createAnthropic({ apiKey: cfg.apiKey })(cfg.modelId)
  }
  return createOpenAI({ baseURL: cfg.baseURL, apiKey: cfg.apiKey })(cfg.modelId)
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm exec vitest run src/main/config/__tests__/resolve.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat(main): resolve config and provider model"
```

---

### Task 6: 流式桥（streamManager）

**Files:**
- Create: `src/main/chat/streamManager.ts`
- Test: `src/main/chat/__tests__/streamManager.test.ts`

**Interfaces:**
- Consumes: `getResolvedConfig`/`resolveModel` from `../config/resolve`；`IPC.events` from `@shared/ipc`
- Produces: `class StreamManager { run(sender, req); abortFor(sender) }`、`const streamManager = new StreamManager()`

- [ ] **Step 1: 写失败测试**

`src/main/chat/__tests__/streamManager.test.ts`：

```ts
import { describe, expect, it, vi } from 'vitest'
import type { WebContents } from 'electron'

import { StreamManager } from '../streamManager'
import { getResolvedConfig, resolveModel } from '../../config/resolve'

vi.mock('../../config/resolve', () => ({
  getResolvedConfig: vi.fn(),
  resolveModel: vi.fn()
}))

const mockSender = () => {
  const sent: Array<[string, unknown]> = []
  const sender = {
    id: 1,
    send: (ch: string, payload: unknown) => sent.push([ch, payload])
  } as unknown as WebContents
  return { sender, sent }
}

async function* gen(chunks: string[]) {
  for (const c of chunks) yield c
}

describe('StreamManager.run', () => {
  it('把 textStream 的每个 chunk 逐块转发为 chat:chunk，结束后发 chat:done', async () => {
    vi.mocked(getResolvedConfig).mockReturnValue({ providerId: 'openai', baseURL: 'b', modelId: 'm', apiKey: 'k', hotkey: '' })
    const fakeStreamText = vi.fn().mockReturnValue({ textStream: gen(['你', '好', '！']) })
    const mgr = new StreamManager({ streamTextImpl: fakeStreamText })
    const { sender, sent } = mockSender()

    await mgr.run(sender, { messages: [{ role: 'user', content: 'hi' }] })

    expect(sent.map(([ch]) => ch)).toEqual(['chat:chunk', 'chat:chunk', 'chat:chunk', 'chat:done'])
    expect(sent.filter(([ch]) => ch === 'chat:chunk').map(([, p]) => (p as { text: string }).text)).toEqual(['你', '好', '！'])
  })

  it('没有 apiKey 时发 chat:error 且不调用 streamText', async () => {
    vi.mocked(getResolvedConfig).mockReturnValue({ providerId: 'openai', baseURL: 'b', modelId: 'm', apiKey: '', hotkey: '' })
    const fakeStreamText = vi.fn()
    const mgr = new StreamManager({ streamTextImpl: fakeStreamText })
    const { sender, sent } = mockSender()

    await mgr.run(sender, { messages: [] })

    expect(fakeStreamText).not.toHaveBeenCalled()
    expect(sent[0][0]).toBe('chat:error')
  })

  it('streamText 抛错时发 chat:error', async () => {
    vi.mocked(getResolvedConfig).mockReturnValue({ providerId: 'openai', baseURL: 'b', modelId: 'm', apiKey: 'k', hotkey: '' })
    const fakeStreamText = vi.fn().mockImplementation(() => {
      throw new Error('boom')
    })
    const mgr = new StreamManager({ streamTextImpl: fakeStreamText })
    const { sender, sent } = mockSender()

    await mgr.run(sender, { messages: [] })

    expect(sent[0][0]).toBe('chat:error')
    expect((sent[0][1] as { message: string }).message).toBe('boom')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm exec vitest run src/main/chat/__tests__/streamManager.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

`src/main/chat/streamManager.ts`：

```ts
import type { WebContents } from 'electron'
import { streamText, type CoreMessage } from 'ai'

import { IPC } from '@shared/ipc'

import { getResolvedConfig, resolveModel } from '../config/resolve'

export interface StreamRequest {
  messages: CoreMessage[]
  system?: string
}

interface StreamManagerOptions {
  streamTextImpl?: typeof streamText
}

export class StreamManager {
  private active = new Map<number, AbortController>()

  constructor(private opts: StreamManagerOptions = {}) {}

  async run(sender: WebContents, req: StreamRequest): Promise<void> {
    this.abortFor(sender)

    const config = getResolvedConfig()
    if (!config.apiKey) {
      sender.send(IPC.events.chatError, { message: 'NO_API_KEY' })
      return
    }

    const model = resolveModel(config)
    const controller = new AbortController()
    this.active.set(sender.id, controller)

    const impl = this.opts.streamTextImpl ?? streamText
    try {
      const { textStream } = impl({
        model,
        system: req.system,
        messages: req.messages,
        abortSignal: controller.signal
      })
      for await (const text of textStream) {
        sender.send(IPC.events.chatChunk, { text })
      }
      sender.send(IPC.events.chatDone, undefined)
    } catch (err) {
      if (!controller.signal.aborted) {
        sender.send(IPC.events.chatError, { message: (err as Error).message })
      }
    } finally {
      this.active.delete(sender.id)
    }
  }

  abortFor(sender: WebContents): void {
    this.active.get(sender.id)?.abort()
    this.active.delete(sender.id)
  }
}

export const streamManager = new StreamManager()
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm exec vitest run src/main/chat/__tests__/streamManager.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat(main): add streaming bridge with chunk forwarding and abort"
```

---

### Task 7: IPC handlers 与 preload API

**Files:**
- Create: `src/main/ipc/handlers.ts`
- Modify: `src/main/index.ts`（注册 handlers）
- Modify: `src/preload/index.ts`（暴露完整 API）
- Test: `src/main/ipc/__tests__/handlers.test.ts`

**Interfaces:**
- Consumes: `store`/`secretStore`/`resolve`/`streamManager`；`IPC` from `@shared/ipc`；`StoredConfig`/`PublicConfig` from `@shared/config`
- Produces: `registerIpcHandlers(): void`（`ipcMain` 注册 config get/set/setKey + chat stream/abort + quick hide/setPin）；preload 暴露 `window.api`

- [ ] **Step 1: 写失败测试**

`src/main/ipc/__tests__/handlers.test.ts`：

```ts
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn()
  }
}))

import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import { registerIpcHandlers } from '../handlers'

describe('registerIpcHandlers', () => {
  it('注册 config:get / config:set / config:setKey 三个 handle', () => {
    registerIpcHandlers()
    const handled = vi.mocked(ipcMain.handle).mock.calls.map((c) => c[0])
    expect(handled).toContain(IPC.channels.configGet)
    expect(handled).toContain(IPC.channels.configSet)
    expect(handled).toContain(IPC.channels.configSetKey)
  })

  it('注册 chat:stream / chat:abort / quick:hide / quick:setPin 四个 on', () => {
    registerIpcHandlers()
    const on = vi.mocked(ipcMain.on).mock.calls.map((c) => c[0])
    expect(on).toContain(IPC.channels.chatStream)
    expect(on).toContain(IPC.channels.chatAbort)
    expect(on).toContain(IPC.channels.quickHide)
    expect(on).toContain(IPC.channels.quickSetPin)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm exec vitest run src/main/ipc/__tests__/handlers.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

`src/main/ipc/handlers.ts`：

```ts
import { ipcMain } from 'electron'

import { IPC } from '@shared/ipc'
import { streamManager } from '../chat/streamManager'
import { getPublicConfig, getResolvedConfig } from '../config/resolve'
import { setApiKey } from '../config/secretStore'
import { loadConfig, saveConfig } from '../config/store'
import { hideQuickAssistant, setPinQuickAssistant } from '../windows/quickWindow'

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.channels.configGet, () => getPublicConfig())

  ipcMain.handle(IPC.channels.configSet, (_e, cfg: Partial<Parameters<typeof saveConfig>[0]>) => {
    saveConfig({ ...loadConfig(), ...cfg })
  })

  ipcMain.handle(IPC.channels.configSetKey, (_e, { apiKey }: { apiKey: string }) => {
    setApiKey(apiKey)
  })

  ipcMain.on(IPC.channels.chatStream, (event, req) => {
    void streamManager.run(event.sender, req)
  })

  ipcMain.on(IPC.channels.chatAbort, (event) => {
    streamManager.abortFor(event.sender)
  })

  ipcMain.on(IPC.channels.quickHide, () => hideQuickAssistant())
  ipcMain.on(IPC.channels.quickSetPin, (_e, { pinned }: { pinned: boolean }) => setPinQuickAssistant(pinned))
}
```

`src/preload/index.ts`（完整版）：

```ts
import { contextBridge, ipcRenderer } from 'electron'

import { IPC } from '../shared/ipc'
import type { PublicConfig, StoredConfig } from '../shared/config'

type Unsubscriber = () => void

const api = {
  config: {
    get: (): Promise<PublicConfig> => ipcRenderer.invoke(IPC.channels.configGet),
    set: (cfg: Partial<StoredConfig>): Promise<void> => ipcRenderer.invoke(IPC.channels.configSet, cfg),
    setKey: (apiKey: string): Promise<void> => ipcRenderer.invoke(IPC.channels.configSetKey, { apiKey })
  },
  chat: {
    stream: (req: { messages: unknown[]; system?: string }): void => ipcRenderer.send(IPC.channels.chatStream, req),
    abort: (): void => ipcRenderer.send(IPC.channels.chatAbort),
    onChunk: (cb: (text: string) => void): Unsubscriber => {
      const l = (_e: unknown, p: { text: string }) => cb(p.text)
      ipcRenderer.on(IPC.events.chatChunk, l)
      return () => ipcRenderer.removeListener(IPC.events.chatChunk, l)
    },
    onDone: (cb: () => void): Unsubscriber => {
      const l = () => cb()
      ipcRenderer.on(IPC.events.chatDone, l)
      return () => ipcRenderer.removeListener(IPC.events.chatDone, l)
    },
    onError: (cb: (message: string) => void): Unsubscriber => {
      const l = (_e: unknown, p: { message: string }) => cb(p.message)
      ipcRenderer.on(IPC.events.chatError, l)
      return () => ipcRenderer.removeListener(IPC.events.chatError, l)
    }
  },
  quick: {
    hide: (): void => ipcRenderer.send(IPC.channels.quickHide),
    setPin: (pinned: boolean): void => ipcRenderer.send(IPC.channels.quickSetPin, { pinned }),
    onShown: (cb: () => void): Unsubscriber => {
      const l = () => cb()
      ipcRenderer.on(IPC.events.quickShown, l)
      return () => ipcRenderer.removeListener(IPC.events.quickShown, l)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
```

`src/main/index.ts` 末尾（在 `app.whenReady().then(...)` 内）增加 `registerIpcHandlers()`。

- [ ] **Step 4: 运行确认通过**

Run: `pnpm exec vitest run src/main/ipc/__tests__/handlers.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat(main): wire ipc handlers and expose preload api"
```

---

### Task 8: 悬浮窗（NSPanel）与设置窗

**Files:**
- Create: `src/main/windows/quickWindow.ts`, `src/main/windows/settingsWindow.ts`
- Modify: `src/main/index.ts`（用真实窗口替换 Task 1 的占位 `createWindow`）

**Interfaces:**
- Consumes: `WindowType`-like 常量无需；直接定义窗口。`IPC.events.quickShown` from `@shared/ipc`
- Produces: `createQuickWindow(): BrowserWindow`、`showQuickAssistant()`、`hideQuickAssistant()`、`toggleQuickAssistant()`、`setPinQuickAssistant(pinned)`、`getQuickWindow()`；`openSettingsWindow()`

- [ ] **Step 1: 实现 `quickWindow.ts`（NSPanel 悬浮窗，复用 Cherry Studio 配置）**

```ts
import { BrowserWindow, app, screen, shell } from 'electron'
import { join } from 'path'

import { IPC } from '@shared/ipc'

let win: BrowserWindow | null = null
let isPinned = false

export function createQuickWindow(): BrowserWindow {
  win = new BrowserWindow({
    width: 550,
    height: 400,
    minWidth: 350,
    minHeight: 380,
    maxWidth: 1024,
    maxHeight: 768,
    frame: false,
    show: false,
    alwaysOnTop: true,
    useContentSize: true,
    skipTaskbar: true,
    autoHideMenuBar: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    type: 'panel',
    transparent: true,
    vibrancy: 'under-window',
    visualEffectState: 'followWindow',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  win.on('blur', () => {
    if (!isPinned) hideQuickAssistant()
  })
  win.on('show', () => {
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC.events.quickShown, undefined)
    }
  })

  // 严格导航安全：非本应用 URL 一律拦截，安全的走系统浏览器
  win.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) {
      event.preventDefault()
      if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    }
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/quick.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/quick.html'))
  }
  return win
}

function isAppUrl(url: string): boolean {
  return process.env['ELECTRON_RENDERER_URL'] ? url.startsWith(process.env['ELECTRON_RENDERER_URL']) : url.startsWith('file://')
}

export function getQuickWindow(): BrowserWindow | null {
  return win && !win.isDestroyed() ? win : null
}

export function showQuickAssistant(): void {
  const w = getQuickWindow()
  if (!w) return
  if (w.isMinimized()) w.restore()
  const bounds = w.getBounds()
  const cursor = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const windowDisplay = screen.getDisplayNearestPoint(bounds)
  if (cursor.id !== windowDisplay.id) {
    const { x, y, width, height } = cursor.bounds
    w.setPosition(Math.round(x + (width - bounds.width) / 2), Math.round(y + (height - bounds.height) / 2))
  }
  w.show()
  w.focus()
}

export function hideQuickAssistant(): void {
  getQuickWindow()?.hide()
  // macOS 隐藏后把焦点还给前一个应用
  app.hide()
}

export function toggleQuickAssistant(): void {
  const w = getQuickWindow()
  if (w?.isVisible()) hideQuickAssistant()
  else showQuickAssistant()
}

export function setPinQuickAssistant(pinned: boolean): void {
  isPinned = pinned
}
```

- [ ] **Step 2: 实现 `settingsWindow.ts`**

```ts
import { BrowserWindow } from 'electron'
import { join } from 'path'

let win: BrowserWindow | null = null

export function openSettingsWindow(): void {
  if (win && !win.isDestroyed()) {
    win.show()
    win.focus()
    return
  }
  win = new BrowserWindow({
    width: 640,
    height: 560,
    title: '快捷助手设置',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  win.on('closed', () => (win = null))
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/settings.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/settings.html'))
  }
}
```

- [ ] **Step 3: 改写 `src/main/index.ts`**

```ts
import { app, globalShortcut } from 'electron'
import { getPublicConfig } from './config/resolve'
import { registerIpcHandlers } from './ipc/handlers'
import { createQuickWindow, showQuickAssistant, toggleQuickAssistant } from './windows/quickWindow'

app.whenReady().then(() => {
  createQuickWindow()
  registerIpcHandlers()
  registerHotkey()
})

function registerHotkey(): void {
  const accel = getPublicConfig().hotkey
  globalShortcut.register(accel, () => toggleQuickAssistant())
}

app.on('will-quit', () => globalShortcut.unregisterAll())
app.on('window-all-closed', () => app.quit())
```

- [ ] **Step 4: 构建验证**

Run: `pnpm typecheck && pnpm build`
Expected: 类型检查与构建通过。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat(main): add floating nspanel window, settings window, and hotkey"
```

---

### Task 9: 渲染进程 useChatStream 与 useClipboard hooks

**Files:**
- Create: `src/renderer/quick/useChatStream.ts`, `src/renderer/quick/useClipboard.ts`, `src/renderer/quick/global.d.ts`
- Test: `src/renderer/quick/__tests__/useChatStream.test.tsx`

**Interfaces:**
- Consumes: `window.api`（preload 暴露的 `chat.stream/abort/onChunk/onDone/onError`）
- Produces:
  - `interface ChatMessage { id; role: 'user' | 'assistant'; content }`
  - `useChatStream(): { messages, isStreaming, error, send(text, opts?), stop(), reset() }`
  - `useClipboard(enabled): { clipboardText, clearClipboard }`

- [ ] **Step 1: 写失败测试**

`src/renderer/quick/__tests__/useChatStream.test.tsx`：

```tsx
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useChatStream } from '../useChatStream'

function mockApi() {
  const chunkCbs: Array<(t: string) => void> = []
  const doneCbs: Array<() => void> = []
  const errorCbs: Array<(m: string) => void> = []
  const api = {
    chat: {
      stream: vi.fn(),
      abort: vi.fn(),
      onChunk: (cb: (t: string) => void) => { chunkCbs.push(cb); return () => {} },
      onDone: (cb: () => void) => { doneCbs.push(cb); return () => {} },
      onError: (cb: (m: string) => void) => { errorCbs.push(cb); return () => {} }
    }
  }
  ;(globalThis as any).api = api
  return { api, chunkCbs, doneCbs, errorCbs }
}

describe('useChatStream', () => {
  beforeEach(() => vi.clearAllMocks())

  it('send 追加用户消息与空的助手消息，并调用 api.chat.stream', () => {
    const { api } = mockApi()
    const { result } = renderHook(() => useChatStream())
    act(() => result.current.send('你好'))
    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[0]).toMatchObject({ role: 'user', content: '你好' })
    expect(result.current.messages[1]).toMatchObject({ role: 'assistant', content: '' })
    expect(api.chat.stream).toHaveBeenCalled()
  })

  it('收到 chunk 时累加到当前助手消息', () => {
    const { chunkCbs } = mockApi()
    const { result } = renderHook(() => useChatStream())
    act(() => result.current.send('hi'))
    act(() => chunkCbs.forEach((cb) => cb('你')))
    act(() => chunkCbs.forEach((cb) => cb('好')))
    expect(result.current.messages[1].content).toBe('你好')
  })

  it('done 后 isStreaming 归 false', () => {
    const { doneCbs } = mockApi()
    const { result } = renderHook(() => useChatStream())
    act(() => result.current.send('hi'))
    expect(result.current.isStreaming).toBe(true)
    act(() => doneCbs.forEach((cb) => cb()))
    expect(result.current.isStreaming).toBe(false)
  })

  it('error 写入 error 并结束流', () => {
    const { errorCbs } = mockApi()
    const { result } = renderHook(() => useChatStream())
    act(() => result.current.send('hi'))
    act(() => errorCbs.forEach((cb) => cb('NO_API_KEY')))
    expect(result.current.error).toBe('NO_API_KEY')
    expect(result.current.isStreaming).toBe(false)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm exec vitest run src/renderer/quick/__tests__/useChatStream.test.tsx`
Expected: FAIL

- [ ] **Step 3: 实现**

`src/renderer/quick/global.d.ts`：

```ts
import type { PublicConfig, StoredConfig } from '@shared/config'

declare global {
  interface Window {
    api: {
      config: {
        get(): Promise<PublicConfig>
        set(cfg: Partial<StoredConfig>): Promise<void>
        setKey(apiKey: string): Promise<void>
      }
      chat: {
        stream(req: { messages: { role: 'user' | 'assistant'; content: string }[]; system?: string }): void
        abort(): void
        onChunk(cb: (text: string) => void): () => void
        onDone(cb: () => void): () => void
        onError(cb: (message: string) => void): () => void
      }
      quick: {
        hide(): void
        setPin(pinned: boolean): void
        onShown(cb: () => void): () => void
      }
    }
  }
}

export {}
```

`src/renderer/quick/useChatStream.ts`：

```ts
import { useCallback, useEffect, useRef, useState } from 'react'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export function useChatStream() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesRef = useRef<ChatMessage[]>([])
  const idRef = useRef(0)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    const offChunk = window.api.chat.onChunk((text) => {
      const assistantId = messagesRef.current[messagesRef.current.length - 1]?.id
      setMessages((m) =>
        m.map((msg) => (msg.id === assistantId ? { ...msg, content: msg.content + text } : msg))
      )
    })
    const offDone = window.api.chat.onDone(() => setIsStreaming(false))
    const offError = window.api.chat.onError((message) => {
      setError(message)
      setIsStreaming(false)
    })
    return () => {
      offChunk()
      offDone()
      offError()
    }
  }, [])

  const send = useCallback((text: string, opts?: { system?: string }) => {
    const userMsg: ChatMessage = { id: `u${idRef.current++}`, role: 'user', content: text }
    const assistantMsg: ChatMessage = { id: `a${idRef.current++}`, role: 'assistant', content: '' }
    const history = [...messagesRef.current, userMsg]
    setMessages((m) => [...m, userMsg, assistantMsg])
    setIsStreaming(true)
    setError(null)
    window.api.chat.stream({
      messages: history.map((m) => ({ role: m.role, content: m.content })),
      system: opts?.system
    })
  }, [])

  const stop = useCallback(() => window.api.chat.abort(), [])
  const reset = useCallback(() => {
    setMessages([])
    setIsStreaming(false)
    setError(null)
  }, [])

  return { messages, isStreaming, error, send, stop, reset }
}
```

`src/renderer/quick/useClipboard.ts`：

```ts
import { useCallback, useEffect, useRef, useState } from 'react'

export function useClipboard(enabled: boolean) {
  const [clipboardText, setClipboardText] = useState('')
  const lastRef = useRef<string | null>(null)

  const readClipboard = useCallback(async () => {
    if (!enabled) return
    try {
      const text = await navigator.clipboard.readText()
      if (text && text !== lastRef.current) {
        lastRef.current = text
        setClipboardText(text.trim())
      }
    } catch {
      // 剪贴板读取被拒时静默忽略
    }
  }, [enabled])

  const clearClipboard = useCallback(() => {
    setClipboardText('')
    lastRef.current = null
  }, [])

  useEffect(() => {
    void readClipboard()
  }, [readClipboard])

  return { clipboardText, readClipboard, clearClipboard }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm exec vitest run src/renderer/quick/__tests__/useChatStream.test.tsx`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat(renderer): add useChatStream and useClipboard hooks"
```

---

### Task 10: 渲染进程叶子 UI 组件（搬移 + 适配）

**Files:**
- Create: `src/renderer/quick/components/FeatureMenus.tsx`, `InputBar.tsx`, `Footer.tsx`, `ClipboardPreview.tsx`
- Create: `src/renderer/quick/components/ui.tsx`（极简 Input/Separator/Scrollbar/Tooltip）

**Interfaces:**
- Consumes: `useChatStream` 类型；lucide-react 图标
- Produces: `FeatureMenus({ text, setRoute, onSendMessage, ref })`、`InputBar({ text, placeholder, loading, handleKeyDown, handleChange, ref })`、`Footer({ route, loading, isPinned, setIsPinned, onEsc, onCopy, canUseBackspace, clearClipboard })`、`ClipboardPreview({ clipboardText, clearClipboard })`

**适配规则（相对 Cherry Studio 源码）：** 删除 `useTranslation`/`t()`，文案硬编码中文；`@cherrystudio/ui` 的 `Input`/`Scrollbar`/`Tooltip` 替换为本任务手写的 `ui.tsx`；`ModelAvatar` / `useTimer` 删除。

- [ ] **Step 1: 写 `ui.tsx`（极简组件）**

```tsx
import type { ReactNode } from 'react'

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full bg-transparent outline-none ${props.className ?? ''}`}
    />
  )
}

export function Separator({ className = '' }: { className?: string }) {
  return <div className={`h-px w-full bg-border ${className}`} />
}

export function Scrollbar({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`overflow-y-auto ${className}`}>{children}</div>
}

export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  return <span title={content}>{children}</span>
}
```

- [ ] **Step 2: 搬移 + 适配 `ClipboardPreview.tsx`（删 t，改用 props 默认文案）**

```tsx
import { Copy, X } from 'lucide-react'
import type { FC } from 'react'

interface Props {
  clipboardText: string
  clearClipboard: () => void
}

const ClipboardPreview: FC<Props> = ({ clipboardText, clearClipboard }) => {
  if (!clipboardText) return null
  return (
    <div className="mb-2.5 rounded-lg bg-muted p-3">
      <div className="flex w-full items-center text-muted-foreground">
        <Copy className="nodrag size-3.5 shrink-0 cursor-pointer" />
        <p className="nodrag mx-3 min-w-0 flex-1 overflow-hidden text-xs [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
          {clipboardText}
        </p>
        <button
          type="button"
          onClick={clearClipboard}
          className="nodrag flex shrink-0 items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="关闭">
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

export default ClipboardPreview
```

- [ ] **Step 3: 搬移 + 适配 `FeatureMenus.tsx`（删 t，图标文案硬编码）**

```tsx
import { CornerDownLeft, FileText, Languages, Lightbulb, MessageSquare } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { useImperativeHandle, useMemo, useState } from 'react'

import { Scrollbar } from './ui'

export type MiniRoute = 'home' | 'chat' | 'translate' | 'summary' | 'explanation'

interface Props {
  text: string
  setRoute: Dispatch<SetStateAction<MiniRoute>>
  onSendMessage: (prompt?: string) => void
}

export interface FeatureMenusRef {
  nextFeature(): void
  prevFeature(): void
  useFeature(): void
  resetSelectedIndex(): void
}

const PROMPT_SUMMARY = '请总结以下内容，用简洁的中文概括要点：'
const PROMPT_EXPLANATION = '请用通俗易懂的中文解释以下内容：'

const FeatureMenus = ({ ref, text, setRoute, onSendMessage }: Props & { ref?: React.RefObject<FeatureMenusRef | null> }) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const features = useMemo(
    () => [
      {
        icon: <MessageSquare className="size-4" />,
        title: '对话',
        onClick: () => {
          if (text) {
            setRoute('chat')
            onSendMessage()
          }
        }
      },
      {
        icon: <Languages className="size-4" />,
        title: '翻译',
        onClick: () => text && setRoute('translate')
      },
      {
        icon: <FileText className="size-4" />,
        title: '总结',
        onClick: () => {
          if (text) {
            setRoute('summary')
            onSendMessage(PROMPT_SUMMARY)
          }
        }
      },
      {
        icon: <Lightbulb className="size-4" />,
        title: '解释',
        onClick: () => {
          if (text) {
            setRoute('explanation')
            onSendMessage(PROMPT_EXPLANATION)
          }
        }
      }
    ],
    [onSendMessage, setRoute, text]
  )

  useImperativeHandle(ref, () => ({
    nextFeature: () => setSelectedIndex((p) => (p < features.length - 1 ? p + 1 : 0)),
    prevFeature: () => setSelectedIndex((p) => (p > 0 ? p - 1 : features.length - 1)),
    useFeature: () => features[selectedIndex].onClick?.(),
    resetSelectedIndex: () => setSelectedIndex(0)
  }))

  return (
    <Scrollbar className="h-auto shrink-0">
      <div className="flex cursor-pointer flex-col gap-1">
        {features.map((feature, index) => (
          <button
            type="button"
            key={index}
            onClick={feature.onClick}
            className={`flex w-full cursor-pointer flex-row items-center gap-3 rounded-lg border-0 bg-transparent px-4 py-2 text-left transition-colors select-none hover:bg-accent ${
              index === selectedIndex ? 'bg-accent' : ''
            }`}>
            {feature.icon}
            <span className="m-0 flex-1 text-sm">{feature.title}</span>
            {index === selectedIndex && <CornerDownLeft className="size-4 text-muted-foreground" />}
          </button>
        ))}
      </div>
    </Scrollbar>
  )
}
FeatureMenus.displayName = 'FeatureMenus'

export default FeatureMenus
```

- [ ] **Step 4: 搬移 + 适配 `InputBar.tsx`（删 ModelAvatar/useTimer，用 ui.Input）**

```tsx
import React, { useRef } from 'react'

import { Input } from './ui'

interface Props {
  text: string
  placeholder: string
  loading: boolean
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

const InputBar = ({ ref, text, placeholder, loading, handleKeyDown, handleChange }: Props & { ref?: React.RefObject<HTMLDivElement | null> }) => {
  const inputRef = useRef<HTMLInputElement>(null)
  if (!loading) {
    setTimeout(() => inputRef.current?.focus(), 0)
  }
  return (
    <div ref={ref} className="mt-2.5 flex items-center gap-2">
      <Input
        ref={inputRef}
        value={text}
        placeholder={placeholder}
        autoFocus
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        className="h-auto rounded-none border-0 px-0 py-0 text-lg shadow-none placeholder:text-muted-foreground"
      />
    </div>
  )
}
InputBar.displayName = 'InputBar'

export default InputBar
```

- [ ] **Step 5: 搬移 + 适配 `Footer.tsx`（删 t，Tooltip 换 title）**

```tsx
import { ArrowLeft, CircleArrowLeft, Copy, Loader2, Pin } from 'lucide-react'
import type { ButtonHTMLAttributes, FC } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

import { Tooltip } from './ui'

interface Props {
  route: string
  canUseBackspace?: boolean
  loading?: boolean
  isPinned: boolean
  setIsPinned: (p: boolean) => void
  clearClipboard?: () => void
  onEsc: () => void
  onCopy?: () => void
}

const Footer: FC<Props> = ({ route, canUseBackspace, loading, clearClipboard, onEsc, isPinned, setIsPinned, onCopy }) => {
  useHotkeys('esc', () => onEsc())
  useHotkeys('c', () => { if (!loading && onCopy) onCopy() })

  const escLabel = loading ? 'Esc 暂停' : route === 'home' ? 'Esc 关闭' : 'Esc 返回'

  return (
    <div className="flex flex-row justify-between py-1.5 text-xs text-muted-foreground">
      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
        <FooterAction onClick={onEsc}>
          {loading ? <Loader2 size={12} className="animate-spin text-error" /> : <CircleArrowLeft size={14} />}
          {escLabel}
        </FooterAction>
        {route === 'home' && !canUseBackspace && (
          <FooterAction onClick={() => clearClipboard?.()}>
            <ArrowLeft size={14} />
            Backspace 清除
          </FooterAction>
        )}
        {route !== 'home' && !loading && (
          <FooterAction onClick={() => onCopy?.()}>
            <Copy size={14} />
            复制
          </FooterAction>
        )}
      </div>
      <button type="button" onClick={() => setIsPinned(!isPinned)} className="mr-1 flex items-center" aria-pressed={isPinned} aria-label="固定">
        <Tooltip content="固定">
          <Pin size={14} className={isPinned ? 'rotate-[40deg] text-primary transition-transform' : 'transition-transform'} />
        </Tooltip>
      </button>
    </div>
  )
}

const FooterAction: FC<ButtonHTMLAttributes<HTMLButtonElement>> = ({ className, ...props }) => (
  <button
    type="button"
    className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${className ?? ''}`}
    {...props}
  />
)

export default Footer
```

- [ ] **Step 6: 构建验证**

Run: `pnpm typecheck`
Expected: 通过。

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "feat(renderer): port and adapt leaf quick-assistant components"
```

---

### Task 11: 渲染进程 HomeWindow + MessageList（重写）

**Files:**
- Create: `src/renderer/quick/HomeWindow.tsx`, `src/renderer/quick/components/MessageList.tsx`
- Create: `src/renderer/quick/components/TranslateWindow.tsx`
- Modify: `src/renderer/quick/main.tsx`（渲染 `<App/>`，本任务先渲染 HomeWindow）

**Interfaces:**
- Consumes: `useChatStream`、`useClipboard`、`FeatureMenus`/`InputBar`/`Footer`/`ClipboardPreview`；`window.api.quick`（hide/setPin/onShown）
- Produces: `default HomeWindow`（四功能路由 + 键盘交互 + pin + 剪贴板）

- [ ] **Step 1: 实现 `MessageList.tsx`（纯文本 + 简单 markdown，替代 Messages/Message）**

```tsx
import type { FC } from 'react'

import type { ChatMessage } from '../useChatStream'

interface Props {
  messages: ChatMessage[]
  isStreaming: boolean
}

const MessageList: FC<Props> = ({ messages, isStreaming }) => {
  return (
    <div className="flex w-full flex-col gap-3 overflow-y-auto pb-5">
      {messages.map((m) => (
        <div
          key={m.id}
          className={m.role === 'user' ? 'self-end rounded-[10px] bg-muted px-4 py-2.5 text-sm' : 'self-start whitespace-pre-wrap text-sm'}
        >
          {m.content || (m.role === 'assistant' && isStreaming ? '…' : '')}
        </div>
      ))}
    </div>
  )
}

export default MessageList
```

- [ ] **Step 2: 实现 `HomeWindow.tsx`（极简编排，~150 行）**

```tsx
import { useCallback, useMemo, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

import ClipboardPreview from './components/ClipboardPreview'
import FeatureMenus, { type FeatureMenusRef, type MiniRoute } from './components/FeatureMenus'
import Footer from './components/Footer'
import InputBar from './components/InputBar'
import MessageList from './components/MessageList'
import { Separator } from './components/ui'
import TranslateWindow from './components/TranslateWindow'
import { useChatStream } from './useChatStream'
import { useClipboard } from './useClipboard'

export default function HomeWindow() {
  const [route, setRoute] = useState<MiniRoute>('home')
  const [isFirstMessage, setIsFirstMessage] = useState(true)
  const [input, setInput] = useState('')
  const [isPinned, setIsPinned] = useState(false)

  const { messages, isStreaming, error, send, stop, reset } = useChatStream()
  const { clipboardText, readClipboard, clearClipboard } = useClipboard(true)
  const menusRef = useRef<FeatureMenusRef>(null)

  const setPin = useCallback((p: boolean) => {
    window.api.quick.setPin(p)
    setIsPinned(p)
  }, [])

  const requestText = useMemo(() => {
    const trimmed = input.trim()
    if (!isFirstMessage || !clipboardText) return trimmed
    if (!trimmed || clipboardText === trimmed) return clipboardText
    return `${clipboardText}\n\n${trimmed}`
  }, [clipboardText, input, isFirstMessage])

  const onWindowShow = useCallback(() => {
    void readClipboard()
  }, [readClipboard])

  // 每次窗口 show 时重新读剪贴板
  useMemo(() => window.api.quick.onShown(onWindowShow), [onWindowShow])

  const handleSend = useCallback(
    (prompt?: string) => {
      const text = [prompt, requestText].filter(Boolean).join('\n\n')
      if (!text.trim()) return
      setIsFirstMessage(false)
      setInput('')
      send(text)
    },
    [requestText, send]
  )

  const handleEsc = useCallback(() => {
    if (isStreaming) {
      stop()
      return
    }
    if (route === 'home') {
      window.api.quick.hide()
      return
    }
    reset()
    setRoute('home')
    setInput('')
    menusRef.current?.resetSelectedIndex()
  }, [isStreaming, route, stop, reset])

  const handleCopy = useCallback(() => {
    const last = [...messages].reverse().find((m) => m.role === 'assistant')
    if (last?.content) void navigator.clipboard.writeText(last.content)
  }, [messages])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    switch (e.code) {
      case 'Enter':
      case 'NumpadEnter':
        if (isStreaming) return
        e.preventDefault()
        if (requestText) {
          if (route === 'home') menusRef.current?.useFeature()
          else {
            setRoute('chat')
            handleSend()
          }
        }
        break
      case 'Backspace':
        if (input.length === 0) clearClipboard()
        break
      case 'ArrowUp':
        if (route === 'home') {
          e.preventDefault()
          menusRef.current?.prevFeature()
        }
        break
      case 'ArrowDown':
        if (route === 'home') {
          e.preventDefault()
          menusRef.current?.nextFeature()
        }
        break
      case 'Escape':
        handleEsc()
        break
    }
  }

  useHotkeys('esc', () => handleEsc())

  const body = () => {
    if (route === 'translate') {
      return <TranslateWindow text={requestText} />
    }
    if (route !== 'home') {
      return (
        <>
          <MessageList messages={messages} isStreaming={isStreaming} />
          {error && <div className="rounded border border-error-border bg-error-subtle px-3 py-2 text-[13px]">{error}</div>}
        </>
      )
    }
    return (
      <>
        <ClipboardPreview clipboardText={clipboardText} clearClipboard={clearClipboard} />
        <main className="flex flex-1 flex-col overflow-hidden">
          <FeatureMenus setRoute={setRoute} onSendMessage={handleSend} text={requestText} ref={menusRef} />
        </main>
      </>
    )
  }

  return (
    <div className="flex h-full w-full flex-1 flex-col px-2.5 py-2 [-webkit-app-region:drag]">
      <InputBar
        text={input}
        placeholder="输入问题或选择下方功能…"
        loading={isStreaming}
        handleKeyDown={handleKeyDown}
        handleChange={(e) => setInput(e.target.value)}
      />
      <Separator className="my-2.5" />
      {body()}
      <Separator className="my-2.5" />
      <Footer
        route={route}
        loading={isStreaming}
        isPinned={isPinned}
        setIsPinned={setPin}
        clearClipboard={clearClipboard}
        onEsc={handleEsc}
        onCopy={handleCopy}
        canUseBackspace={input.length > 0 || clipboardText.length === 0}
      />
    </div>
  )
}
```

- [ ] **Step 3: 实现 `TranslateWindow.tsx`（极简，单模型 + 系统提示词）**

```tsx
import { useEffect, useState } from 'react'

import { useChatStream } from '../useChatStream'

const SYSTEM_TRANSLATE = '你是一个翻译助手。请把用户输入的内容翻译成中文，只输出译文，不要解释。'

export default function TranslateWindow({ text }: { text: string }) {
  const { messages, isStreaming, send, reset } = useChatStream()
  const [lastText, setLastText] = useState('')

  useEffect(() => {
    if (text.trim() && text !== lastText) {
      setLastText(text)
      reset()
      send(text, { system: SYSTEM_TRANSLATE })
    }
  }, [text, lastText, reset, send])

  const result = [...messages].reverse().find((m) => m.role === 'assistant')?.content ?? ''

  return (
    <div className="flex flex-1 flex-col overflow-hidden p-3">
      <div className="text-xs text-muted-foreground">翻译为中文</div>
      <div className="mt-3 flex-1 overflow-y-auto whitespace-pre-wrap break-words text-sm">
        {result || (isStreaming ? '…' : '')}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 构建验证**

Run: `pnpm typecheck`
Expected: 通过。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat(renderer): rewrite home window orchestration and message list"
```

---

### Task 12: 设置窗口（SettingsPage + 表单校验）

**Files:**
- Create: `src/renderer/settings/SettingsPage.tsx`
- Modify: `src/renderer/settings/main.tsx`（渲染 SettingsPage）
- Test: `src/renderer/settings/__tests__/validation.test.ts`

**Interfaces:**
- Consumes: `window.api.config`（get/set/setKey）；`PROVIDERS`/`ProviderId` from `@shared/config`
- Produces: `default SettingsPage`（供应商下拉、baseURL、modelId、API Key、快捷键）

- [ ] **Step 1: 写失败测试（校验纯函数）**

`src/renderer/settings/__tests__/validation.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { validate } from '../validation'

describe('validate', () => {
  it('custom 供应商未填 baseURL 时返回错误', () => {
    const r = validate({ providerId: 'custom', baseURL: '', modelId: 'm', apiKey: 'k' })
    expect(r.baseURL).toBeTruthy()
  })

  it('未填 apiKey 时返回错误', () => {
    const r = validate({ providerId: 'openai', baseURL: '', modelId: '', apiKey: '' })
    expect(r.apiKey).toBeTruthy()
  })

  it('openai 且填了 key 时全部通过', () => {
    const r = validate({ providerId: 'openai', baseURL: '', modelId: '', apiKey: 'k' })
    expect(r).toEqual({})
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm exec vitest run src/renderer/settings/__tests__/validation.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 `validation.ts` 与 `SettingsPage.tsx`**

`src/renderer/settings/validation.ts`：

```ts
import type { ProviderId } from '@shared/config'

export interface FormValues {
  providerId: ProviderId
  baseURL: string
  modelId: string
  apiKey: string
}

export function validate(v: FormValues): Partial<Record<keyof FormValues, string>> {
  const errors: Partial<Record<keyof FormValues, string>> = {}
  if (!v.apiKey.trim()) errors.apiKey = '请输入 API Key'
  if (v.providerId === 'custom' && !v.baseURL.trim()) errors.baseURL = 'Custom 供应商必须填写 Base URL'
  return errors
}
```

`src/renderer/settings/SettingsPage.tsx`：

```tsx
import { useEffect, useState } from 'react'

import { PROVIDERS, type ProviderId } from '@shared/config'

import { validate, type FormValues } from './validation'

export default function SettingsPage() {
  const [form, setForm] = useState<FormValues>({ providerId: 'openai', baseURL: '', modelId: '', apiKey: '' })
  const [hotkey, setHotkey] = useState('CommandOrControl+Shift+Space')
  const [saved, setSaved] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({})

  useEffect(() => {
    void window.api.config.get().then((cfg) => {
      setForm((f) => ({ ...f, providerId: cfg.providerId, baseURL: cfg.baseURL, modelId: cfg.modelId, apiKey: '' }))
      setHotkey(cfg.hotkey)
    })
  }, [])

  const provider = PROVIDERS.find((p) => p.id === form.providerId) ?? PROVIDERS[0]

  const save = async () => {
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    await window.api.config.set({
      providerId: form.providerId,
      baseURL: form.providerId === 'custom' ? form.baseURL : '',
      modelId: form.modelId,
      hotkey
    })
    if (form.apiKey.trim()) await window.api.config.setKey(form.apiKey.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-lg font-semibold">快捷助手设置</h1>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          供应商
          <select
            value={form.providerId}
            onChange={(e) => setForm((f) => ({ ...f, providerId: e.target.value as ProviderId }))}
            className="rounded border border-input bg-background px-3 py-2">
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        {form.providerId === 'custom' && (
          <label className="flex flex-col gap-1 text-sm">
            Base URL
            <input
              value={form.baseURL}
              onChange={(e) => setForm((f) => ({ ...f, baseURL: e.target.value }))}
              placeholder="https://api.example.com/v1"
              className="rounded border border-input bg-background px-3 py-2"
            />
            {errors.baseURL && <span className="text-xs text-error">{errors.baseURL}</span>}
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm">
          模型 ID
          <input
            value={form.modelId}
            onChange={(e) => setForm((f) => ({ ...f, modelId: e.target.value }))}
            placeholder={provider.defaultModel || '手动输入 model ID'}
            className="rounded border border-input bg-background px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          API Key
          <input
            type="password"
            value={form.apiKey}
            onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
            placeholder="留空表示不修改"
            className="rounded border border-input bg-background px-3 py-2"
          />
          {errors.apiKey && <span className="text-xs text-error">{errors.apiKey}</span>}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          全局快捷键
          <input value={hotkey} onChange={(e) => setHotkey(e.target.value)} className="rounded border border-input bg-background px-3 py-2" />
        </label>

        <button type="button" onClick={save} className="rounded bg-primary px-4 py-2 text-primary-foreground">
          {saved ? '已保存' : '保存'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm exec vitest run src/renderer/settings/__tests__/validation.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat(renderer): add settings page with provider and api key config"
```

---

### Task 13: 集成、错误态与构建

**Files:**
- Modify: `src/main/windows/quickWindow.ts`（`show` 时发 `quick:shown` 已具备；补 `NO_API_KEY` 引导）
- Modify: `src/main/index.ts`（若未配置 key，首次 show 时打开设置窗）

**Interfaces:**
- Consumes: 全部已建模块
- Produces: 可完整运行、可 `pnpm build` 出产物的应用

- [ ] **Step 1: 首次未配置 key 时打开设置窗**

在 `src/main/index.ts` 的 `registerHotkey` 旁增加：

```ts
import { openSettingsWindow } from './windows/settingsWindow'
import { getPublicConfig } from './config/resolve'

function maybePromptSetup(): void {
  if (!getPublicConfig().hasApiKey) {
    openSettingsWindow()
  }
}
```

并在 `app.whenReady().then(...)` 内、`createQuickWindow()` 之后调用 `maybePromptSetup()`。

- [ ] **Step 2: 错误态文案映射（渲染侧）**

在 `HomeWindow.tsx` 的 error 展示处，把 `NO_API_KEY` 映射为友好文案：

```tsx
{error && (
  <div className="rounded border border-error-border bg-error-subtle px-3 py-2 text-[13px]">
    {error === 'NO_API_KEY' ? '尚未配置 API Key，请打开设置填写。' : error}
  </div>
)}
```

- [ ] **Step 3: 全量验证**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: 类型、测试、构建全部通过。

- [ ] **Step 4: 手动冒烟清单**

启动 `pnpm dev`，逐项确认：① 首次启动弹设置窗；② 填 Key + 模型后保存；③ 热键唤出悬浮窗；④ 输入文本 → Enter 走对话，看到流式输出；⑤ ↑↓ 选「翻译/总结/解释」并 Enter；⑥ Esc 关闭、pin 固定后失焦不隐藏；⑦ 剪贴板内容在首次消息自动带上。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: integrate setup prompt and error messaging"
```

---

## Self-Review 记录

**Spec 覆盖：** 每个 spec 章节均有对应任务——§5 目录结构 → Task 1/8/11；§6 数据流 → Task 6/9；§7 供应商 → Task 2/5/12；§8 错误处理 → Task 6/13；§10 测试 → 各任务内嵌。三处修正已在 Global Constraints 明示。

**占位符扫描：** 无 TBD/TODO；所有代码步骤均有真实代码块。

**类型一致性：** `MiniRoute` 由 `FeatureMenus.tsx` 导出，`HomeWindow.tsx` 从该处导入；`ChatMessage` 由 `useChatStream.ts` 导出，`MessageList.tsx` 从该处导入；`StoredConfig`/`PublicConfig`/`ResolvedConfig`/`ProviderId`/`PROVIDERS` 均来自 `@shared/config`；IPC 通道名统一来自 `@shared/ipc` 的 `IPC`。`resolveModel` 返回 `LanguageModel`（`ai` v4 导出）。
