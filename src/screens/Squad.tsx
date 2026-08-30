import { useEffect, useState } from 'react'
import { Button, EmptyState, Screen, ScreenTitle, scoreColor } from '../components/ui'
import { formatShort } from '../lib/dates'
import { syncEntireArc } from '../lib/sync'
import type { Duel } from '../lib/supabase'
import { claimProfile, sendMagicLink, signOut, useAuth } from '../state/useAuth'
import {
  challenge,
  createSquad,
  joinSquad,
  leaveSquad,
  respondToDuel,
  useSquad,
  type LeaderRow,
} from '../state/useSquad'
import type { ArcData } from '../state/useArc'

const EMOJI = ['🧊', '🔥', '🐺', '🥶', '⚡', '🗿', '🦍', '🌑', '🥊', '🧗']

export default function Squad({ data }: { data: ArcData }) {
  const auth = useAuth()
  const squad = useSquad(auth.phase === 'ready')

  // The cloud starts empty, so push the whole arc up the first time we are ready.
  useEffect(() => {
    if (auth.phase === 'ready' && data.arc) void syncEntireArc(data.arc.id)
  }, [auth.phase, data.arc])

  if (auth.phase === 'unconfigured') return <Unconfigured />
  if (auth.phase === 'loading') return <Loading />
  if (auth.phase === 'signed-out') return <SignIn />
  if (auth.phase === 'needs-profile') return <ClaimHandle onDone={auth.refresh} />

  return (
    <Screen>
      <ScreenTitle
        title={squad.activeSquad?.name ?? 'Squad'}
        sub={squad.activeSquad ? `Week of ${formatShort(squad.weekStart)}` : 'Compete on consistency'}
        right={
          squad.squads.length > 1 ? (
            <select
              value={squad.activeSquad?.id ?? ''}
              onChange={(e) => squad.setActiveSquadId(e.target.value)}
              className="bg-surface-2 border-line text-fg rounded-lg border px-2 py-1.5 text-[13px]"
            >
              {squad.squads.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : undefined
        }
      />

      {squad.error && <p className="text-fail mb-4 text-[13px]">{squad.error}</p>}

      {squad.loading ? (
        <Loading inline />
      ) : squad.squads.length === 0 ? (
        <SquadSetup onDone={squad.reload} />
      ) : (
        <>
          <Leaderboard rows={squad.rows} meId={auth.session?.user.id ?? ''} />
          <Duels
            duels={squad.duels}
            rows={squad.rows}
            meId={auth.session?.user.id ?? ''}
            squadId={squad.activeSquad!.id}
            onChange={squad.reload}
          />
          <SquadFooter
            code={squad.activeSquad!.join_code}
            onLeave={async () => {
              if (!confirm('Leave this squad?')) return
              await leaveSquad(squad.activeSquad!.id, auth.session!.user.id)
              await squad.reload()
            }}
          />
        </>
      )}

      <button onClick={() => void signOut()} className="text-faint mt-10 w-full text-center text-[12px]">
        Sign out of {auth.profile?.handle}
      </button>
    </Screen>
  )
}

function Loading({ inline }: { inline?: boolean }) {
  const spinner = <div className="border-line border-t-ice-400 h-6 w-6 animate-spin rounded-full border-2" />
  return inline ? <div className="grid place-items-center py-16">{spinner}</div> : (
    <Screen>
      <div className="grid place-items-center py-24">{spinner}</div>
    </Screen>
  )
}

function Unconfigured() {
  return (
    <Screen>
      <ScreenTitle title="Squad" sub="Leaderboards, duels and streak alerts" />
      <EmptyState
        icon="🔌"
        title="No backend connected yet"
        body="Create a free Supabase project, run the migration in supabase/migrations, and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. The README walks through it."
      />
      <p className="text-faint mt-2 text-center text-[12px]">Everything else in the app works without this.</p>
    </Screen>
  )
}

function SignIn() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await sendMagicLink(email.trim())
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the link.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <ScreenTitle title="Squad" sub="Compete with people running their own arc" />
      {sent ? (
        <div className="card px-5 py-6 text-center">
          <div className="mb-3 text-3xl">📬</div>
          <p className="text-[15px] font-medium">Check {email}</p>
          <p className="text-muted mt-2 text-[13px] leading-relaxed">
            Tap the link on this phone and you will land back here signed in.
          </p>
          <button onClick={() => setSent(false)} className="text-ice-400 mt-4 text-[13px]">
            Use a different email
          </button>
        </div>
      ) : (
        <>
          <div className="card mb-4 px-4 py-4">
            <p className="text-muted text-[13.5px] leading-relaxed">
              Sign in to join a squad. Only your daily score, streak and commitment names are shared — your journal
              and photos stay on this phone.
            </p>
          </div>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="bg-surface-2 border-line text-fg placeholder:text-faint mb-2.5 w-full rounded-xl border px-4 py-3.5 outline-none"
          />
          <Button onClick={submit} disabled={busy || !email.includes('@')}>
            {busy ? 'Sending…' : 'Email me a link'}
          </Button>
          <p className="text-faint mt-3 text-center text-[12px]">No password to create or remember.</p>
          {error && <p className="text-fail mt-3 text-center text-[13px]">{error}</p>}
        </>
      )}
    </Screen>
  )
}

