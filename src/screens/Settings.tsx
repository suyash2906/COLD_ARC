import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Label, List, Row, Screen, ScreenTitle } from '../components/ui'
import { arcEnd, endArc, exportArc, importArc } from '../lib/actions'
import { requestPersistence } from '../db/schema'
import { formatShort } from '../lib/dates'
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
        <section className="rise mb-9 rounded-[22px] border border-white/[0.08] bg-[radial-gradient(120%_140%_at_0%_0%,rgb(111_203_255/0.14),transparent_60%)] px-5 py-5">
          <div className="display text-[20px]">Put it on your home screen</div>
          {isIOS() ? (
            <ol className="text-muted mt-3 space-y-1.5 text-[14px] leading-relaxed">
              <li>1. Open this page in Safari</li>
              <li>2. Tap Share at the bottom</li>
              <li>
                3. Choose <span className="text-fg font-medium">Add to Home Screen</span>
              </li>
            </ol>
          ) : (
            <p className="text-muted mt-2.5 text-[14px] leading-relaxed">
              Use your browser menu and choose Install app or Add to Home Screen.
            </p>
          )}
          <p className="text-faint mt-3 text-[12.5px] leading-snug">
            Installing is what makes it open full-screen, work offline, and keeps iOS from clearing your data.
          </p>
        </section>
      )}

      <section className="rise">
        <Label>Your arc</Label>
        <List>
          {[
            ['Contract', arc.name],
            ['Window', `${formatShort(arc.startDate)} → ${formatShort(arcEnd(arc))}`],
            ['Progress', `${streaks?.elapsed ?? 0} of ${arc.totalDays} days`],
          ].map(([k, v]) => (
            <Row key={k}>
              <span className="text-muted flex-1 text-[14.5px]">{k}</span>
              <span className="tnum text-[14.5px]">{v}</span>
            </Row>
          ))}
          <Row onClick={() => nav('/contract')}>
            <span className="flex-1 text-[14.5px] font-medium">Edit contract</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-faint" aria-hidden>
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Row>
        </List>
      </section>

      <section className="mt-9">
        <Label>Backup</Label>
        <p className="text-muted mb-4 px-1 text-[13.5px] leading-relaxed">
          Journals and photos live only on this phone — they are never uploaded. An export is the only way to get them
          back if you lose the device.
        </p>
        <div className="space-y-2">
          <Button variant="secondary" onClick={doExport}>
            Export everything
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
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
        {note && <p className="text-ice-300 mt-3 px-1 text-[13px]">{note}</p>}
      </section>

      <section className="mt-9">
        <Label>Storage</Label>
        <List>
          <Row>
            <div className="min-w-0 flex-1">
              <div className="text-[14.5px] font-medium">Protected storage</div>
              <div className="text-faint text-[12.5px] leading-snug">
                {persisted ? 'Safari will not evict your data.' : 'Not granted yet — installing to the home screen helps.'}
              </div>
            </div>
            {persisted ? (
              <span className="bg-ice-300 h-2 w-2 shrink-0 rounded-full shadow-[0_0_8px_rgb(163_224_255/0.8)]" />
            ) : (
              <Button size="sm" variant="secondary" onClick={() => void requestPersistence().then(setPersisted)}>
                Request
              </Button>
            )}
          </Row>
        </List>
      </section>

      <section className="mt-9">
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

      <p className="text-faint mt-8 text-center text-[12px] leading-relaxed">
        Cold Arc · everything local by default
        <br />
        No account needed until you join a squad.
      </p>
    </Screen>
  )
}
