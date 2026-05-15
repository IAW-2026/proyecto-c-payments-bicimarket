'use client'

import React from 'react'

export default function EmptyStateMobile({ title = 'No hay datos', description }: { title?: string; description?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="h-28 w-28 rounded-full bg-muted flex items-center justify-center text-3xl font-semibold text-muted-foreground">—</div>
      <div className="text-lg font-semibold text-foreground">{title}</div>
      {description && <div className="max-w-xs text-sm text-muted-foreground">{description}</div>}
    </div>
  )
}
