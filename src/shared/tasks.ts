export type TaskIcon = 'chat' | 'translate' | 'summary' | 'explanation'
export interface QuickTask { id: string; title: string; description: string; prompt: string; icon: TaskIcon }
export const DEFAULT_TASKS: QuickTask[] = [
  { id: 'chat', title: '对话', description: '随时提问，延续思考', prompt: '', icon: 'chat' },
  { id: 'translate', title: '翻译', description: '跨越语言，准确表达', prompt: '你是一位专业翻译。将用户提供的内容翻译为中文；如果原文是中文，则翻译为英文。只输出译文，保留原文格式。', icon: 'translate' },
  { id: 'summary', title: '总结', description: '提炼长文中的重点', prompt: '请总结用户提供的内容，用简洁的中文概括要点。', icon: 'summary' },
  { id: 'explanation', title: '解释', description: '把复杂的事说清楚', prompt: '请用通俗易懂的中文解释用户提供的内容。', icon: 'explanation' }
]
