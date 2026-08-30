import { dayId, db, logId } from '../db/schema'
import { todayISO, type ISODate } from './dates'
import { daysToEnd } from './presets'
import type { CommitmentTemplate } from './presets'
import type { Arc, Commitment, Strictness } from './types'

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)

export interface NewArcSpec {
  name: string
  presetId: string
  startDate: ISODate
  totalDays: number
  strictness: Strictness
  graceTokens: number
  commitments: CommitmentTemplate[]
}

/**
 * Only one arc is active at a time. Starting a new one retires the old rather than
 * deleting it, so history and photos survive.
 */
export async function createArc(spec: NewArcSpec): Promise<Arc> {
  const arc: Arc = {
    id: uid(),
    name: spec.name,
    presetId: spec.presetId,
    startDate: spec.startDate,
    totalDays: spec.totalDays,
    strictness: spec.strictness,
    graceTokens: spec.graceTokens,
    signedAt: Date.now(),
    createdAt: Date.now(),
    status: 'active',
  }

  await db.transaction('rw', db.arcs, db.commitments, db.syncQueue, async () => {
    await db.arcs.where('status').equals('active').modify({ status: 'abandoned' })
    await db.arcs.add(arc)
    await db.commitments.bulkAdd(
      spec.commitments.map((c, i) => ({ ...c, id: uid(), arcId: arc.id, order: i, archivedAt: null })),
    )
  })
  await queueArcPublic(arc)
  return arc
}

export async function updateArc(arcId: string, patch: Partial<Arc>): Promise<void> {
  await db.arcs.update(arcId, patch)
  const arc = await db.arcs.get(arcId)
  if (arc) await queueArcPublic(arc)
}

export async function endArc(arcId: string, status: 'completed' | 'abandoned' = 'completed'): Promise<void> {
  await db.arcs.update(arcId, { status })
}

/** Recomputes the derived end date when the user edits either side of the window. */
export function arcEnd(arc: Pick<Arc, 'startDate' | 'totalDays'>): ISODate {
  return daysToEnd(arc.startDate, arc.totalDays)
}

export async function addCommitment(arcId: string, tpl: CommitmentTemplate): Promise<void> {
  const count = await db.commitments.where('arcId').equals(arcId).count()
  await db.commitments.add({ ...tpl, id: uid(), arcId, order: count, archivedAt: null })
  await queueScoreForDate(arcId, todayISO())
}

export async function updateCommitment(id: string, patch: Partial<Commitment>): Promise<void> {
  await db.commitments.update(id, patch)
  const c = await db.commitments.get(id)
  if (c) await queueScoreForDate(c.arcId, todayISO())
}

/**
 * Archived rather than deleted: removing a commitment outright would silently rewrite
 * every past day score, which is exactly the kind of quiet history edit a discipline
 * tracker should not do.
 */
export async function archiveCommitment(id: string): Promise<void> {
  await db.commitments.update(id, { archivedAt: Date.now() })
}

export async function reorderCommitments(ids: string[]): Promise<void> {
  await db.transaction('rw', db.commitments, async () => {
    await Promise.all(ids.map((id, i) => db.commitments.update(id, { order: i })))
  })
}

export async function setLogValue(
  arc: Arc,
  commitment: Commitment,
  date: ISODate,
  value: number | null,
): Promise<void> {
  const id = logId(commitment.id, date)
  if (value === null) {
    await db.logs.delete(id)
  } else {
    await db.logs.put({
      id,
      arcId: arc.id,
      commitmentId: commitment.id,
      date,
      value,
      loggedAt: Date.now(),
    })
  }
  await queueScoreForDate(arc.id, date)
}

export async function toggleCommitment(arc: Arc, commitment: Commitment, date: ISODate, on: boolean): Promise<void> {
  await setLogValue(arc, commitment, date, on ? 1 : null)
}

export async function setDayMeta(
  arcId: string,
  date: ISODate,
  patch: Partial<{ mood: number | null; winOfTheDay: string | null }>,
): Promise<void> {
  const id = dayId(arcId, date)
  const existing = await db.days.get(id)
  await db.days.put({
    id,
    arcId,
    date,
    mood: null,
    winOfTheDay: null,
    graceUsed: false,
    ...existing,
    ...patch,
  })
}

