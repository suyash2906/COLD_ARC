import { db } from '../db/schema'
import { addDays, todayISO } from './dates'
import { arcDates, computeStreaks, scoreRange, type ScoringInput } from './scoring'
import { supabase } from './supabase'
import type { DailyScoreRow } from './supabase'

/**
 * Pushes the derived projection of local data to the cloud.
 *
 * Scores, streaks and the shape of the arc go up. Journals, photos and raw log values
 * have no code path to here at all — that is the privacy guarantee, enforced by what
 * this function is capable of reading rather than by a flag someone could flip.
 */

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error' | 'signed-out'

let inFlight: Promise<void> | null = null

async function buildInput(arcId: string): Promise<ScoringInput | null> {
  const arc = await db.arcs.get(arcId)
  if (!arc) return null
  const [commitments, logs] = await Promise.all([
    db.commitments.where('arcId').equals(arcId).sortBy('order'),
    db.logs.where('arcId').equals(arcId).toArray(),
  ])
  return { arc, commitments, logs: new Map(logs.map((l) => [l.id, l.value])) }
}

export async function syncNow(): Promise<SyncState> {
  if (!supabase) return 'signed-out'
  if (!navigator.onLine) return 'offline'

  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id
  if (!userId) return 'signed-out'

  if (inFlight) {
    await inFlight
    return 'idle'
  }

  let result: SyncState = 'idle'
  inFlight = (async () => {
    try {
      const pending = await db.syncQueue.orderBy('createdAt').toArray()
      if (pending.length === 0) return

      // Group by arc so each arc's scores are computed from one consistent snapshot.
      const byArc = new Map<string, typeof pending>()
      for (const item of pending) {
        const arcId = (item.payload as { arcId?: string }).arcId
        if (!arcId) continue
        const list = byArc.get(arcId) ?? []
        list.push(item)
        byArc.set(arcId, list)
      }

      const today = todayISO()

      for (const [arcId, items] of byArc) {
        const input = await buildInput(arcId)
        if (!input) {
          await db.syncQueue.bulkDelete(items.map((i) => i.id!).filter(Boolean))
          continue
        }

        const all = scoreRange(input, arcDates(input.arc))
        const byDate = new Map(all.map((d) => [d.date, d]))
        const streaks = computeStreaks(input, today, all)

        const scoreDates = new Set(
          items
            .filter((i) => i.kind === 'daily_score')
            .map((i) => (i.payload as { date: string }).date),
        )

        const rows: Omit<DailyScoreRow, 'user_id'>[] = []
        for (const date of scoreDates) {
          const day = byDate.get(date)
          if (!day || date > today) continue
          rows.push({
            date,
            score: day.score,
            completed: day.completed,
            total: day.total,
            perfect: day.perfect,
            // Only the newest day carries a meaningful streak reading.
            streak_at: date === today ? streaks.current : 0,
          })
        }

        if (rows.length > 0) {
          const { error } = await supabase
            .from('daily_scores')
            .upsert(rows.map((r) => ({ ...r, user_id: userId })), { onConflict: 'user_id,date' })
          if (error) throw error
        }

        if (items.some((i) => i.kind === 'arc_public')) {
          const { error } = await supabase.from('arcs_public').upsert(
            {
              user_id: userId,
              arc_id: input.arc.id,
              name: input.arc.name,
              start_date: input.arc.startDate,
              total_days: input.arc.totalDays,
              strictness: input.arc.strictness,
              commitment_labels: input.commitments.filter((c) => !c.archivedAt).map((c) => c.label),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' },
          )
          if (error) throw error
        }

        await db.syncQueue.bulkDelete(items.map((i) => i.id!).filter(Boolean))
      }
    } catch (e) {
      result = 'error'
      const message = e instanceof Error ? e.message : String(e)
      // Leave the queue intact so the next attempt retries, but record why it failed.
      await db.syncQueue.toCollection().modify((item) => {
        item.attempts += 1
        item.lastError = message
      })
      console.warn('[cold-arc] sync failed:', message)
    } finally {
      inFlight = null
    }
  })()

  await inFlight
  return result
}

/**
 * Backfills the whole arc in one pass. Used right after sign-in, when the cloud has
 * nothing but the device may hold weeks of history.
 */
export async function syncEntireArc(arcId: string): Promise<void> {
  const arc = await db.arcs.get(arcId)
  if (!arc) return
  const today = todayISO()
  const dates = arcDates(arc).filter((d) => d <= today)
  await db.transaction('rw', db.syncQueue, async () => {
    for (const date of dates) {
      const dedupeKey = `daily_score:${arcId}:${date}`
      const existing = await db.syncQueue.where('dedupeKey').equals(dedupeKey).first()
      if (existing) continue
      await db.syncQueue.add({
        kind: 'daily_score',
        dedupeKey,
        payload: { arcId, date },
        attempts: 0,
        lastError: null,
        createdAt: Date.now(),
      })
    }
    const arcKey = `arc_public:${arcId}`
    if (!(await db.syncQueue.where('dedupeKey').equals(arcKey).first())) {
      await db.syncQueue.add({
        kind: 'arc_public',
        dedupeKey: arcKey,
        payload: { arcId },
        attempts: 0,
        lastError: null,
        createdAt: Date.now(),
      })
    }
  })
  await syncNow()
}

/** Fetches squadmates' scores for a date window. RLS decides who is actually visible. */
export async function fetchScores(userIds: string[], from: string, to: string): Promise<DailyScoreRow[]> {
  if (!supabase || userIds.length === 0) return []
  const { data, error } = await supabase
    .from('daily_scores')
    .select('user_id,date,score,completed,total,perfect,streak_at')
    .in('user_id', userIds)
    .gte('date', from)
    .lte('date', to)
  if (error) throw error
  return data ?? []
}

export const yesterdayOf = (iso: string) => addDays(iso, -1)
