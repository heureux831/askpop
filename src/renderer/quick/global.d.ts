import type { PublicConfig, StoredConfig, ModelInput, AssistantInput } from '@shared/config'

declare global {
  interface Window {
    api: {
      clipboard: {
        readText(): Promise<string>
        writeText(text: string): Promise<void>
      }
      models: {
        save(input: ModelInput): Promise<PublicConfig>
        delete(id: string): Promise<PublicConfig>
      }
      assistants: {
        save(input: AssistantInput): Promise<PublicConfig>
        delete(id: string): Promise<PublicConfig>
        select(id: string): Promise<PublicConfig>
      }
      config: {
        onChanged(cb: (config: PublicConfig) => void): () => void
        get(): Promise<PublicConfig>
        set(cfg: Partial<StoredConfig>): Promise<void>
        setKey(apiKey: string): Promise<void>
      }
      chat: {
        stream(req: { requestId: string; assistantId?: string; messages: { role: 'user' | 'assistant'; content: string }[]; system?: string }): void
        abort(): void
        onChunk(cb: (text: string, requestId: string) => void): () => void
        onDone(cb: (requestId: string) => void): () => void
        onError(cb: (message: string, requestId: string) => void): () => void
      }
      quick: {
        beginDrag(point: { x: number; y: number }): void
        moveDrag(point: { x: number; y: number }): void
        endDrag(): void
        hide(): void
        setPin(pinned: boolean): void
        onShown(cb: () => void): () => void
      }
      settings: {
        open(): void
      }
    }
  }
}

export {}
