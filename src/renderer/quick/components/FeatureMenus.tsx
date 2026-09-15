import { CornerDownLeft, FileText, Languages, Lightbulb, MessageSquare } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { useImperativeHandle, useMemo, useState } from 'react'

import { Scrollbar } from './ui'

export type MiniRoute = 'home' | 'chat' | 'translate' | 'summary' | 'explanation'

interface Props {
  text: string
  setRoute: Dispatch<SetStateAction<MiniRoute>>
  onSendMessage: (prompt?: string) => void
}

export interface FeatureMenusRef {
  nextFeature(): void
  prevFeature(): void
  useFeature(): void
  resetSelectedIndex(): void
}

const PROMPT_SUMMARY = '请总结以下内容，用简洁的中文概括要点：'
const PROMPT_EXPLANATION = '请用通俗易懂的中文解释以下内容：'

const FeatureMenus = ({ ref, text, setRoute, onSendMessage }: Props & { ref?: React.RefObject<FeatureMenusRef | null> }) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const features = useMemo(
    () => [
      {
        icon: <MessageSquare className="size-4" />,
        title: '对话',
        onClick: () => {
          if (text) {
            setRoute('chat')
            onSendMessage()
          }
        }
      },
      {
        icon: <Languages className="size-4" />,
        title: '翻译',
        onClick: () => text && setRoute('translate')
      },
      {
        icon: <FileText className="size-4" />,
        title: '总结',
        onClick: () => {
          if (text) {
            setRoute('summary')
            onSendMessage(PROMPT_SUMMARY)
          }
        }
      },
      {
        icon: <Lightbulb className="size-4" />,
        title: '解释',
        onClick: () => {
          if (text) {
            setRoute('explanation')
            onSendMessage(PROMPT_EXPLANATION)
          }
        }
      }
    ],
    [onSendMessage, setRoute, text]
  )

  useImperativeHandle(ref, () => ({
    nextFeature: () => setSelectedIndex((p) => (p < features.length - 1 ? p + 1 : 0)),
    prevFeature: () => setSelectedIndex((p) => (p > 0 ? p - 1 : features.length - 1)),
    useFeature: () => features[selectedIndex].onClick?.(),
    resetSelectedIndex: () => setSelectedIndex(0)
  }))

  return (
    <Scrollbar className="h-auto shrink-0">
      <div className="flex cursor-pointer flex-col gap-1">
        {features.map((feature, index) => (
          <button
            type="button"
            key={index}
            onClick={feature.onClick}
            className={`flex w-full cursor-pointer flex-row items-center gap-3 rounded-lg border-0 bg-transparent px-4 py-2 text-left transition-colors select-none hover:bg-accent ${
              index === selectedIndex ? 'bg-accent' : ''
            }`}>
            {feature.icon}
            <span className="m-0 flex-1 text-sm">{feature.title}</span>
            {index === selectedIndex && <CornerDownLeft className="size-4 text-muted-foreground" />}
          </button>
        ))}
      </div>
    </Scrollbar>
  )
}
FeatureMenus.displayName = 'FeatureMenus'

export default FeatureMenus