function ClaimHandle({ onDone }: { onDone: () => Promise<void> }) {
  const [handle, setHandle] = useState('')
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(EMOJI[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await claimProfile(handle, name, emoji)
      await onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not claim that handle.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <ScreenTitle title="Pick a handle" sub="This is how your squad sees you" />
      <div className="mb-4 flex flex-wrap gap-2">
        {EMOJI.map((e) => (
          <button
            key={e}
            onClick={() => setEmoji(e)}
            className={`press grid h-12 w-12 place-items-center rounded-xl border text-[22px] ${
              emoji === e ? 'border-ice-400 bg-ice-400/10' : 'border-line bg-surface'
            }`}
          >
            {e}
          </button>
        ))}
      </div>
      <input
        value={handle}
        onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
        placeholder="handle"
        maxLength={20}
        autoCapitalize="none"
        className="bg-surface-2 border-line text-fg placeholder:text-faint mb-2.5 w-full rounded-xl border px-4 py-3.5 outline-none"
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Display name (optional)"
        maxLength={40}
        className="bg-surface-2 border-line text-fg placeholder:text-faint mb-4 w-full rounded-xl border px-4 py-3.5 outline-none"
      />
      <Button onClick={submit} disabled={busy || handle.length < 3}>
        {busy ? 'Claiming…' : 'Continue'}
      </Button>
      {error && <p className="text-fail mt-3 text-center text-[13px]">{error}</p>}
    </Screen>
  )
}

function SquadSetup({ onDone }: { onDone: () => Promise<void> }) {
  const [mode, setMode] = useState<'join' | 'create'>('join')
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      if (mode === 'join') await joinSquad(value)
      else await createSquad(value)
      setValue('')
      await onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(['join', 'create'] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m)
              setValue('')
              setError(null)
            }}
            className={`press flex-1 rounded-xl border py-2.5 text-[13.5px] ${
              mode === m ? 'border-ice-400 bg-ice-400/10 text-ice-300' : 'border-line text-muted'
            }`}
          >
            {m === 'join' ? 'Join with a code' : 'Start a squad'}
          </button>
        ))}
      </div>

      <input
        value={value}
        onChange={(e) => setValue(mode === 'join' ? e.target.value.toUpperCase() : e.target.value)}
        placeholder={mode === 'join' ? 'ABC123' : 'Squad name'}
        maxLength={mode === 'join' ? 6 : 40}
        autoCapitalize={mode === 'join' ? 'characters' : 'words'}
        className={`bg-surface-2 border-line text-fg placeholder:text-faint mb-3 w-full rounded-xl border px-4 py-3.5 outline-none ${
          mode === 'join' ? 'tnum text-center text-[22px] tracking-[0.3em]' : ''
        }`}
      />
      <Button onClick={submit} disabled={busy || value.trim().length < (mode === 'join' ? 6 : 2)}>
        {busy ? 'Working…' : mode === 'join' ? 'Join' : 'Create'}
      </Button>
      {error && <p className="text-fail mt-3 text-center text-[13px]">{error}</p>}

      <p className="text-faint mt-6 text-center text-[12.5px] leading-relaxed">
        Everyone competes on the percentage of their own contract they hit, so different arcs and different start
        dates still rank fairly.
      </p>
    </div>
  )
}

