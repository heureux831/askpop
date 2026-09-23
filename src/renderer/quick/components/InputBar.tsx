import React, { forwardRef, useEffect, useRef } from 'react'

import { ArrowUp, Loader2 } from 'lucide-react'
import { Input } from './ui'

interface Props {
  text: string
  placeholder: string
  loading: boolean
  onSubmit?: () => void
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

const InputBar = forwardRef<HTMLDivElement, Props>(({ text, placeholder, loading, onSubmit, handleKeyDown, handleChange }, ref) => {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => window.api.quick.onShown(() => inputRef.current?.focus()), [])
  useEffect(() => {
    if (!loading) inputRef.current?.focus()
  }, [loading])
  return (
    <div ref={ref} className="quick-input">
      <Input
        ref={inputRef}
        value={text}
        placeholder={placeholder}
        autoFocus
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        className="h-auto rounded-none border-0 px-0 py-0 text-lg shadow-none placeholder:text-muted-foreground"
      />
      <button type="button" className="send-button" aria-label="发送" onClick={onSubmit} disabled={loading}>{loading ? <Loader2 size={17} className="animate-spin" /> : <ArrowUp size={18} />}</button>
    </div>
  )
})
InputBar.displayName = 'InputBar'

export default InputBar
