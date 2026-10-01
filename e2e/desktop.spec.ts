import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test'
import { createServer } from 'node:http'
import { mkdtemp, readFile, stat, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// Launch the real Electron main/preload/renderer against an isolated, deterministic API.
test('桌面核心流程、翻译、错误反馈、主题与配置持久化', async () => {
  const requests: any[] = []
  let moreReasoning = () => {}, finishThinking = () => {}
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
    let timer: ReturnType<typeof setInterval> | undefined
    const startAnswer = () => { timer = setInterval(() => {
      if (index < text.length) {
        res.write(`data: ${JSON.stringify({ id: 'test', object: 'chat.completion.chunk', created: 1, model: 'test-model', choices: [{ index: 0, delta: { content: text.slice(index, index + 3) }, finish_reason: null }] })}\n\n`)
        index += 3
      } else {
        clearInterval(timer)
        res.write(`data: ${JSON.stringify({ id: 'test', object: 'chat.completion.chunk', created: 1, model: 'test-model', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`)
        res.end()
      }
    }, content.includes('SLOW') ? 500 : 25)
    }
    if (content.includes('THINK')) {
      const emitReasoning = () => res.write(`data: ${JSON.stringify({ id: 'test', object: 'chat.completion.chunk', created: 1, model: 'test-model', choices: [{ index: 0, delta: { reasoning_content: '先理解用户的问题，再逐项检查条件。\n'.repeat(30) }, finish_reason: null }] })}\n\n`)
      emitReasoning(); moreReasoning = emitReasoning; finishThinking = startAnswer
    } else startAnswer()
    res.on('close', () => clearInterval(timer))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as { port: number }).port
  const dir = await mkdtemp(join(tmpdir(), 'quick-assistant-e2e-'))
  const launcher = join(dir, 'launch.cjs')
  await writeFile(join(dir, 'config.json'), JSON.stringify({ hotkey: 'Command+Control+Alt+J' }))
  await writeFile(launcher, `
    const { app, safeStorage } = require('electron');
    app.setPath('userData', ${JSON.stringify(dir)});
    // Reproduce the original failure: system encryption is unavailable for this entire run.
    safeStorage.isEncryptionAvailable = () => false;
    safeStorage.encryptString = () => { throw new Error('Encryption is not available.'); };
    require(${JSON.stringify(resolve('out/main/index.js'))});
  `)
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
    await expect(settingsPage.locator('.entity-list .provider-logo img')).toHaveCount(12)
    await settingsPage.getByLabel('API 地址', { exact: true }).fill(`http://127.0.0.1:${port}/v1`)
    await settingsPage.getByLabel('API Key', { exact: true }).fill('test-only-key')
    await settingsPage.getByRole('button', { name: '保存服务商', exact: true }).click()
    await expect(settingsPage.getByRole('status')).toContainText('已保存')
    await expect(settingsPage.getByLabel('API Key', { exact: true })).toHaveValue('')
    expect((await readFile(join(dir, 'secrets.sqlite'))).subarray(0, 16).toString()).toBe('SQLite format 3\0')
    expect((await stat(join(dir, 'secrets.sqlite'))).mode & 0o777).toBe(0o600)
    await settingsPage.getByRole('button', { name: '编辑模型 默认模型', exact: true }).click()
    await settingsPage.getByLabel('API 模型 ID', { exact: true }).fill('test-model')
    await settingsPage.getByLabel('显示名称', { exact: true }).fill('默认模型')
    await settingsPage.getByRole('button', { name: '保存模型', exact: true }).click()
    await settingsPage.getByRole('button', { name: '添加模型', exact: true }).click()
    await settingsPage.getByLabel('API 模型 ID', { exact: true }).fill('second-model')
    await expect(settingsPage.getByLabel('显示名称', { exact: true })).toHaveValue('second-model')
    await settingsPage.getByLabel('显示名称', { exact: true }).fill('备用模型')
    await settingsPage.getByLabel('温度', { exact: true }).fill('0.4')
    await settingsPage.screenshot({ path: 'test-results/model-editor.png' })
    await settingsPage.getByRole('button', { name: '保存模型', exact: true }).click()
    await expect(settingsPage.getByRole('button', { name: '编辑模型 备用模型', exact: true })).toBeVisible()
    await settingsPage.screenshot({ path: 'test-results/providers-light.png' })
    await settingsPage.getByRole('button', { name: /快捷任务/ }).click()
    await settingsPage.getByRole('button', { name: '添加任务', exact: true }).click()
    await settingsPage.getByLabel('任务标题', { exact: true }).fill('检查逻辑')
    await settingsPage.getByLabel('任务说明', { exact: true }).fill('检查论证中的遗漏')
    await settingsPage.getByLabel('任务提示词', { exact: true }).fill('请找出逻辑问题，并提出改进建议。')
    await settingsPage.getByRole('button', { name: '上移 检查逻辑', exact: true }).click()
    await settingsPage.getByRole('button', { name: '保存任务', exact: true }).click()
    await expect(settingsPage.getByRole('status')).toContainText('已保存')
    await settingsPage.screenshot({ path: 'test-results/tasks-light.png' })
    await settingsPage.getByRole('button', { name: /助手管理/ }).click()
    await settingsPage.getByRole('button', { name: '创建助手', exact: true }).click()
    await settingsPage.getByLabel('助手名称', { exact: true }).fill('代码搭档')
    const secondId = await settingsPage.evaluate(async () => (await (window as any).api.config.get()).models.find((m: any) => m.name === '备用模型').id)
    await expect(settingsPage.locator('select[aria-label="使用模型"] optgroup[label="OpenAI"] option')).toHaveCount(2)
    await settingsPage.getByLabel('使用模型', { exact: true }).selectOption(secondId)
    await settingsPage.getByLabel('系统提示词', { exact: true }).fill('你是审阅专家，只分析代码。')
    await settingsPage.getByRole('button', { name: '代码图标', exact: true }).click()
    await settingsPage.getByRole('button', { name: '保存助手', exact: true }).click()
    await expect(settingsPage.getByRole('button', { name: /代码搭档 备用模型/ })).toBeVisible()
    await settingsPage.screenshot({ path: 'test-results/assistants-light.png' })
    // Unsaved changes must not disappear during navigation.
    await settingsPage.getByLabel('助手名称', { exact: true }).fill('未保存的名称')
    await settingsPage.getByRole('button', { name: /模型服务/ }).click()
    await expect(settingsPage.getByRole('dialog')).toContainText('尚未保存')
    await settingsPage.getByRole('button', { name: '放弃更改', exact: true }).click()
    await settingsPage.getByRole('button', { name: '删除模型 备用模型', exact: true }).click()
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
    for (const [feature, prompt] of [['总结', '请总结用户提供的内容'], ['解释', '请用通俗易懂的中文解释']]) {
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
    expect(requests.at(-1).authorization).toBe('Bearer test-only-key')
    expect(requests.at(-1).temperature).toBe(0.4)
    expect(requests.at(-1).messages).toEqual([{ role: 'system', content: '你是审阅专家，只分析代码。' }, { role: 'user', content: '检查这段代码' }])
    await input.press('Escape')
    const taskButtons = await quick.locator('.feature-list button').allTextContents()
    expect(taskButtons.findIndex((t) => t.includes('检查逻辑'))).toBeLessThan(taskButtons.findIndex((t) => t.includes('解释')))
    const taskPreview = quick.getByRole('button', { name: '关闭', exact: true })
    if (await taskPreview.count()) await taskPreview.click()
    await input.fill('THINK 检查论证')
    const boundsBefore = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('quick.html'))!.getBounds())
    await quick.getByRole('button', { name: '检查逻辑', exact: true }).click()
    await expect(quick.getByLabel('思考内容', { exact: true })).toBeVisible()
    expect(requests.at(-1).messages).toEqual([{ role: 'system', content: '你是审阅专家，只分析代码。\n\n请找出逻辑问题，并提出改进建议。' }, { role: 'user', content: 'THINK 检查论证' }])
    const reasoning = quick.getByLabel('思考内容', { exact: true })
    const boxBefore = await reasoning.boundingBox()
    await reasoning.evaluate((el) => { el.scrollTop = 0; el.dispatchEvent(new Event('scroll')) })
    const scrollBefore = await quick.getByTestId('message-scroll').evaluate((el) => el.scrollTop)
    moreReasoning()
    await expect.poll(() => reasoning.textContent()).toContain('先理解')
    await expect.poll(() => reasoning.evaluate((el) => el.textContent!.split('\n').length)).toBeGreaterThan(50)
    expect((await reasoning.boundingBox())!.height).toBe(boxBefore!.height)
    expect(await reasoning.evaluate((el) => el.scrollTop)).toBe(0)
    expect(await quick.getByTestId('message-scroll').evaluate((el) => el.scrollTop)).toBe(scrollBefore)
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('quick.html'))!.getBounds())).toEqual(boundsBefore)
    await quick.screenshot({ path: 'test-results/reasoning-stream.png' })
    finishThinking()
    await expect(quick.getByRole('button', { name: 'Esc 返回' })).toBeVisible()
    await expect(reasoning).toHaveCount(0)
    await quick.getByRole('button', { name: '思考过程', exact: true }).click()
    await expect(reasoning).toBeVisible()
    await quick.screenshot({ path: 'test-results/reasoning-expanded.png' })
    await input.fill('继续检查')
    await input.press('Enter')
    await expect(quick.getByRole('button', { name: 'Esc 返回' })).toBeVisible()
    expect(requests.at(-1).messages[0].content).toBe('你是审阅专家，只分析代码。\n\n请找出逻辑问题，并提出改进建议。')
    expect(requests.at(-1).messages).toHaveLength(4)
    expect(JSON.stringify(requests.at(-1).messages)).not.toContain('先理解')

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
    // Wait for app.whenReady() and the window to load before checking restored state.
    const restoredQuick = await app.firstWindow()
    await restoredQuick.waitForURL('**/quick.html')
    expect(await app.evaluate(({ nativeTheme }) => nativeTheme.themeSource)).toBe('light')
    expect(await app.evaluate(({ globalShortcut }) => globalShortcut.isRegistered('Command+Control+Alt+K'))).toBe(true)
    expect(app.windows().some((p) => p.url().includes('settings.html'))).toBe(false)
    const restored = await restoredQuick.evaluate(() => (window as any).api.config.get())
    expect(restored.models).toHaveLength(2)
    expect(restored.models.find((m: any) => m.name === '备用模型')).toMatchObject({ modelId: 'second-model', temperature: 0.4 })
    expect(restored.models.every((model: any) => model.hasApiKey)).toBe(true)
    expect(restored.assistants.find((assistant: any) => assistant.name === '代码搭档').systemPrompt).toBe('你是审阅专家，只分析代码。')
    expect(restored.tasks.map((t: any) => t.title)).toEqual(['对话', '翻译', '总结', '检查逻辑', '解释'])
    expect(restored.providers.find((p: any) => p.name === 'OpenAI').hasApiKey).toBe(true)
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
