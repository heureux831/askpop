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
})
