import Dexie, { type Table } from 'dexie'
import { CONTRACT_PRESETS } from '../lib/presets'
import type {
  Arc, Commitment, DayRecord, JournalEntry, LogEntry, Photo, Settings,
} from '../lib/types'

/**
 * The only store. Everything lives on this device; nothing is uploaded anywhere.
 */
class ColdArcDB extends Dexie {
  arcs!: Table<Arc, string>
  commitments!: Table<Commitment, string>
  logs!: Table<LogEntry, string>
  days!: Table<DayRecord, string>
  journals!: Table<JournalEntry, string>
  photos!: Table<Photo, string>
  settings!: Table<Settings, string>

  constructor() {
    super('cold-arc')
    this.version(1).stores({
      arcs: 'id, status, startDate',
      commitments: 'id, arcId, order, [arcId+archivedAt]',
      logs: 'id, arcId, commitmentId, date, [arcId+date], [commitmentId+date]',
      days: 'id, arcId, date, [arcId+date]',
      journals: 'id, arcId, date, [arcId+date]',
      photos: 'id, arcId, date, [arcId+date]',
      syncQueue: '++id, kind, dedupeKey, createdAt',
      settings: 'key',
    })
    // The squad upload queue is gone; drop its table and any rows still waiting in it.
    this.version(2).stores({ syncQueue: null })
    // Reminder times arrived after some contracts were already signed. Give those tasks the
    // preset's times; a task set to "None" (null) is left alone.
    this.version(3)
      .stores({})
      .upgrade(async (tx) => {
        const times = new Map<string, Map<string, number | null | undefined>>(
          CONTRACT_PRESETS.map((p) => [p.id, new Map(p.commitments.map((c) => [c.label, c.remindAt]))]),
        )
        const presetOf = new Map((await tx.table<Arc>('arcs').toArray()).map((a) => [a.id, a.presetId]))
        await tx
          .table<Commitment>('commitments')
          .toCollection()
          .modify((c) => {
            const at = times.get(presetOf.get(c.arcId) ?? '')?.get(c.label)
            if (c.remindAt === undefined && typeof at === 'number') c.remindAt = at
          })
      })
  }
}

export const db = new ColdArcDB()

// Handy from the browser console while developing; stripped from production builds.
if (import.meta.env.DEV) {
  ;(globalThis as unknown as { db: ColdArcDB }).db = db
}

export const logId = (commitmentId: string, date: string) => `${commitmentId}:${date}`
export const dayId = (arcId: string, date: string) => `${arcId}:${date}`

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key)
  return row === undefined ? fallback : (row.value as T)
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value })
}

/**
 * Ask Safari not to evict us. Installed PWAs are already far safer than tabs, but
 * journals and photos exist only here, so it's worth requesting explicitly.
 */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  if (await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}
