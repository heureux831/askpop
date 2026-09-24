import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test'
import { createServer } from 'node:http'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// Launch the real Electron main/preload/renderer against an isolated, deterministic API.
test('桌面核心流程、翻译、错误反馈、主题与配置持久化', async () => {
  const requests: any[] = []
  const responseText = '**验收通过**\n\n- 流式回复\n\n```js\nconst ok = true\n```'
  const server = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    const data = JSON.parse(body)
    data.authorization = req.headers.authorization
    requests.push(data)
    const content = data.messages.at(-1).content as string
    if (content.includes('FAIL')) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: { message: '验收：API Key 无效', type: 'invalid_request_error' } }))
      return
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' })
    const text = data.messages[0]?.role === 'system' ? '这是翻译结果。' : responseText
    let index = 0
    const timer = setInterval(() => {
      if (index < text.length) {
        res.write(`data: ${JSON.stringify({ id: 'test', object: 'chat.completion.chunk', created: 1, model: 'test-model', choices: [{ index: 0, delta: { content: text.slice(index, index + 3) }, finish_reason: null }] })}\n\n`)
        index += 3
      } else {
        clearInterval(timer)
        res.write(`data: ${JSON.stringify({ id: 'test', object: 'chat.completion.chunk', created: 1, model: 'test-model', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`)
        res.end()
      }
    }, content.includes('SLOW') ? 500 : 25)
    res.on('close', () => clearInterval(timer))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as { port: number }).port
  const dir = await mkdtemp(join(tmpdir(), 'quick-assistant-e2e-'))
  const launcher = join(dir, 'launch.cjs')
  await writeFile(join(dir, 'config.json'), JSON.stringify({ hotkey: 'Command+Control+Alt+J' }))
  await writeFile(launcher, `const { app } = require('electron'); app.setPath('userData', ${JSON.stringify(dir)}); require(${JSON.stringify(resolve('out/main/index.js'))});`)
  let app: ElectronApplication | undefined
  const launch = () => electron.launch({ args: [launcher], env: { ...process.env, ELECTRON_RUN_AS_NODE: '' } })
  try {
    app = await launch()
    await app.evaluate(({ clipboard }) => {
      ;(globalThis as any).__clipboardBackup = clipboard.availableFormats().map((format) => [format, clipboard.readBuffer(format)])
      clipboard.writeText('剪贴板验收一')
    })
    const settingsPage = app.windows().find((p) => p.url().includes('settings.html'))
      ?? await app.waitForEvent('window', { predicate: (page) => page.url().includes('settings.html') })
    await settingsPage.getByLabel('供应商', { exact: true }).selectOption('custom')
    await settingsPage.getByLabel('API 地址', { exact: true }).fill(`http://127.0.0.1:${port}/v1`)
    await settingsPage.getByLabel('模型 ID', { exact: true }).fill('test-model')
    await settingsPage.getByLabel('API Key', { exact: true }).fill('test-only-key')
    await settingsPage.getByRole('button', { name: '保存模型', exact: true }).click()
    await expect(settingsPage.getByRole('status')).toContainText('已保存')
    await expect(settingsPage.getByLabel('API Key', { exact: true })).toHaveValue('')
    await settingsPage.getByRole('button', { name: '添加模型', exact: true }).click()
    await settingsPage.getByLabel('配置名称', { exact: true }).fill('备用模型')
    await settingsPage.getByLabel('供应商', { exact: true }).selectOption('custom')
    await settingsPage.getByLabel('模型预设', { exact: true }).selectOption('deepseek/flash')
    await expect(settingsPage.getByLabel('模型 ID', { exact: true })).toHaveValue('deepseek-flash')
    await expect(settingsPage.getByRole('switch', { name: '深度思考', exact: true })).toBeChecked()
    await settingsPage.getByRole('switch', { name: '深度思考', exact: true }).click()
    await expect(settingsPage.getByText('已关闭 · 优先快速回答', { exact: true })).toBeVisible()
    await settingsPage.getByLabel('模型 ID', { exact: true }).fill('second-model')
    await settingsPage.getByLabel('API 地址', { exact: true }).fill(`http://127.0.0.1:${port}/v1`)
    await settingsPage.getByLabel('API Key', { exact: true }).fill('second-test-key')
    await settingsPage.getByRole('button', { name: '保存模型', exact: true }).click()
    await expect(settingsPage.getByRole('button', { name: /备用模型 second-model/ })).toBeVisible()
    await settingsPage.screenshot({ path: 'test-results/models-light.png' })
    await settingsPage.getByRole('button', { name: /助手管理/ }).click()
    await settingsPage.getByRole('button', { name: '创建助手', exact: true }).click()
    await settingsPage.getByLabel('助手名称', { exact: true }).fill('代码搭档')
    const secondId = await settingsPage.evaluate(async () => (await (window as any).api.config.get()).models.find((m: any) => m.name === '备用模型').id)
    await settingsPage.getByLabel('使用模型', { exact: true }).selectOption(secondId)
    await settingsPage.getByLabel('系统提示词', { exact: true }).fill('你是审阅专家，只分析代码。')
    await settingsPage.getByRole('button', { name: '代码图标', exact: true }).click()
    await settingsPage.getByRole('button', { name: '保存助手', exact: true }).click()
    await expect(settingsPage.getByRole('button', { name: /代码搭档 备用模型/ })).toBeVisible()
    await settingsPage.screenshot({ path: 'test-results/assistants-light.png' })
    // Unsaved changes must not disappear during navigation.
    await settingsPage.getByLabel('助手名称', { exact: true }).fill('未保存的名称')
    await settingsPage.getByRole('button', { name: /模型管理/ }).click()
    await expect(settingsPage.getByRole('dialog')).toContainText('尚未保存')
    await settingsPage.getByRole('button', { name: '放弃更改', exact: true }).click()
    await settingsPage.getByRole('button', { name: /备用模型 second-model/ }).click()
    await settingsPage.getByRole('button', { name: '删除模型', exact: true }).click()
    await settingsPage.getByRole('button', { name: '确认删除', exact: true }).click()
    await expect(settingsPage.getByRole('alert')).toContainText('仍被助手使用')
    await settingsPage.getByRole('button', { name: /通用设置/ }).click()
    await settingsPage.getByRole('button', { name: '深色', exact: true }).click()
    await settingsPage.getByRole('button', { name: /保存/ }).click()
    await expect.poll(() => app!.evaluate(({ nativeTheme }) => nativeTheme.themeSource)).toBe('dark')
    await settingsPage.emulateMedia({ colorScheme: null })
    await expect.poll(() => settingsPage.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true)
    await app.evaluate(({ globalShortcut }) => globalShortcut.register('Command+Control+Alt+K', () => {}))
    await settingsPage.getByRole('button', { name: /全局快捷键/ }).click()
    await settingsPage.getByRole('button', { name: /全局快捷键/ }).press('Meta+Control+Alt+K')
    await settingsPage.getByRole('button', { name: /保存/ }).click()
    await expect(settingsPage.getByRole('alert')).toContainText('已被占用')
    expect(await app.evaluate(({ globalShortcut }) => globalShortcut.isRegistered('Command+Control+Alt+J'))).toBe(true)
    await app.evaluate(({ globalShortcut }) => globalShortcut.unregister('Command+Control+Alt+K'))
    await settingsPage.getByRole('button', { name: /保存/ }).click()
    await expect(settingsPage.getByRole('alert')).toHaveCount(0)
    await settingsPage.screenshot({ path: 'test-results/settings-dark.png' })
    await settingsPage.getByRole('button', { name: '浅色', exact: true }).click()
    await settingsPage.getByRole('button', { name: /保存/ }).click()
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('settings.html'))?.close()
      const quick = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('quick.html'))!
      quick.show(); quick.focus()
    })
    const quick = app.windows().find((p) => p.url().includes('quick.html'))!
    const input = quick.getByPlaceholder('输入问题或选择下方功能…')
    await expect(quick.getByText('剪贴板验收一', { exact: true })).toBeVisible()
    await input.fill('第一问')
    await input.press('Enter')
    await expect(quick.locator('.markdown strong')).toHaveText('验收通过')
    await expect(quick.locator('.markdown pre code')).toContainText('const ok = true')
    await expect(quick.getByRole('button', { name: '复制', exact: true })).toBeVisible()
    expect(requests.at(-1).messages[0].content).toBe('剪贴板验收一\n\n第一问')
    await quick.screenshot({ path: 'test-results/chat-light.png' })
    await input.fill('追问')
    await input.press('Enter')
    await expect.poll(() => requests.length).toBe(2)
    expect(requests[1].messages).toHaveLength(3)
    await expect(quick.getByRole('button', { name: 'Esc 返回' })).toBeVisible()
    await input.press('Escape')
    await app.evaluate(({ clipboard }) => clipboard.writeText('剪贴板验收二'))
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('quick.html'))!
      w.hide()
    })
    await app.evaluate(({ app }) => app.emit('activate'))
    await expect(quick.getByText('剪贴板验收二', { exact: true })).toBeVisible()
    await quick.getByRole('button', { name: '对话', exact: true }).click()
    await expect.poll(() => requests.length).toBe(3)
    expect(requests[2].messages).toEqual([{ role: 'user', content: '剪贴板验收二' }])
    await expect(quick.getByRole('button', { name: 'Esc 返回' })).toBeVisible()
    await input.press('Escape')
    await quick.getByRole('button', { name: '关闭', exact: true }).click()
    for (const [feature, prompt] of [['总结', '请总结以下内容'], ['解释', '请用通俗易懂的中文解释']]) {
      await input.fill('验收功能文本')
      await quick.getByRole('button', { name: feature, exact: true }).click()
      await expect(quick.getByRole('button', { name: 'Esc 返回' })).toBeVisible()
      expect(requests.at(-1).messages[0].content).toContain(prompt)
      await input.press('Escape')
      const preview = quick.getByRole('button', { name: '关闭', exact: true })
      if (await preview.count()) await preview.click()
    }
    await input.fill('Hello')
    await quick.getByRole('button', { name: '翻译', exact: true }).click()
    await expect(quick.getByText('这是翻译结果。', { exact: true })).toBeVisible()
    await quick.getByRole('button', { name: '复制', exact: true }).click()
    expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe('这是翻译结果。')
    await input.fill('SLOW')
    await input.press('Enter')
    await expect(quick.getByRole('button', { name: 'Esc 暂停' })).toBeVisible()
    await input.press('Escape')
    await expect(quick.getByRole('button', { name: 'Esc 返回' })).toBeVisible()
    await input.fill('FAIL')
    await input.press('Enter')
    await expect(quick.getByRole('alert')).toContainText('API Key 无效')
    await quick.screenshot({ path: 'test-results/translation-error.png' })
    await input.press('Escape')
    await app.evaluate(({ app }) => app.emit('activate'))
    await quick.getByRole('button', { name: '固定', exact: true }).click()
    await quick.evaluate(() => (window as any).api.config.get())
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].emit('blur'))
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible())).toBe(true)
    await app.evaluate(({ app }) => app.emit('activate'))
    await quick.getByRole('button', { name: '固定', exact: true }).click()
    await quick.evaluate(() => (window as any).api.config.get())
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].emit('blur'))
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible())).toBe(false)
    await app.evaluate(({ app }) => app.emit('activate'))
    await expect(input).toBeFocused()
    // Switching assistant must select its own model, Key and prompt, without old history.
    await quick.getByRole('button', { name: '选择助手', exact: true }).click()
    await quick.getByRole('menuitemradio', { name: /代码搭档/ }).click()
    const preview = quick.getByRole('button', { name: '关闭', exact: true })
    if (await preview.count()) await preview.click()
    await quick.getByRole('button', { name: '选择助手', exact: true }).click()
    await quick.screenshot({ path: 'test-results/assistant-picker.png' })
    await quick.getByRole('button', { name: '选择助手', exact: true }).click()
    await input.fill('检查这段代码')
    await input.press('Enter')
    await expect(quick.getByRole('button', { name: 'Esc 返回' })).toBeVisible()
    expect(requests.at(-1).model).toBe('second-model')
    expect(requests.at(-1).authorization).toBe('Bearer second-test-key')
    expect(requests.at(-1).messages).toEqual([{ role: 'system', content: '你是审阅专家，只分析代码。' }, { role: 'user', content: '检查这段代码' }])
    expect(requests.at(-1).thinking).toEqual({ type: 'disabled' })
    expect(requests.at(-1)).not.toHaveProperty('reasoning_effort')
    // Toggle the persisted setting in the real UI, then verify the next streamed HTTP request.
    const settingsOpened = app.waitForEvent('window', { predicate: (p) => p.url().includes('settings.html') })
    await quick.getByRole('button', { name: '设置', exact: true }).click()
    const modelSettings = await settingsOpened
    await modelSettings.getByRole('button', { name: /模型管理/ }).click()
    await modelSettings.getByRole('button', { name: /备用模型 second-model/ }).click()
    await expect(modelSettings.getByRole('switch', { name: '深度思考', exact: true })).not.toBeChecked()
    await modelSettings.getByRole('switch', { name: '深度思考', exact: true }).click()
    await modelSettings.getByLabel('思考强度', { exact: true }).selectOption('low')
    await modelSettings.getByRole('button', { name: '保存模型', exact: true }).click()
    await expect(modelSettings.getByRole('status')).toContainText('已保存')
    await modelSettings.locator('.thinking-settings').scrollIntoViewIfNeeded()
    await modelSettings.screenshot({ path: 'test-results/model-thinking.png' })
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('settings.html'))?.close()
      const w = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('quick.html'))!
      w.show(); w.focus()
    })
    const newPreview = quick.getByRole('button', { name: '关闭', exact: true })
    if (await newPreview.count()) await newPreview.click()
    await input.fill('再次检查')
    await input.press('Enter')
    await expect(quick.getByRole('button', { name: 'Esc 返回' })).toBeVisible()
    expect(requests.at(-1).thinking).toEqual({ type: 'enabled' })
    expect(requests.at(-1).reasoning_effort).toBe('low')
    expect(requests.at(-1).messages).toHaveLength(2)

    await quick.getByRole('button', { name: '选择助手', exact: true }).click()
    await quick.getByRole('menuitemradio', { name: /日常助手/ }).click()
    await expect(quick.locator('.markdown')).toHaveCount(0)
    await app.evaluate(({ clipboard }) => {
      clipboard.clear()
      for (const [format, buffer] of (globalThis as any).__clipboardBackup) clipboard.writeBuffer(format, buffer)
      delete (globalThis as any).__clipboardBackup
    })
    await app.close()
    app = await launch()
    expect(await app.evaluate(({ nativeTheme }) => nativeTheme.themeSource)).toBe('light')
    expect(await app.evaluate(({ globalShortcut }) => globalShortcut.isRegistered('Command+Control+Alt+K'))).toBe(true)
    expect(app.windows().some((p) => p.url().includes('settings.html'))).toBe(false)
    const restoredQuick = await app.firstWindow()
    await restoredQuick.waitForURL('**/quick.html')
    const restored = await restoredQuick.evaluate(() => (window as any).api.config.get())
    expect(restored.models).toHaveLength(2)
    expect(restored.models.find((m: any) => m.name === '备用模型')).toMatchObject({ presetId: 'deepseek/flash', thinking: 'enabled', thinkingEffort: 'low' })
    expect(restored.models.every((model: any) => model.hasApiKey)).toBe(true)
    expect(restored.assistants.find((assistant: any) => assistant.name === '代码搭档').systemPrompt).toBe('你是审阅专家，只分析代码。')
    expect(restored.activeAssistantId).toBe('default-assistant')
  } finally {
    if (app) {
      await app.evaluate(({ clipboard }) => {
        if (!(globalThis as any).__clipboardBackup) return
        clipboard.clear()
        for (const [format, buffer] of (globalThis as any).__clipboardBackup) clipboard.writeBuffer(format, buffer)
      }).catch(() => {})
      await app.close().catch(() => {})
    }
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await rm(dir, { recursive: true, force: true })
  }
})
