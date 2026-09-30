import { useEffect, useState } from 'react'
import { Button, EmptyState, Label, List, Screen, ScreenTitle, Segmented, Spinner } from '../components/ui'
import { scoreColor } from '../lib/color'
import { formatShort } from '../lib/dates'
import { syncEntireArc } from '../lib/sync'
import type { Duel } from '../lib/supabase'
import {
  claimProfile,
  signInWithGitHub,
  signOut,
  suggestedHandle,
  suggestedName,
  useAuth,
} from '../state/useAuth'
import {
  challenge,
  createSquad,
  joinSquad,
  leaveSquad,
  respondToDuel,
  useSquad,
  type LeaderRow,
} from '../state/useSquad'
import type { Session } from '@supabase/supabase-js'
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
  if (auth.phase === 'signed-out') return <SignIn redirectError={auth.redirectError} />
  if (auth.phase === 'needs-profile') return <ClaimHandle session={auth.session} onDone={auth.refresh} />

  return (
    <Screen>
      <ScreenTitle
        eyebrow={squad.activeSquad ? `Week of ${formatShort(squad.weekStart)}` : 'Compete on consistency'}
        title={squad.activeSquad?.name ?? 'Squad'}
        right={
          squad.squads.length > 1 ? (
            <select
              value={squad.activeSquad?.id ?? ''}
              onChange={(e) => squad.setActiveSquadId(e.target.value)}
              className="text-fg rounded-full bg-white/[0.08] px-3 py-1.5 text-[13px] outline-none"
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

      {squad.error && <p className="text-fail mb-4 px-1 text-[13.5px]">{squad.error}</p>}

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

      <button onClick={() => void signOut()} className="text-faint mt-12 w-full text-center text-[12.5px]">
        Sign out of {auth.profile?.handle}
      </button>
    </Screen>
  )
}

function Loading({ inline }: { inline?: boolean }) {
  return inline ? (
    <div className="grid place-items-center py-16">
      <Spinner />
    </div>
  ) : (
    <Screen>
      <div className="grid place-items-center py-24">
        <Spinner />
      </div>
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
        body="Create a free Supabase project, run the migrations in supabase/migrations, and set the two VITE_SUPABASE keys. SETUP.md walks through it."
      />
      <p className="text-faint mt-2 text-center text-[12.5px]">Everything else in the app works without this.</p>
    </Screen>
  )
}

const GitHubMark = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
)

