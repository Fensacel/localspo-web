'use client'

import { useEffect } from 'react'
import { startBackgroundSync } from '@/lib/syncManager'

export function SyncManagerProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Start background sync scheduler (checks every 10 minutes)
    startBackgroundSync(10 * 60 * 1000)
  }, [])

  return <>{children}</>
}
