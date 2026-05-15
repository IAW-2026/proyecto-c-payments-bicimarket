'use client'

import React from 'react'

export default function LoadingStateMobile() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="animate-pulse h-16 w-16 rounded-full bg-muted" />
      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      <div className="h-3 w-48 animate-pulse rounded bg-muted" />
    </div>
  )
}