function SignIn({ redirectError }: { redirectError: string | null }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(redirectError)

  async function go() {
    setBusy(true)
    setError(null)
    try {
      // Navigates away to GitHub; on success we never get past this line.
      await signInWithGitHub()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach GitHub.')
      setBusy(false)
    }
  }

  return (
    <Screen>
      <ScreenTitle title="Squad" sub="Compete with people running their own arc" />

      <div className="rise">
        <div className="border-line-soft space-y-3 border-y px-1 py-5 text-[14.5px]">
          {[
            ['🏆', 'A weekly leaderboard, ranked fairly across different arcs'],
            ['⚔️', 'Duels: put a week on the line against one friend'],
            ['🔥', 'See who kept their streak and who slipped'],
          ].map(([icon, text]) => (
            <div key={text} className="flex items-start gap-3">
              <span className="w-6 shrink-0 text-center">{icon}</span>
              <span className="text-muted leading-snug">{text}</span>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <Button onClick={go} disabled={busy}>
            <span className="flex items-center justify-center gap-2.5">
              <GitHubMark />
              {busy ? 'Opening GitHub…' : 'Continue with GitHub'}
            </span>
          </Button>
        </div>
        {error && <p className="text-fail mt-3 text-center text-[13.5px]">{error}</p>}

        <p className="text-faint mx-auto mt-5 max-w-[34ch] text-center text-[12.5px] leading-relaxed">
          Only your daily score, streak and commitment names are shared. Your journal and photos stay on this phone.
        </p>
      </div>
    </Screen>
  )
}

function ClaimHandle({ session, onDone }: { session: Session | null; onDone: () => Promise<void> }) {
  const [handle, setHandle] = useState(() => suggestedHandle(session))
  const [name, setName] = useState(() => suggestedName(session))
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
      <div className="rise">
        <div className="mb-6 grid grid-cols-5 gap-2.5">
          {EMOJI.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={`press grid aspect-square place-items-center rounded-full text-[24px] ${
                emoji === e ? 'bg-white/[0.12] ring-1 ring-white/40' : 'bg-white/[0.04]'
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
          className="field mb-2.5"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Display name (optional)"
          maxLength={40}
          className="field mb-6"
        />
        <Button onClick={submit} disabled={busy || handle.length < 3}>
          {busy ? 'Claiming…' : 'Continue'}
        </Button>
        {error && <p className="text-fail mt-3 text-center text-[13.5px]">{error}</p>}
      </div>
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
    <div className="rise">
      <Segmented
        value={mode}
        onChange={(m) => {
          setMode(m)
          setValue('')
          setError(null)
        }}
        options={[
          { value: 'join', label: 'Join with a code' },
          { value: 'create', label: 'Start a squad' },
        ]}
      />

      <input
        value={value}
        onChange={(e) => setValue(mode === 'join' ? e.target.value.toUpperCase() : e.target.value)}
        placeholder={mode === 'join' ? 'ABC123' : 'Squad name'}
        maxLength={mode === 'join' ? 6 : 40}
        autoCapitalize={mode === 'join' ? 'characters' : 'words'}
        className={`field mt-5 mb-4 ${mode === 'join' ? 'tnum text-center text-[24px] tracking-[0.3em]' : ''}`}
      />
      <Button onClick={submit} disabled={busy || value.trim().length < (mode === 'join' ? 6 : 2)}>
        {busy ? 'Working…' : mode === 'join' ? 'Join' : 'Create'}
      </Button>
      {error && <p className="text-fail mt-3 text-center text-[13.5px]">{error}</p>}

      <p className="text-faint mt-6 text-center text-[13px] leading-relaxed">
        Everyone competes on the share of their own contract they hit, so different arcs and different start dates
        still rank fairly.
      </p>
    </div>
  )
}

function Leaderboard({ rows, meId }: { rows: LeaderRow[]; meId: string }) {
  const broke = rows.filter((r) => r.missedYesterday)

  return (
    <section className="rise">
      {broke.length > 0 && (
        <div className="mb-5 flex items-start gap-3 px-1">
          <span className="bg-ember mt-1.5 h-2 w-2 shrink-0 rounded-full shadow-[0_0_10px_rgb(255_154_82/0.8)]" />
          <div>
            <div className="text-ember text-[14px] font-medium">
              {broke.length === 1 ? `${broke[0].displayName} missed yesterday` : `${broke.length} people missed yesterday`}
            </div>
            <div className="text-muted mt-0.5 text-[12.5px]">{broke.map((r) => r.handle).join(', ')}</div>
          </div>
        </div>
      )}

      {/* A results table: rank, who, and this week's total. */}
      <div className="text-faint flex px-1 pb-2 text-[12px]">
        <span className="w-7">#</span>
        <span className="flex-1">Athlete</span>
        <span>This week</span>
      </div>
      <div className="divide-line-soft border-line-soft divide-y border-y">
        {rows.map((r, i) => {
          const me = r.userId === meId
          return (
            <div key={r.userId} className={`flex items-center gap-3 px-1 py-3.5 ${me ? 'bg-white/[0.04]' : ''}`}>
              <div className={`tnum w-4 shrink-0 text-[14px] font-medium ${i === 0 ? 'text-fg' : 'text-faint'}`}>{i + 1}</div>
              <div className="relative shrink-0">
                <span className="text-[24px]">{r.emoji}</span>
                {r.loggedToday && (
                  <span className="bg-ice-300 border-ink absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 shadow-[0_0_8px_rgb(163_224_255/0.8)]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[15px] font-medium">{r.displayName}</span>
                  {me && <span className="text-faint text-[11.5px]">you</span>}
                </div>
                <div className="text-faint flex items-center gap-2 text-[12px]">
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
                <div className="display tnum text-[24px]">{r.weekTotal}</div>
                <div className="tnum text-[11px]" style={{ color: scoreColor(r.weekAverage) }}>
                  avg {r.weekAverage}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-faint mt-3 px-1 text-[12px] leading-snug">
        Out of 700: the share of your own commitments you hit each day, so arcs of different lengths compete evenly.
      </p>
    </section>
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
  const [error, setError] = useState<string | null>(null)

  const name = (id: string) => rows.find((r) => r.userId === id)?.displayName ?? 'Someone'
  const mine = duels.filter((d) => d.challenger_id === meId || d.opponent_id === meId)
  const others = rows.filter((r) => r.userId !== meId)

  async function answer(id: string, accept: boolean) {
    setError(null)
    try {
      await respondToDuel(id, accept)
      await onChange()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not answer that challenge.')
    }
  }

  return (
    <section className="mt-10">
      <Label
        right={
          others.length > 0 && (
            <button onClick={() => setOpen(!open)} className="text-fg text-[13px] font-medium">
              {open ? 'Cancel' : '+ Challenge'}
            </button>
          )
        }
      >
        Duels
      </Label>

      {open && (
        <List className="rise mb-3">
          <div className="space-y-3 px-4 py-4">
            <select value={opponent} onChange={(e) => setOpponent(e.target.value)} className="field">
              <option value="">Pick an opponent…</option>
              {others.map((r) => (
                <option key={r.userId} value={r.userId}>
                  {r.emoji} {r.displayName}
                </option>
              ))}
            </select>
            <select value={metric} onChange={(e) => setMetric(e.target.value as Duel['metric'])} className="field">
              {Object.entries(METRIC_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <div className="flex items-center justify-between px-1 py-1">
              <span className="text-muted tnum text-[14px]">Over {days} days</span>
              <input
                type="range"
                min={3}
                max={30}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="w-40 accent-white"
              />
            </div>
            <Button
              disabled={!opponent || busy}
              onClick={async () => {
                setBusy(true)
                setError(null)
                try {
                  await challenge(squadId, opponent, metric, days)
                  setOpen(false)
                  setOpponent('')
                  await onChange()
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Could not send that challenge.')
                } finally {
                  setBusy(false)
                }
              }}
            >
              {busy ? 'Sending…' : 'Send challenge'}
            </Button>
          </div>
        </List>
      )}

      {error && <p className="text-fail mb-3 px-1 text-[13.5px]">{error}</p>}

      {mine.length === 0 ? (
        <p className="text-faint px-1 text-[13.5px]">No duels yet. Pick someone and put a week on the line.</p>
      ) : (
        <List>
          {mine.map((d) => {
            const otherId = d.challenger_id === meId ? d.opponent_id : d.challenger_id
            const incoming = d.opponent_id === meId && d.status === 'pending'
            return (
              <div key={d.id} className="px-4 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-medium">vs {name(otherId)}</div>
                    <div className="text-faint text-[12px]">
                      {METRIC_LABEL[d.metric]} · {formatShort(d.starts_on)}–{formatShort(d.ends_on)}
                    </div>
                  </div>
                  {d.status === 'settled' ? (
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[12.5px] font-medium ${
                        d.winner_id === meId
                          ? 'bg-fg text-ink'
                          : d.winner_id
                            ? 'bg-fail/15 text-fail'
                            : 'text-muted bg-white/[0.08]'
                      }`}
                    >
                      {d.winner_id === meId ? 'Won' : d.winner_id ? 'Lost' : 'Tied'}
                    </span>
                  ) : (
                    <span className="text-muted shrink-0 rounded-full bg-white/[0.06] px-2.5 py-1 text-[12px] capitalize">
                      {d.status}
                    </span>
                  )}
                </div>
                {incoming && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" className="flex-1" onClick={() => void answer(d.id, true)}>
                      Accept
                    </Button>
                    <Button size="sm" variant="secondary" className="flex-1" onClick={() => void answer(d.id, false)}>
                      Decline
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </List>
      )}
    </section>
  )
}

function SquadFooter({ code, onLeave }: { code: string; onLeave: () => Promise<void> }) {
  const [copied, setCopied] = useState(false)
  return (
    <section className="mt-12 text-center">
      <div className="text-muted text-[13px] font-medium">Invite code</div>
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
        className="display tnum mt-2 text-[44px] tracking-[0.16em]"
      >
        {code}
      </button>
      <div className="text-faint mt-1 text-[12.5px]">{copied ? 'Copied' : 'Tap to copy'}</div>
      <button onClick={onLeave} className="text-faint mt-6 text-[12.5px]">
        Leave squad
      </button>
    </section>
  )
}
