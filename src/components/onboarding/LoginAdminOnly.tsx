'use client'

import React from 'react'
import { Button } from '@/components/ui/button'

export default function LoginAdminOnly({ onLogin }: { onLogin?: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="text-2xl font-semibold text-foreground">Admin access only</div>
      <div className="max-w-sm text-sm text-muted-foreground">This area is restricted to admin users. Use your admin credentials to continue.</div>
      <div className="flex gap-3">
        <Button onClick={onLogin}>Sign in</Button>
      </div>
    </div>
  )
}