/** Device-only: journals never reach the sync queue. */
export async function saveJournal(arcId: string, date: ISODate, body: string): Promise<void> {
  const id = `${arcId}:${date}`
  if (!body.trim()) {
    await db.journals.delete(id)
    return
  }
  await db.journals.put({ id, arcId, date, body, updatedAt: Date.now() })
}

/** Device-only: photo blobs never reach the sync queue. */
export async function savePhoto(arcId: string, date: ISODate, blob: Blob, width: number, height: number): Promise<void> {
  await db.photos.put({ id: `${arcId}:${date}`, arcId, date, blob, width, height, createdAt: Date.now() })
}

export async function deletePhoto(id: string): Promise<void> {
  await db.photos.delete(id)
}

/**
 * Sync queue. Entries are deduped per (kind, key) so hammering a counter all evening
 * produces one pending row, not fifty.
 */
async function enqueue(kind: 'daily_score' | 'arc_public', dedupeKey: string, payload: unknown): Promise<void> {
  await db.transaction('rw', db.syncQueue, async () => {
    const existing = await db.syncQueue.where('dedupeKey').equals(dedupeKey).first()
    if (existing?.id !== undefined) {
      await db.syncQueue.update(existing.id, { payload, attempts: 0, lastError: null, createdAt: Date.now() })
      return
    }
    await db.syncQueue.add({ kind, dedupeKey, payload, attempts: 0, lastError: null, createdAt: Date.now() })
  })
}

async function queueScoreForDate(arcId: string, date: ISODate): Promise<void> {
  await enqueue('daily_score', `daily_score:${arcId}:${date}`, { arcId, date })
}

async function queueArcPublic(arc: Arc): Promise<void> {
  await enqueue('arc_public', `arc_public:${arc.id}`, { arcId: arc.id })
}

/**
 * The only backup that exists for device-only data, so it has to include everything —
 * photos as base64 and all.
 */
export async function exportArc(arcId: string): Promise<Blob> {
  const [arc, commitments, logs, days, journals, photos] = await Promise.all([
    db.arcs.get(arcId),
    db.commitments.where('arcId').equals(arcId).toArray(),
    db.logs.where('arcId').equals(arcId).toArray(),
    db.days.where('arcId').equals(arcId).toArray(),
    db.journals.where('arcId').equals(arcId).toArray(),
    db.photos.where('arcId').equals(arcId).toArray(),
  ])

  const encodedPhotos = await Promise.all(
    photos.map(async (p) => ({
      id: p.id,
      date: p.date,
      width: p.width,
      height: p.height,
      createdAt: p.createdAt,
      dataUrl: await blobToDataURL(p.blob),
    })),
  )

  const payload = {
    format: 'cold-arc-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    arc,
    commitments,
    logs,
    days,
    journals,
    photos: encodedPhotos,
  }
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

export async function importArc(file: File): Promise<void> {
  const data = JSON.parse(await file.text())
  if (data?.format !== 'cold-arc-export') throw new Error('Not a Cold Arc export file.')

  const photos = await Promise.all(
    (data.photos ?? []).map(async (p: { id: string; date: string; width: number; height: number; createdAt: number; dataUrl: string }) => ({
      id: p.id,
      arcId: data.arc.id,
      date: p.date,
      width: p.width,
      height: p.height,
      createdAt: p.createdAt,
      blob: await (await fetch(p.dataUrl)).blob(),
    })),
  )

  await db.transaction('rw', [db.arcs, db.commitments, db.logs, db.days, db.journals, db.photos], async () => {
    await db.arcs.where('status').equals('active').modify({ status: 'abandoned' })
    await db.arcs.put({ ...data.arc, status: 'active' })
    await db.commitments.bulkPut(data.commitments ?? [])
    await db.logs.bulkPut(data.logs ?? [])
    await db.days.bulkPut(data.days ?? [])
    await db.journals.bulkPut(data.journals ?? [])
    await db.photos.bulkPut(photos)
  })
}
