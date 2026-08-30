import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Screen, ScreenTitle } from '../components/ui'
import { endArc, exportArc, importArc } from '../lib/actions'
import { requestPersistence } from '../db/schema'
import { formatShort } from '../lib/dates'
import { arcEnd } from '../lib/actions'
import type { ArcData } from '../state/useArc'

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as { standalone?: boolean }).standalone === true

export default function Settings({ data }: { data: ArcData }) {
  const nav = useNavigate()
  const { arc, streaks } = data
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null))
  }, [])

  async function doExport() {
    if (!arc) return
    const blob = await exportArc(arc.id)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cold-arc-${arc.startDate}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNote('Exported. Save it to Files or iCloud.')
  }

  async function doImport(file: File) {
    try {
      await importArc(file)
      setNote('Import complete.')
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Import failed.')
    }
  }

  if (!arc) return null
  const installed = isStandalone()

  return (
    <Screen>
      <ScreenTitle title="More" />

      {!installed && (
        <section className="card border-ice-400/30 bg-ice-400/[0.05] mb-2.5 px-4 py-4">
          <div className="text-[15px] font-semibold">Put it on your home screen</div>
          {isIOS() ? (
            <ol className="text-muted mt-2.5 space-y-1.5 text-[13px] leading-relaxed">
              <li>1. Open this page in Safari</li>
              <li>
                2. Tap Share <span className="text-fg">􀈂</span> at the bottom
              </li>
              <li>
                3. Choose <span className="text-fg font-medium">Add to Home Screen</span>
              </li>
            </ol>
          ) : (
            <p className="text-muted mt-2 text-[13px] leading-relaxed">
              Use your browser menu and choose Install app or Add to Home Screen.
            </p>
          )}
          <p className="text-faint mt-3 text-[12px] leading-snug">
            Installing is what makes it open full-screen, work offline, and keeps iOS from clearing your data.
          </p>
        </section>
      )}

      <section className="card px-4 py-4">
        <div className="text-faint mb-3 text-[10px] font-semibold tracking-[0.09em] uppercase">Your arc</div>
        <dl className="space-y-2 text-[13.5px]">
          <div className="flex justify-between">
            <dt className="text-muted">Contract</dt>
            <dd>{arc.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Window</dt>
            <dd>
              {formatShort(arc.startDate)} → {formatShort(arcEnd(arc))}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Progress</dt>
            <dd className="tnum">
              {streaks?.elapsed ?? 0} / {arc.totalDays} days
            </dd>
          </div>
        </dl>
        <button
          onClick={() => nav('/contract')}
          className="press border-line text-ice-400 mt-3.5 w-full rounded-xl border py-2.5 text-[13.5px] font-medium"
        >
          Edit contract
        </button>
      </section>

      <section className="card mt-2.5 px-4 py-4">
        <div className="text-faint mb-1 text-[10px] font-semibold tracking-[0.09em] uppercase">Backup</div>
        <p className="text-muted mb-3.5 text-[12.5px] leading-relaxed">
          Journals and photos live only on this phone — they are never uploaded. An export is the only way to get
          them back if you lose the device.
        </p>
        <div className="space-y-2">
          <Button variant="ghost" onClick={doExport}>
            Export everything
          </Button>
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>
            Import from a file
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && void doImport(e.target.files[0])}
          />
        </div>
        {note && <p className="text-ice-300 mt-3 text-[12.5px]">{note}</p>}
      </section>

      <section className="card mt-2.5 px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 pr-3">
            <div className="text-[14px] font-medium">Protected storage</div>
            <div className="text-faint text-[12px] leading-snug">
              {persisted
                ? 'Safari will not evict your data.'
                : 'Not granted yet — installing to the home screen helps.'}
            </div>
          </div>
          {!persisted && (
            <button
              onClick={() => requestPersistence().then(setPersisted)}
              className="press border-line shrink-0 rounded-lg border px-3 py-2 text-[12.5px]"
            >
              Request
            </button>
          )}
        </div>
      </section>

      <section className="mt-6">
        <Button
          variant="danger"
          onClick={() => {
            if (confirm('End this arc? Your history is kept, but you will start a new contract.')) {
              void endArc(arc.id, 'completed')
            }
          }}
        >
          End this arc
        </Button>
      </section>

      <p className="text-faint mt-8 text-center text-[11.5px] leading-relaxed">
        Cold Arc · everything local by default
        <br />
        No account needed until you join a squad.
      </p>
    </Screen>
  )
}
