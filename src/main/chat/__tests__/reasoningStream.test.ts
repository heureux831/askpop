import { describe, it, expect, vi } from 'vitest'
import { observeReasoning } from '../reasoningStream'
function response(text: string) {
  const bytes = new TextEncoder().encode(text)
  return new Response(new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close() } }), { headers: { 'content-type': 'text/event-stream' } })
}
describe('reasoning stream observer', () => {
  it('handles split UTF-8, CRLF, comments, malformed data and forwards original bytes', async () => {
    const input = ': heartbeat\r\ndata: {"choices":[{"delta":{"reasoning_content":"中文思考"}}]}\r\n\r\ndata: invalid\n\ndata: {"choices":[{"delta":{"content":"answer"}}]}\n\ndata: {"choices":[{"delta":{"reasoning":"more"}}]}\n\ndata: [DONE]\n\n'
    const reasoning: string[] = []
    const result = observeReasoning(response(input), (s) => reasoning.push(s))
    expect(await result.text()).toBe(input)
    expect(reasoning).toEqual(['中文思考', 'more'])
  })
  it('handles Anthropic thinking and excludes signatures', async () => {
    const reasoning: string[] = []
    const input = 'data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"分析"}}\n\ndata: {"type":"content_block_delta","delta":{"type":"signature_delta","signature":"secret"}}\n\n'
    await observeReasoning(response(input), (s) => reasoning.push(s)).text()
    expect(reasoning).toEqual(['分析'])
  })
  it('forwards cancellation to the underlying response', async () => {
    let cancelled = false
    const result = observeReasoning(new Response(new ReadableStream({ cancel() { cancelled = true } }), { headers: { 'content-type': 'text/event-stream' } }), () => {})
    await result.body!.cancel()
    await vi.waitFor(() => expect(cancelled).toBe(true))
  })
})
