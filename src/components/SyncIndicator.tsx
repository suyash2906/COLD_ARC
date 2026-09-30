import { isCloudConfigured } from '../lib/supabase'
import type { SyncState } from '../lib/sync'

export function SyncIndicator({ pending, state }: { pending: number; state: SyncState }) {
  // Silence is the correct default: nothing to say when everything is already up there,
  // and no point nagging someone who has not signed in.
  if (!isCloudConfigured || pending === 0 || state === 'signed-out') return null

  const label =
    state === 'error' ? 'Sync failed — will retry' : state === 'offline' ? 'Offline · saved on device' : 'Syncing…'

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] z-50 flex justify-center">
      <div
        className={`rounded-full bg-[#111114]/85 px-3.5 py-1.5 text-[12px] backdrop-blur-xl ${
          state === 'error' ? 'text-fail' : 'text-muted'
        }`}
      >
        {label}
      </div>
    </div>
  )
}
