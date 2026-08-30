import { useCallback, useEffect, useState } from 'react'
import { addDays, arcDay, startOfWeek, todayISO } from '../lib/dates'
import { fetchScores } from '../lib/sync'
import { supabase, type ArcPublic, type Duel, type Profile, type Squad } from '../lib/supabase'

export interface LeaderRow {
  userId: string
  handle: string
  displayName: string
  emoji: string
  /** Sum of this calendar week's day scores, 0–700. The ranking metric. */
  weekTotal: number
  weekAverage: number
  perfectDays: number
  streak: number
  arcName: string | null
  arcDay: number | null
  arcTotalDays: number | null
  /** Drives the streak-loss callout. */
  missedYesterday: boolean
  loggedToday: boolean
}

export interface SquadView {
  loading: boolean
  error: string | null
  squads: Squad[]
  activeSquad: Squad | null
  rows: LeaderRow[]
  duels: Duel[]
  weekStart: string
  setActiveSquadId: (id: string) => void
  reload: () => Promise<void>
}

type MemberRow = { user_id: string; profiles: Profile | Profile[] | null }

export function useSquad(enabled: boolean): SquadView {
  const [squads, setSquads] = useState<Squad[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [rows, setRows] = useState<LeaderRow[]>([])
  const [duels, setDuels] = useState<Duel[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const today = todayISO()
  const weekStart = startOfWeek(today)

  const loadSquads = useCallback(async () => {
    if (!supabase) return [] as Squad[]
    const { data, error } = await supabase.from('squads').select('*').order('created_at')
    if (error) throw error
    return (data ?? []) as Squad[]
  }, [])

  const loadBoard = useCallback(
    async (squadId: string) => {
      if (!supabase) return

      // Resolve any duel whose window has closed before reading them back.
      await supabase.rpc('settle_due_duels')

      const { data: memberData, error: memberErr } = await supabase
        .from('squad_members')
        .select('user_id, profiles(*)')
        .eq('squad_id', squadId)
      if (memberErr) throw memberErr

      const members = (memberData ?? []) as MemberRow[]
      const ids = members.map((m) => m.user_id)
      if (ids.length === 0) {
        setRows([])
        return
      }

      const [{ data: arcData }, scores, { data: duelData }] = await Promise.all([
        supabase.from('arcs_public').select('*').in('user_id', ids),
        fetchScores(ids, weekStart, today),
        supabase
          .from('duels')
          .select('*')
          .eq('squad_id', squadId)
          .order('created_at', { ascending: false })
          .limit(20),
      ])

      const arcs = new Map((arcData ?? []).map((a: ArcPublic) => [a.user_id, a]))
      const yesterday = addDays(today, -1)

      const built: LeaderRow[] = members.map((m) => {
        // PostgREST returns the embedded row as an object or a single-element array
        // depending on how it infers the relationship.
        const p = (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) ?? null
        const mine = scores.filter((s) => s.user_id === m.user_id)
        const weekTotal = mine.reduce((n, s) => n + s.score, 0)
        const arc = arcs.get(m.user_id) ?? null
        const latest = mine.reduce<(typeof mine)[number] | null>(
          (best, s) => (!best || s.date > best.date ? s : best),
          null,
        )

        return {
          userId: m.user_id,
          handle: p?.handle ?? '—',
          displayName: p?.display_name ?? p?.handle ?? 'Unknown',
          emoji: p?.avatar_emoji ?? '🧊',
          weekTotal,
          weekAverage: mine.length ? Math.round(weekTotal / mine.length) : 0,
          perfectDays: mine.filter((s) => s.perfect).length,
          streak: latest?.date === today ? latest.streak_at : (latest?.streak_at ?? 0),
          arcName: arc?.name ?? null,
          arcDay: arc ? arcDay(arc.start_date, today) : null,
          arcTotalDays: arc?.total_days ?? null,
          // Only a real miss if their arc had actually started by yesterday.
          missedYesterday:
            !!arc &&
            arc.start_date <= yesterday &&
            !mine.some((s) => s.date === yesterday && s.score > 0),
          loggedToday: mine.some((s) => s.date === today),
        }
      })

      built.sort((a, b) => b.weekTotal - a.weekTotal || b.streak - a.streak)
      setRows(built)
      setDuels((duelData ?? []) as Duel[])
    },
    [today, weekStart],
  )

  const reload = useCallback(async () => {
    if (!enabled || !supabase) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const list = await loadSquads()
      setSquads(list)
      const target = activeId && list.some((s) => s.id === activeId) ? activeId : (list[0]?.id ?? null)
      setActiveId(target)
      if (target) await loadBoard(target)
      else setRows([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your squad.')
    } finally {
      setLoading(false)
    }
  }, [enabled, activeId, loadSquads, loadBoard])

  useEffect(() => {
    void reload()
    // Deliberately runs on enablement only; callers use reload() after mutations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  const setActiveSquadId = useCallback(
    (id: string) => {
      setActiveId(id)
      setLoading(true)
      loadBoard(id)
        .catch((e) => setError(e instanceof Error ? e.message : 'Could not load that squad.'))
        .finally(() => setLoading(false))
    },
    [loadBoard],
  )

  return {
    loading,
    error,
    squads,
    activeSquad: squads.find((s) => s.id === activeId) ?? null,
    rows,
    duels,
    weekStart,
    setActiveSquadId,
    reload,
  }
}

export async function createSquad(name: string): Promise<void> {
  if (!supabase) throw new Error('Cloud not configured')
  const { error } = await supabase.rpc('create_squad', { squad_name: name.trim() })
  if (error) throw error
}

export async function joinSquad(code: string): Promise<void> {
  if (!supabase) throw new Error('Cloud not configured')
  const { error } = await supabase.rpc('join_squad', { code: code.trim().toUpperCase() })
  if (error) throw error
}

export async function leaveSquad(squadId: string, userId: string): Promise<void> {
  if (!supabase) throw new Error('Cloud not configured')
  const { error } = await supabase.from('squad_members').delete().eq('squad_id', squadId).eq('user_id', userId)
  if (error) throw error
}

export async function challenge(
  squadId: string,
  opponentId: string,
  metric: Duel['metric'],
  days: number,
): Promise<void> {
  if (!supabase) throw new Error('Cloud not configured')
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Not signed in')
  const start = todayISO()
  const { error } = await supabase.from('duels').insert({
    squad_id: squadId,
    challenger_id: auth.user.id,
    opponent_id: opponentId,
    metric,
    starts_on: start,
    ends_on: addDays(start, days - 1),
    status: 'pending',
  })
  if (error) throw error
}

export async function respondToDuel(duelId: string, accept: boolean): Promise<void> {
  if (!supabase) throw new Error('Cloud not configured')
  const { error } = await supabase
    .from('duels')
    .update({ status: accept ? 'active' : 'declined' })
    .eq('id', duelId)
  if (error) throw error
}
