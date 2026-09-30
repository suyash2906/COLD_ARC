import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { getSetting } from '../db/schema'
import { importHealth } from '../lib/actions'
import type { ISODate } from '../lib/dates'
import { parseHealth, SHORTCUT_NAME, stepsCommitment, workoutCommitment } from '../lib/health'
import type { Arc, Commitment } from '../lib/types'
import { Button } from './ui'

function ago(ms: number): string {
  const min = Math.round((Date.now() - ms) / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`
}

/**
 * Two taps to pull steps and workouts in: Sync runs the "Cold Arc Sync" shortcut, which
 * copies the last week from Apple Health; back here, Paste reads it off the clipboard.
 */
export function HealthSync({ arc, commitments, today }: { arc: Arc; commitments: Commitment[]; today: ISODate }) {
  const [phase, setPhase] = useState<'idle' | 'waiting' | 'working'>('idle')
  const [note, setNote] = useState<string | null>(null)
  const syncedAt = useLiveQuery(() => getSetting<number | null>('healthSyncedAt', null), [], null)

  const steps = stepsCommitment(commitments)
  const workout = workoutCommitment(commitments)
  if (!steps && !workout) return null

  const run = () => {
    setNote(null)
    setPhase('waiting')
    window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT_NAME)}`
  }

  const paste = async () => {
    setPhase('working')
    setNote(null)
    try {
      const parsed = parseHealth(await navigator.clipboard.readText())
      if (!parsed) {
        setNote('No Health data on the clipboard yet. Tap Sync to run the shortcut.')
      } else {
        const result = await importHealth(arc, commitments, parsed, today)
        setNote(result.days ? `Updated ${result.days} ${result.days === 1 ? 'day' : 'days'} from Health.` : 'Already up to date.')
      }
    } catch {
      setNote('Could not read the clipboard. Tap Paste when iOS asks.')
    }
    setPhase('idle')
  }

  const what = [steps && 'steps', workout && 'workouts'].filter(Boolean).join(' and ')

  return (
    <div className="mb-3">
      <div className="flex items-center gap-3 rounded-[18px] bg-white/[0.04] px-4 py-3">
        <span className="text-[18px]" aria-hidden>
          ❤️
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-medium">Apple Health</div>
          <div className="text-faint truncate text-[12px]">
            {phase === 'waiting' ? 'Back from Shortcuts? Tap Paste.' : syncedAt ? `${what} · synced ${ago(syncedAt)}` : `Pull in your ${what}`}
          </div>
        </div>
        {phase === 'waiting' ? (
          <Button size="sm" onClick={() => void paste()}>
            Paste
          </Button>
        ) : (
          <>
            <button onClick={() => void paste()} className="text-muted px-1 text-[13px]" disabled={phase === 'working'}>
              Paste
            </button>
            <Button size="sm" variant="secondary" onClick={run} disabled={phase === 'working'}>
              {phase === 'working' ? 'Syncing…' : 'Sync'}
            </Button>
          </>
        )}
      </div>
      {note && <p className="text-muted mt-2 px-1 text-[12.5px]">{note}</p>}
    </div>
  )
}
