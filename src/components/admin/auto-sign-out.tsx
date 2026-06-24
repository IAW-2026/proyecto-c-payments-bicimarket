"use client"

import { useClerk } from "@clerk/nextjs"
import { useEffect } from "react"

export function AutoSignOut({ delayMs = 5000 }: { delayMs?: number }) {
  const { signOut } = useClerk()

  useEffect(() => {
    const timer = setTimeout(() => {
      signOut({ redirectUrl: "/sign-in" })
    }, delayMs)
    return () => clearTimeout(timer)
  }, [signOut, delayMs])

  return null
}
