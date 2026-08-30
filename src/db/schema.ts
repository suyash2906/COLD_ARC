import Dexie, { type Table } from 'dexie'
import type {
  Arc, Commitment, DayRecord, JournalEntry, LogEntry, Photo, Settings, SyncItem,
} from '../lib/types'

/**
 * Local-first store. This is the source of truth — the cloud only ever holds a
 * derived projection of it, so the app stays fully usable offline and signed out.
 */
class ColdArcDB extends Dexie {
  arcs!: Table<Arc, string>
  commitments!: Table<Commitment, string>
  logs!: Table<LogEntry, string>
  days!: Table<DayRecord, string>
  journals!: Table<JournalEntry, string>
  photos!: Table<Photo, string>
  syncQueue!: Table<SyncItem, number>
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
