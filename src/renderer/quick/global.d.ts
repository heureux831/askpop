import type { PublicConfig, StoredConfig } from '@shared/config'

declare global {
  interface Window {
    api: {
      config: {
        get(): Promise<PublicConfig>
        set(cfg: Partial<StoredConfig>): Promise<void>
        setKey(apiKey: string): Promise<void>
      }
      chat: {
        stream(req: { messages: { role: 'user' | 'assistant'; content: string }[]; system?: string }): void
        abort(): void
        onChunk(cb: (text: string) => void): () => void
        onDone(cb: () => void): () => void
        onError(cb: (message: string) => void): () => void
      }
      quick: {
        hide(): void
        setPin(pinned: boolean): void
        onShown(cb: () => void): () => void
      }
    }
  }
}

export {}
