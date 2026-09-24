// Observe reasoning alongside the SDK's normal answer parser. Forward the original
// bytes unchanged, without buffering the response or consuming a second stream.
export function observeReasoning(response: Response, onReasoning?: (text: string) => void): Response {
  if (!onReasoning || !response.ok || !response.body || !response.headers.get('content-type')?.includes('text/event-stream')) return response
  const decoder = new TextDecoder()
  let buffer = '', data: string[] = []
  const dispatch = () => {
    if (!data.length) return
    const payload = data.join('\n'); data = []
    if (payload === '[DONE]') return
    let event: any
    try { event = JSON.parse(payload) } catch { return }
    const delta = event.choices?.[0]?.delta
    const reasoning = delta?.reasoning_content ?? delta?.reasoning
    if (typeof reasoning === 'string' && reasoning) onReasoning(reasoning)
    if (event.type === 'content_block_delta' && event.delta?.type === 'thinking_delta' && typeof event.delta.thinking === 'string') onReasoning(event.delta.thinking)
    if (event.type === 'content_block_start' && event.content_block?.type === 'thinking' && event.content_block.thinking) onReasoning(event.content_block.thinking)
  }
  const consume = (text: string, final = false) => {
    buffer += text
    let index: number
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).replace(/\r$/, ''); buffer = buffer.slice(index + 1)
      if (!line) dispatch()
      else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
    }
    if (final) { if (buffer.startsWith('data:')) data.push(buffer.slice(5).trimStart()); dispatch() }
  }
  return new Response(response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) { consume(decoder.decode(chunk, { stream: true })); controller.enqueue(chunk) },
    flush() { consume(decoder.decode(), true) }
  })), { status: response.status, statusText: response.statusText, headers: response.headers })
}
