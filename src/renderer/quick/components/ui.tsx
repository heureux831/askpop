import { forwardRef } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(props, ref) {
  return (
    <input
      ref={ref}
      {...props}
      className={`w-full bg-transparent outline-none ${props.className ?? ''}`}
    />
  )
})

export function Separator({ className = '' }: { className?: string }) {
  return <div className={`h-px w-full bg-border ${className}`} />
}

export function Scrollbar({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`overflow-y-auto ${className}`}>{children}</div>
}

export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  return <span title={content}>{children}</span>
}
