import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../db/schema'
import { todayISO } from '../lib/dates'
import {
  arcDates,
  commitmentRates,
  computeStreaks,
  scoreDay,
  scoreRange,
  summarizeWeeks,
  type DayScore,
  type ScoringInput,
  type StreakInfo,
  type WeekSummary,
} from '../lib/scoring'
import type { Arc, Commitment, LogEntry, Photo } from '../lib/types'

export interface ArcData {
  loading: boolean
  arc: Arc | null
  commitments: Commitment[]
  input: ScoringInput | null
  today: string
  todayScore: DayScore | null
  /** Scores for every date in the arc, including days not yet reached. */
  allScores: DayScore[]
  streaks: StreakInfo | null
  weeks: WeekSummary[]
  rates: Map<string, { done: number; scheduled: number; rate: number }>
}

const EMPTY_RATES = new Map<string, { done: number; scheduled: number; rate: number }>()

/**
 * One hook for the whole local dataset. Everything is derived from Dexie live queries,
 * so any write anywhere in the app re-renders the screens that care without a store.
 */
export function useArcData(): ArcData {
  const today = todayISO()

  const arc = useLiveQuery(async () => (await db.arcs.where('status').equals('active').first()) ?? null, [], undefined)
  const arcId = arc?.id

  const commitments = useLiveQuery(
    async () => (arcId ? await db.commitments.where('arcId').equals(arcId).sortBy('order') : ([] as Commitment[])),
    [arcId],
    undefined,
  )

  const logs = useLiveQuery(
    async () => (arcId ? await db.logs.where('arcId').equals(arcId).toArray() : ([] as LogEntry[])),
    [arcId],
    undefined,
  )

  return useMemo(() => {
    const loading = arc === undefined || commitments === undefined || logs === undefined
    if (loading || !arc) {
      return {
        loading,
        arc: null,
        commitments: [],
        input: null,
        today,
        todayScore: null,
        allScores: [],
        streaks: null,
        weeks: [],
        rates: EMPTY_RATES,
      }
    }

    const input: ScoringInput = {
      arc,
      commitments,
      logs: new Map(logs.map((l) => [l.id, l.value])),
    }

    const allScores = scoreRange(input, arcDates(arc))
    const streaks = computeStreaks(input, today, allScores)
    // Weeks and rates only make sense over days that have actually happened.
    const elapsed = allScores.slice(0, streaks.elapsed)

    return {
      loading: false,
      arc,
      commitments,
      input,
      today,
      todayScore: scoreDay(input, today),
      allScores,
      streaks,
      weeks: summarizeWeeks(elapsed),
      rates: commitmentRates(elapsed),
    }
  }, [arc, commitments, logs, today])
}

export function useJournal(arcId: string | undefined, date: string) {
  return useLiveQuery(
    async () => (arcId ? await db.journals.get(`${arcId}:${date}`) : undefined),
    [arcId, date],
    undefined,
  )
}

export function useDayRecord(arcId: string | undefined, date: string) {
  return useLiveQuery(
    async () => (arcId ? await db.days.get(`${arcId}:${date}`) : undefined),
    [arcId, date],
    undefined,
  )
}

export function usePhotos(arcId: string | undefined) {
  return useLiveQuery(
    async () => (arcId ? await db.photos.where('arcId').equals(arcId).reverse().sortBy('date') : ([] as Photo[])),
    [arcId],
    undefined,
  )
}
