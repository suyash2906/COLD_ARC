import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * The cloud layer is strictly optional. With no project configured the app still runs
 * as a complete solo tracker — only the Squad tab changes what it says.
 */
export const isCloudConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isCloudConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // PKCE returns the code in the query string. The implicit flow would put tokens
        // in the URL fragment, which is exactly where HashRouter keeps the route — they
        // would fight over the same hash.
        flowType: 'pkce',
      },
    })
  : null

export interface Profile {
  id: string
  handle: string
  display_name: string
  avatar_emoji: string
  timezone: string | null
  alerts_optin: boolean
}

export interface ArcPublic {
  user_id: string
  arc_id: string
  name: string
  start_date: string
  total_days: number
  strictness: string
  commitment_labels: string[]
}

export interface DailyScoreRow {
  user_id: string
  date: string
  score: number
  completed: number
  total: number
  perfect: boolean
  streak_at: number
}

export interface Squad {
  id: string
  name: string
  join_code: string
  owner_id: string
  created_at: string
}

export interface Duel {
  id: string
  squad_id: string | null
  challenger_id: string
  opponent_id: string
  metric: 'perfect_days' | 'average_score' | 'total_score'
  starts_on: string
  ends_on: string
  status: 'pending' | 'active' | 'declined' | 'settled'
  winner_id: string | null
}

/**
 * Magic links must return to the exact deployed path. The `?code=` lands before the
 * fragment, so the route survives and the user comes back to the Squad tab.
 */
export function authRedirectUrl(): string {
  return `${window.location.origin}${window.location.pathname}#/squad`
}
