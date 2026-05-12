"use client"
import { toast as sonnerToast } from 'sonner'
import type { ToastOptions } from '@/types/toast'

export function useToast() {
  function toast(opts: ToastOptions) {
    const { title = '', description = '', variant } = opts || {}
    const text = description ? `${title} — ${description}` : title || String(description)

    if (variant === 'destructive') {
      sonnerToast.error(text)
    } else {
      sonnerToast(text)
    }
  }

  return { toast }
}

export default useToast
