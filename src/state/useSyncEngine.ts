import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { db } from '../db/schema'
import { isCloudConfigured } from '../lib/supabase'
import { syncNow, type SyncState } from '../lib/sync'

/**
 * Drains the sync queue whenever there is something in it, plus on the two moments iOS
 * actually gives us: returning to the app, and regaining a connection. There is no
 * background sync on iOS, so those are the only reliable triggers.
 */
export function useSyncEngine(): { pending: number; state: SyncState } {
  const pending = useLiveQuery(() => db.syncQueue.count(), [], 0) ?? 0
  const [state, setState] = useState<SyncState>('idle')
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (!isCloudConfigured) return

    const run = async () => {
      if (timer.current) window.clearTimeout(timer.current)
      // Debounced: tapping a counter ten times in a row should cause one push, not ten.
      timer.current = window.setTimeout(async () => {
        setState('syncing')
        setState(await syncNow())
      }, 1200)
    }

    if (pending > 0) void run()

    const onVisible = () => document.visibilityState === 'visible' && pending > 0 && void run()
    const onOnline = () => void run()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [pending])

  return { pending, state }
}
