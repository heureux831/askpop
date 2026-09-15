// @vitest-environment jsdom
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

  it('stop 调用 abort 并清空 isStreaming', () => {
    const { api } = mockApi()
    const { result } = renderHook(() => useChatStream())
    act(() => result.current.send('hi'))
    act(() => result.current.stop())
    expect(api.chat.abort).toHaveBeenCalled()
    expect(result.current.isStreaming).toBe(false)
  })
})
