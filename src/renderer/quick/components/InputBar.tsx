import React, { useRef } from 'react'

import { Input } from './ui'

interface Props {
  text: string
  placeholder: string
  loading: boolean
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

const InputBar = ({ ref, text, placeholder, loading, handleKeyDown, handleChange }: Props & { ref?: React.Ref<HTMLDivElement> }) => {
  const inputRef = useRef<HTMLInputElement>(null)
  if (!loading) {
    setTimeout(() => inputRef.current?.focus(), 0)
  }
  return (
    <div ref={ref} className="mt-2.5 flex items-center gap-2">
      <Input
        ref={inputRef}
        value={text}
        placeholder={placeholder}
        autoFocus
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        className="h-auto rounded-none border-0 px-0 py-0 text-lg shadow-none placeholder:text-muted-foreground"
      />
    </div>
  )
}
InputBar.displayName = 'InputBar'

export default InputBar
