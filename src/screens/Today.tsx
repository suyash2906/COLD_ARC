import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CommitmentRow } from '../components/CommitmentRow'
import { ParticleField } from '../components/ParticleField'
import { EmptyState, Flame, IconChip, Label, List, Orb, Row, Screen } from '../components/ui'
import { addDays, arcDay, arcEndDate, daysBetween, formatLong, type ISODate } from '../lib/dates'
import { saveJournal, setDayMeta } from '../lib/actions'
import { scoreDay } from '../lib/scoring'
import type { Arc, Commitment } from '../lib/types'
import { useDayRecord, useJournal, type ArcData } from '../state/useArc'

const MOODS = ['😵', '😕', '😐', '🙂', '🔥']

/** After this hour, a day that is still mostly undone turns the particles red. */
const EVENING_HOUR = 18
const LOW_SCORE = 40

/** True from 6pm local time, re-checked every minute so the warning switches on by itself. */
function useIsEvening(): boolean {
  const [evening, setEvening] = useState(() => new Date().getHours() >= EVENING_HOUR)
  useEffect(() => {
    const id = window.setInterval(() => setEvening(new Date().getHours() >= EVENING_HOUR), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return evening
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={dir === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
    </svg>
  )
}

const EditLink = () => (
  <Link to="/contract" className="text-muted active:text-fg text-[13px]">
    Edit
  </Link>
)

export default function Today({ data }: { data: ArcData }) {
  const { arc, input, today } = data
  // The arc may be over, so "today" is clamped to its last day.
  const lastDay: ISODate = arc ? minDate(today, arcEndDate(arc.startDate, arc.totalDays)) : today
  // Lets you fill in yesterday without leaving the screen you actually use.
  const [date, setDate] = useState(lastDay)

  const journal = useJournal(arc?.id, date)
  const dayRecord = useDayRecord(arc?.id, date)
  const [journalDraft, setJournalDraft] = useState<string | null>(null)

  const evening = useIsEvening()

  if (!arc || !input) return null
  if (today < arc.startDate) return <NotStarted arc={arc} today={today} commitments={data.commitments} />

  const day = scoreDay(input, date)
  const dayNum = arcDay(arc.startDate, date)
  const isToday = date === today
  const canGoBack = date > arc.startDate
  const canGoForward = date < lastDay
  const body = journalDraft ?? journal?.body ?? ''
  // A past day is over, so a low score there is already a miss; today gets until 6pm.
  const behind = day.total > 0 && day.score < LOW_SCORE && (date < today || evening)

  return (
    <Screen>
      <header className="rise flex items-center justify-between">
        <div className="text-muted tnum text-[13px]">
          Day {dayNum} of {arc.totalDays}
        </div>
        <Flame count={data.streaks?.current ?? 0} />
      </header>
      <h1 className="display rise mt-2 text-[40px]">{isToday ? 'Today' : formatLong(date)}</h1>

      <ParticleField progress={day.score} warn={behind} className="-mx-5 h-[300px]">
        <div className="flex h-full items-center justify-between px-6">
          <div className="w-[84px]">
            <div className="display tnum text-[clamp(36px,11vw,46px)]">{day.score}</div>
            <div className="text-muted mt-1.5 text-[12.5px]">score</div>
          </div>
          <Orb value={day.score} size={104} />
          <div className="w-[84px] text-right">
            <div className="display tnum text-[clamp(36px,11vw,46px)]">{day.completed}</div>
            <div className="text-muted mt-1.5 text-[12.5px]">of {day.total} done</div>
          </div>
        </div>
      </ParticleField>

      {/* Sits under the hero so it reads as "which day am I looking at". */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => canGoBack && setDate(addDays(date, -1))}
          disabled={!canGoBack}
          className="press text-fg grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] disabled:opacity-25"
          aria-label="Previous day"
        >
          <Chevron dir="left" />
        </button>
        <button
          onClick={() => setDate(lastDay)}
          className={`press min-w-[9.5rem] rounded-full px-4 py-2 text-[13.5px] ${
            isToday ? 'text-muted' : 'text-fg bg-white/[0.1] font-medium'
          }`}
        >
          {isToday ? formatLong(date) : 'Back to today'}
        </button>
        <button
          onClick={() => canGoForward && setDate(addDays(date, 1))}
          disabled={!canGoForward}
          className="press text-fg grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] disabled:opacity-25"
          aria-label="Next day"
        >
          <Chevron dir="right" />
        </button>
      </div>

      <section className="mt-9">
        <Label right={<EditLink />}>Your contract</Label>
        {data.commitments.length === 0 ? (
          <EmptyState
            icon="📝"
            title="No commitments yet"
            body="Your contract is empty. Add the handful of things you are going to hold yourself to."
          />
        ) : (
          <List>
            {day.results.map((r) => (
              <CommitmentRow key={r.commitment.id} arc={arc} result={r} date={date} />
            ))}
          </List>
        )}
      </section>

      <section className="mt-10">
        <Label>How did it go?</Label>
        <div className="flex justify-between px-1">
          {MOODS.map((m, i) => (
            <button
              key={m}
              onClick={() => void setDayMeta(arc.id, date, { mood: dayRecord?.mood === i + 1 ? null : i + 1 })}
              className={`press grid h-12 w-12 place-items-center rounded-full text-[22px] ${
                dayRecord?.mood === i + 1 ? 'scale-105 bg-white/[0.1] ring-1 ring-white/25' : 'opacity-40'
              }`}
              aria-label={`Mood ${i + 1} of 5`}
            >
              {m}
            </button>
          ))}
        </div>

        <textarea
          value={body}
          onChange={(e) => setJournalDraft(e.target.value)}
          onBlur={() => {
            if (journalDraft !== null) void saveJournal(arc.id, date, journalDraft)
            setJournalDraft(null)
          }}
          rows={4}
          placeholder="Notes, wins, what you dodged…"
          className="field mt-4 resize-none text-[15px] leading-relaxed"
        />
        <p className="text-faint mt-2 px-1 text-[12px]">🔒 Stays on this device. Never synced.</p>
      </section>
    </Screen>
  )
}

const minDate = (a: ISODate, b: ISODate) => (a < b ? a : b)

/** Before day one there is nothing to log, so say when it starts instead of inventing a day. */
function NotStarted({
  arc,
  today,
  commitments,
}: {
  arc: Arc
  today: ISODate
  commitments: Commitment[]
}) {
  const wait = daysBetween(today, arc.startDate)
  const active = commitments.filter((c) => !c.archivedAt)

  return (
    <Screen>
      <div className="text-muted rise text-[13px]">{arc.name}</div>
      <h1 className="display rise mt-2 text-[40px]">
        Starts in {wait} {wait === 1 ? 'day' : 'days'}
      </h1>

      <ParticleField progress={0} className="-mx-5 h-[280px]">
        <div className="grid h-full place-items-center">
          <Orb value={0} size={104} />
        </div>
      </ParticleField>

      <p className="text-muted text-center text-[14.5px] leading-relaxed">
        Your arc begins {formatLong(arc.startDate)}.
        <br />
        Nothing to log until then.
      </p>

      {active.length > 0 && (
        <section className="mt-9">
          <Label right={<EditLink />}>Your contract</Label>
          <List>
            {active.map((c) => (
              <Row key={c.id}>
                <IconChip icon={c.icon} />
                <span className="truncate text-[15.5px] font-medium">{c.label}</span>
              </Row>
            ))}
          </List>
        </section>
      )}
    </Screen>
  )
}
