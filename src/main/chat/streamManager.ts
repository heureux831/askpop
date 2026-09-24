import { getTaskPrompt } from '../config/catalog'
import type { WebContents } from 'electron'
import { streamText, type CoreMessage } from 'ai'

import { IPC } from '@shared/ipc'

import { getResolvedConfig, resolveModel } from '../config/resolve'

export interface StreamRequest {
  taskId?: string
  assistantId?: string
  requestId?: string
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

    const controller = new AbortController()
    this.active.set(sender.id, controller)

    const emit = (channel: string, payload: Record<string, unknown> = {}) => {
      if (!controller.signal.aborted && this.active.get(sender.id) === controller && !sender.isDestroyed?.()) {
        sender.send(channel, { ...payload, requestId: req.requestId })
      }
    }
    let apiKey = ''
    const errorMessage = (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      return apiKey ? message.split(apiKey).join('[已隐藏]') : message
    }
    const impl = this.opts.streamTextImpl ?? streamText
    try {
      const config = getResolvedConfig(req.assistantId)
      apiKey = config.apiKey
      if (!config.apiKey && !config.keyOptional) {
        emit(IPC.events.chatError, { message: 'NO_API_KEY' })
        return
      }
      if (!config.modelId) {
        emit(IPC.events.chatError, { message: 'NO_MODEL' })
        return
      }

      const model = resolveModel(config, (text) => emit(IPC.events.chatReasoning, { text }))
      let streamFailed = false
      const { textStream } = impl({
        model,
        temperature: config.temperature,
        system: [config.systemPrompt, getTaskPrompt(req.taskId), req.system].filter(Boolean).join('\n\n') || undefined,
        messages: req.messages,
        abortSignal: controller.signal,
        onError: ({ error }) => {
          streamFailed = true
          emit(IPC.events.chatError, { message: errorMessage(error) })
        }
      })
      for await (const text of textStream) {
        emit(IPC.events.chatChunk, { text })
      }
      if (!streamFailed) emit(IPC.events.chatDone)
    } catch (err) {
      if (!controller.signal.aborted) {
        emit(IPC.events.chatError, { message: errorMessage(err) })
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