function Leaderboard({ rows, meId }: { rows: LeaderRow[]; meId: string }) {
  const broke = rows.filter((r) => r.missedYesterday)

  return (
    <>
      {broke.length > 0 && (
        <div className="border-ember/25 bg-ember/[0.07] mb-3 rounded-xl border px-4 py-3">
          <div className="text-ember text-[13px] font-medium">
            {broke.length === 1
              ? `${broke[0].displayName} missed yesterday`
              : `${broke.length} people missed yesterday`}
          </div>
          <div className="text-muted mt-0.5 text-[12px]">
            {broke.map((r) => r.handle).join(', ')}
          </div>
        </div>
      )}

      <div className="card divide-line-soft divide-y">
        {rows.map((r, i) => {
          const me = r.userId === meId
          return (
            <div key={r.userId} className={`flex items-center gap-3 px-4 py-3.5 ${me ? 'bg-ice-400/[0.05]' : ''}`}>
              <div className="tnum text-faint w-5 shrink-0 text-[13px] font-semibold">{i + 1}</div>
              <div className="relative shrink-0">
                <span className="text-[22px]">{r.emoji}</span>
                {r.loggedToday && (
                  <span className="bg-ice-400 border-surface absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[14.5px] font-medium">{r.displayName}</span>
                  {me && <span className="text-faint text-[11px]">you</span>}
                </div>
                <div className="text-faint flex items-center gap-2 text-[11.5px]">
                  {r.arcDay !== null && (
                    <span className="tnum">
                      Day {r.arcDay}/{r.arcTotalDays}
                    </span>
                  )}
                  {r.streak > 0 && <span>🔥 {r.streak}</span>}
                  {r.perfectDays > 0 && <span>{r.perfectDays} perfect</span>}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="tnum text-[17px] font-semibold" style={{ color: scoreColor(r.weekAverage) }}>
                  {r.weekTotal}
                </div>
                <div className="text-faint text-[10px]">avg {r.weekAverage}</div>
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-faint mt-2.5 px-1 text-[11.5px] leading-snug">
        Ranked by this week's total score out of 700 — the share of your own commitments you hit, so arcs of different
        lengths compete evenly.
      </p>
    </>
  )
}

const METRIC_LABEL: Record<Duel['metric'], string> = {
  perfect_days: 'Most perfect days',
  average_score: 'Highest average',
  total_score: 'Highest total',
}

function Duels({
  duels,
  rows,
  meId,
  squadId,
  onChange,
}: {
  duels: Duel[]
  rows: LeaderRow[]
  meId: string
  squadId: string
  onChange: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [opponent, setOpponent] = useState('')
  const [metric, setMetric] = useState<Duel['metric']>('perfect_days')
  const [days, setDays] = useState(7)
  const [busy, setBusy] = useState(false)

  const name = (id: string) => rows.find((r) => r.userId === id)?.displayName ?? 'Someone'
  const mine = duels.filter((d) => d.challenger_id === meId || d.opponent_id === meId)
  const others = rows.filter((r) => r.userId !== meId)

  return (
    <section className="mt-8">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-faint text-[10px] font-semibold tracking-[0.09em] uppercase">Duels</h2>
        {others.length > 0 && (
          <button onClick={() => setOpen(!open)} className="text-ice-400 text-[12.5px] font-medium">
            {open ? 'Cancel' : '+ Challenge'}
          </button>
        )}
      </div>

      {open && (
        <div className="card mb-3 px-4 py-4">
          <select
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            className="bg-surface-2 border-line text-fg mb-2.5 w-full rounded-xl border px-3.5 py-3 text-[15px]"
          >
            <option value="">Pick an opponent…</option>
            {others.map((r) => (
              <option key={r.userId} value={r.userId}>
                {r.emoji} {r.displayName}
              </option>
            ))}
          </select>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as Duel['metric'])}
            className="bg-surface-2 border-line text-fg mb-2.5 w-full rounded-xl border px-3.5 py-3 text-[15px]"
          >
            {Object.entries(METRIC_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <div className="mb-3.5 flex items-center justify-between">
            <span className="text-muted text-[13px]">Over {days} days</span>
            <input
              type="range"
              min={3}
              max={30}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="accent-ice-400 w-40"
            />
          </div>
          <Button
            disabled={!opponent || busy}
            onClick={async () => {
              setBusy(true)
              try {
                await challenge(squadId, opponent, metric, days)
                setOpen(false)
                setOpponent('')
                await onChange()
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? 'Sending…' : 'Send challenge'}
          </Button>
        </div>
      )}

      {mine.length === 0 ? (
        <p className="text-faint px-1 text-[12.5px]">
          No duels yet. Pick someone and put a week on the line.
        </p>
      ) : (
        <div className="space-y-2">
          {mine.map((d) => {
            const otherId = d.challenger_id === meId ? d.opponent_id : d.challenger_id
            const incoming = d.opponent_id === meId && d.status === 'pending'
            return (
              <div key={d.id} className="card px-4 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium">vs {name(otherId)}</div>
                    <div className="text-faint text-[11.5px]">
                      {METRIC_LABEL[d.metric]} · {formatShort(d.starts_on)}–{formatShort(d.ends_on)}
                    </div>
                  </div>
                  {d.status === 'settled' ? (
                    <span
                      className={`shrink-0 text-[12.5px] font-semibold ${
                        d.winner_id === meId ? 'text-ice-300' : d.winner_id ? 'text-fail' : 'text-muted'
                      }`}
                    >
                      {d.winner_id === meId ? 'Won' : d.winner_id ? 'Lost' : 'Tied'}
                    </span>
                  ) : (
                    <span className="text-faint shrink-0 text-[12px] capitalize">{d.status}</span>
                  )}
                </div>
                {incoming && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={async () => {
                        await respondToDuel(d.id, true)
                        await onChange()
                      }}
                      className="press border-ice-400 bg-ice-400/10 text-ice-300 flex-1 rounded-lg border py-2 text-[13px] font-medium"
                    >
                      Accept
                    </button>
                    <button
                      onClick={async () => {
                        await respondToDuel(d.id, false)
                        await onChange()
                      }}
                      className="press border-line text-muted flex-1 rounded-lg border py-2 text-[13px]"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function SquadFooter({ code, onLeave }: { code: string; onLeave: () => Promise<void> }) {
  const [copied, setCopied] = useState(false)
  return (
    <section className="mt-8">
      <div className="card px-4 py-4 text-center">
        <div className="text-faint text-[10px] font-semibold tracking-[0.09em] uppercase">Invite code</div>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code)
              setCopied(true)
              setTimeout(() => setCopied(false), 1600)
            } catch {
              setCopied(false)
            }
          }}
          className="tnum text-ice-300 mt-2 text-[30px] font-semibold tracking-[0.22em]"
        >
          {code}
        </button>
        <div className="text-faint mt-1 text-[12px]">{copied ? 'Copied' : 'Tap to copy'}</div>
      </div>
      <button onClick={onLeave} className="text-faint mt-4 w-full text-center text-[12px]">
        Leave squad
      </button>
    </section>
  )
}
