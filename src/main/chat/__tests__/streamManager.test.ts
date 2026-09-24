import { getTaskPrompt } from '../../config/catalog'
vi.mock('../../config/catalog', () => ({ getTaskPrompt: vi.fn() }))
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WebContents } from 'electron'

import { StreamManager } from '../streamManager'
import { getResolvedConfig, resolveModel } from '../../config/resolve'

vi.mock('../../config/resolve', () => ({
  getResolvedConfig: vi.fn(),
  resolveModel: vi.fn()
}))

beforeEach(() => {
  vi.resetAllMocks()
})

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

  it('modelId 为空时发 chat:error（NO_MODEL）且不调用 streamText', async () => {
    vi.mocked(getResolvedConfig).mockReturnValue({ providerId: 'custom', baseURL: 'b', modelId: '', apiKey: 'k', hotkey: '' })
    const fakeStreamText = vi.fn()
    const mgr = new StreamManager({ streamTextImpl: fakeStreamText })
    const { sender, sent } = mockSender()

    await mgr.run(sender, { messages: [] })

    expect(fakeStreamText).not.toHaveBeenCalled()
    expect(sent[0][0]).toBe('chat:error')
    expect((sent[0][1] as { message: string }).message).toBe('NO_MODEL')
  })

  it('resolveModel 抛错时发 chat:error 而非静默失败', async () => {
    vi.mocked(getResolvedConfig).mockReturnValue({ providerId: 'custom', baseURL: '', modelId: 'm', apiKey: 'k', hotkey: '' })
    vi.mocked(resolveModel).mockImplementation(() => {
      throw new Error('invalid baseURL')
    })
    const mgr = new StreamManager({ streamTextImpl: vi.fn() })
    const { sender, sent } = mockSender()

    await mgr.run(sender, { messages: [] })

    expect(sent[0][0]).toBe('chat:error')
    expect((sent[0][1] as { message: string }).message).toBe('invalid baseURL')
  })

  it('重入时旧流的 finally 不会误删新流的 controller，新流仍可被 abort', async () => {
    vi.mocked(getResolvedConfig).mockReturnValue({ providerId: 'openai', baseURL: 'b', modelId: 'm', apiKey: 'k', hotkey: '' })
    const signals: AbortSignal[] = []
    const fakeStreamText = vi.fn()
    fakeStreamText.mockImplementation(({ abortSignal }: { abortSignal: AbortSignal }) => {
      signals.push(abortSignal)
      return {
        textStream: (async function* () {
          await new Promise<void>((_, reject) => {
            if (abortSignal.aborted) return reject(new Error('Aborted'))
            abortSignal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true })
          })
          yield 'x'
        })()
      }
    })
    const mgr = new StreamManager({ streamTextImpl: fakeStreamText })
    const { sender, sent } = mockSender()

    const p1 = mgr.run(sender, { messages: [{ role: 'user', content: 'a' }] })
    const p2 = mgr.run(sender, { messages: [{ role: 'user', content: 'b' }] })

    // 等第一条流完全收尾（其 finally 已执行，可能误删新流的 controller）
    await p1

    // 第二条流仍可被 abort（修复前：active 已被旧流 finally 误删，abort 落空）
    mgr.abortFor(sender)
    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(true)

    await p2
    expect(sent.filter(([ch]) => ch === 'chat:error')).toHaveLength(0)
  })
  it('SDK 通过 onError 报告 HTTP 错误时展示错误且不发送成功事件', async () => {
    vi.mocked(getResolvedConfig).mockReturnValue({ providerId: 'custom', baseURL: 'b', modelId: 'm', apiKey: 'k', hotkey: '' })
    const impl = vi.fn(({ onError }) => ({
      textStream: (async function* () {
        onError({ error: new Error('401 Unauthorized') })
        yield* []
      })()
    }))
    const { sender, sent } = mockSender()
    await new StreamManager({ streamTextImpl: impl as any }).run(sender, { requestId: 'r1', messages: [] })
    expect(sent).toEqual([['chat:error', { message: '401 Unauthorized', requestId: 'r1' }]])
  })

  it('服务错误回显 API Key 时不把密钥发送到渲染进程', async () => {
    vi.mocked(getResolvedConfig).mockReturnValue({ providerId: 'custom', baseURL: 'b', modelId: 'm', apiKey: 'secret-test-key', hotkey: '' })
    const impl = vi.fn(() => { throw new Error('Invalid key: secret-test-key') })
    const { sender, sent } = mockSender()
    await new StreamManager({ streamTextImpl: impl }).run(sender, { requestId: 'r1', messages: [] })
    expect(sent).toEqual([['chat:error', { message: 'Invalid key: [已隐藏]', requestId: 'r1' }]])
  })

  it('助手提示词在前，任务提示词在后，保留温度 0 并转发思考', async () => {
    vi.mocked(getResolvedConfig).mockReturnValue({ providerId: 'custom', baseURL: 'b', modelId: 'api-id', apiKey: 'key', hotkey: '', systemPrompt: '助手提示词', temperature: 0 })
    vi.mocked(getTaskPrompt).mockReturnValue('任务提示词')
    vi.mocked(resolveModel).mockImplementation((_cfg, onReasoning) => { onReasoning?.('思考'); return {} as any })
    const impl = vi.fn().mockReturnValue({ textStream: gen(['回答']) })
    const { sender, sent } = mockSender()
    await new StreamManager({ streamTextImpl: impl }).run(sender, { requestId: 'task-test', taskId: 'custom-task', messages: [{ role: 'user', content: '用户原文' }] })
    expect(getTaskPrompt).toHaveBeenCalledWith('custom-task')
    expect(impl.mock.calls[0][0]).toMatchObject({ system: '助手提示词\n\n任务提示词', temperature: 0, messages: [{ role: 'user', content: '用户原文' }] })
    expect(sent.map(([channel]) => channel)).toEqual(['chat:reasoning', 'chat:chunk', 'chat:done'])
  })

})
