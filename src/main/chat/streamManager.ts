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
      if (this.active.get(sender.id) === controller) {
        this.active.delete(sender.id)
      }
    }
  }

  abortFor(sender: WebContents): void {
    this.active.get(sender.id)?.abort()
    this.active.delete(sender.id)
  }
}

export const streamManager = new StreamManager()
