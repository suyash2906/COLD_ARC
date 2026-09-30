import { useEffect, useState } from 'react'
import { currentSubscription, enableReminders, pushSupported, REMINDER_TIMES, showTestNotification } from '../lib/push'
import { Button, Label } from './ui'

/**
 * Turns reminders on for this phone and hands over the one-time "phone key" (the push
 * subscription) that the GitHub reminder workflow needs as a secret.
 */
export function Reminders() {
  const [sub, setSub] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const supported = pushSupported()

  useEffect(() => {
    void currentSubscription().then((s) => s && setSub(JSON.stringify(s)))
  }, [])

  async function enable() {
    setBusy(true)
    setNote(null)
    try {
      setSub(JSON.stringify(await enableReminders()))
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Could not turn on reminders.')
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    if (!sub) return
    try {
      await navigator.clipboard.writeText(sub)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setNote('Could not copy. Try again.')
    }
  }

  const times = `${REMINDER_TIMES.slice(0, -1).join(', ')} and ${REMINDER_TIMES.at(-1)}`

  return (
    <section className="mt-9">
      <Label>Reminders</Label>
      <p className="text-muted mb-4 px-1 text-[13.5px] leading-relaxed">
        At {times}, a notification names any task past its reminder time that is still undone.
      </p>

      {!supported ? (
        <p className="text-faint px-1 text-[13px]">Open Cold Arc from your home screen to turn these on.</p>
      ) : sub ? (
        <div className="space-y-2">
          <Button variant="secondary" onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy phone key'}
          </Button>
          <p className="text-faint px-1 pb-1 text-[12.5px] leading-snug">
            One time only: paste it into GitHub as the <span className="text-muted">PUSH_SUBSCRIPTION</span> secret.
          </p>
          <Button variant="secondary" onClick={() => void showTestNotification()}>
            Test on this phone
          </Button>
        </div>
      ) : (
        <Button onClick={() => void enable()} disabled={busy}>
          {busy ? 'Asking…' : 'Turn on reminders'}
        </Button>
      )}
      {note && <p className="text-fail mt-3 px-1 text-[13px]">{note}</p>}
    </section>
  )
}
