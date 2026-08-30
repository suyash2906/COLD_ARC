import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CommitmentRow } from '../components/CommitmentRow'
import { EmptyState, Flame, Ring, Screen } from '../components/ui'
import { addDays, arcDay, formatLong, todayISO } from '../lib/dates'
import { saveJournal, setDayMeta } from '../lib/actions'
import { scoreDay } from '../lib/scoring'
import { useDayRecord, useJournal, type ArcData } from '../state/useArc'

const MOODS = ['😵', '😕', '😐', '🙂', '🔥']

export default function Today({ data }: { data: ArcData }) {
  const { arc, input, today } = data
  // Lets you fill in yesterday without leaving the screen you actually use.
  const [date, setDate] = useState(today)

  const journal = useJournal(arc?.id, date)
  const dayRecord = useDayRecord(arc?.id, date)
  const [journalDraft, setJournalDraft] = useState<string | null>(null)

  if (!arc || !input) return null

  const day = scoreDay(input, date)
  const dayNum = arcDay(arc.startDate, date)
  const isToday = date === today
  const canGoForward = date < today
  const canGoBack = dayNum > 1

  const body = journalDraft ?? journal?.body ?? ''

  return (
    <Screen>
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="text-faint text-[11px] font-semibold tracking-[0.14em] uppercase">
            Day {Math.max(1, dayNum)}{' '}
            <span className="text-line">/</span> {arc.totalDays}
          </div>
          <h1 className="mt-1.5 text-[24px] leading-none font-semibold tracking-tight">
            {isToday ? 'Today' : formatLong(date)}
          </h1>
        </div>
        <Flame count={data.streaks?.current ?? 0} />
      </header>

      <div className="mb-6 flex flex-col items-center">
        <Ring value={day.score}>
          <div className="text-center">
            <div className="tnum text-[40px] leading-none font-semibold tracking-tight">{day.score}</div>
            <div className="text-faint mt-1 text-[11px] font-medium tracking-[0.1em] uppercase">
              {day.completed}/{day.total} done
            </div>
          </div>
        </Ring>

        {/* Date stepper sits under the ring so it reads as "which day am I looking at". */}
        <div className="mt-4 flex items-center gap-1">
          <button
            onClick={() => canGoBack && setDate(addDays(date, -1))}
            disabled={!canGoBack}
            className="press text-muted disabled:text-line px-3 py-1.5 text-[13px]"
          >
            ←
          </button>
          <button
            onClick={() => setDate(todayISO())}
            className={`px-3 py-1.5 text-[12.5px] ${isToday ? 'text-faint' : 'text-ice-400 font-medium'}`}
          >
            {isToday ? formatLong(date) : 'Back to today'}
          </button>
          <button
            onClick={() => canGoForward && setDate(addDays(date, 1))}
            disabled={!canGoForward}
            className="press text-muted disabled:text-line px-3 py-1.5 text-[13px]"
          >
            →
          </button>
        </div>
      </div>

      {data.commitments.length === 0 ? (
        <EmptyState
          icon="📝"
          title="No commitments yet"
          body="Your contract is empty. Add the handful of things you are going to hold yourself to."
        />
      ) : (
        <div className="space-y-2">
          {day.results.map((r) => (
            <CommitmentRow key={r.commitment.id} arc={arc} result={r} date={date} />
          ))}
        </div>
      )}

      <Link
        to="/contract"
        className="press card text-muted active:text-fg mt-2 block px-4 py-3 text-center text-[13px]"
      >
        Edit contract
      </Link>

      <section className="mt-8">
        <div className="text-faint mb-2.5 text-[10px] font-semibold tracking-[0.09em] uppercase">How did it go?</div>
        <div className="card px-4 py-4">
          <div className="flex justify-between">
            {MOODS.map((m, i) => (
              <button
                key={m}
                onClick={() => void setDayMeta(arc.id, date, { mood: dayRecord?.mood === i + 1 ? null : i + 1 })}
                className={`press grid h-11 w-11 place-items-center rounded-full text-[21px] transition-all ${
                  dayRecord?.mood === i + 1 ? 'bg-ice-400/15 ring-ice-400/50 scale-105 ring-1' : 'opacity-45'
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
            rows={3}
            placeholder="Notes, wins, what you dodged…"
            className="text-fg placeholder:text-faint border-line-soft mt-3.5 w-full resize-none border-t bg-transparent pt-3.5 text-[14px] leading-relaxed outline-none"
          />
          <p className="text-faint mt-1 text-[11px]">🔒 Stays on this device — never synced.</p>
        </div>
      </section>
    </Screen>
  )
}
