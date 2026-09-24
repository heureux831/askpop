import { Boxes } from 'lucide-react'
import { PROVIDER_PRESETS } from '@shared/providers'
const assets = import.meta.glob('../assets/providers/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
export default function ProviderLogo({ presetId, size = 28 }: { presetId: string; size?: number }) {
  const icon = PROVIDER_PRESETS.find((p) => p.id === presetId)?.icon
  const url = assets[`../assets/providers/${icon}.svg`]
  return <span className="provider-logo" style={{ width: size + 14, height: size + 14 }}>{url ? <img src={url} alt="" width={size} height={size} /> : <Boxes size={size} />}</span>
}
