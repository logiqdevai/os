import * as React from 'react'
import { cn } from '@/lib/utils'
import { useAutoPlaceholder } from '@/hooks/use-auto-placeholder'

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<'textarea'>
>(({ className, placeholder, ...props }, ref) => {
  const autoRef = useAutoPlaceholder(placeholder)
  const setRef = React.useCallback(
    (el: HTMLTextAreaElement | null) => {
      autoRef(el)
      if (typeof ref === 'function') ref(el)
      else if (ref) ref.current = el
    },
    [autoRef, ref]
  )
  return (
    <textarea
      className={cn(
        'flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className
      )}
      ref={setRef}
      placeholder={placeholder}
      {...props}
    />
  )
})
Textarea.displayName = 'Textarea'

export { Textarea }
