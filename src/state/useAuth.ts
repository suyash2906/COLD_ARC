import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { authRedirectUrl, supabase, type Profile } from '../lib/supabase'

export type AuthPhase =
  | 'unconfigured' // no Supabase project wired up
  | 'loading'
  | 'signed-out'
  | 'needs-profile' // authenticated but has not claimed a handle
  | 'ready'

export interface AuthState {
  phase: AuthPhase
  session: Session | null
  profile: Profile | null
  /** Why the last GitHub round trip failed, if it did (for example, it was cancelled). */
  redirectError: string | null
  refresh: () => Promise<void>
}

/**
 * GitHub sends people back with `?error_description=` when sign-in does not finish. Read it
 * once at startup and strip it, so a reload does not show the same error again.
 */
function takeRedirectError(): string | null {
  if (typeof window === 'undefined') return null
  const url = new URL(window.location.href)
  if (!url.searchParams.has('error') && !url.searchParams.has('error_description')) return null
  const message = url.searchParams.get('error_description') ?? 'Sign-in did not finish.'
  for (const key of ['error', 'error_code', 'error_description']) url.searchParams.delete(key)
  window.history.replaceState(window.history.state, '', url.toString())
  return message
}

const redirectError = takeRedirectError()

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [phase, setPhase] = useState<AuthPhase>(supabase ? 'loading' : 'unconfigured')

  const loadProfile = useCallback(async (userId: string) => {
    if (!supabase) return
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile(data ?? null)
    setPhase(data ? 'ready' : 'needs-profile')
  }, [])

  const refresh = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase.auth.getSession()
    setSession(data.session)
    if (data.session?.user) await loadProfile(data.session.user.id)
    else setPhase('signed-out')
  }, [loadProfile])

  useEffect(() => {
    if (!supabase) return
    // INITIAL_SESSION fires straight away, so this one listener covers startup, landing
    // back from GitHub, and signing out.
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (!next?.user) {
        setProfile(null)
        setPhase('signed-out')
        return
      }
      if (event === 'TOKEN_REFRESHED') return
      const userId = next.user.id
      // Supabase holds a lock while this callback runs, and querying from inside it can
      // deadlock. Defer until the callback has returned.
      setTimeout(() => void loadProfile(userId), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadProfile])

  return { phase, session, profile, redirectError, refresh }
}

/**
 * Sends the whole app to GitHub and back. Unlike an emailed link, the round trip starts
 * and ends in this app's own window, so the installed iPhone app keeps its own session.
 */
export async function signInWithGitHub(): Promise<void> {
  if (!supabase) throw new Error('Cloud not configured')
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: authRedirectUrl() },
  })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut()
}

/** A handle suggestion from the GitHub username, cleaned up to fit the handle rules. */
export function suggestedHandle(session: Session | null): string {
  const raw = session?.user.user_metadata?.user_name
  if (typeof raw !== 'string') return ''
  return raw.toLowerCase().replace(/-/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 20)
}

/** The GitHub display name, if there is one. */
export function suggestedName(session: Session | null): string {
  const raw = session?.user.user_metadata?.full_name ?? session?.user.user_metadata?.name
  return typeof raw === 'string' ? raw.slice(0, 40) : ''
}

export async function claimProfile(handle: string, displayName: string, emoji: string): Promise<void> {
  if (!supabase) throw new Error('Cloud not configured')
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Not signed in')

  const clean = handle.trim().toLowerCase()
  if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
    throw new Error('Handles are 3–20 characters: letters, numbers and underscores.')
  }

  const { data: free } = await supabase.rpc('handle_available', { h: clean })
  if (free === false) throw new Error('That handle is taken.')

  const { error } = await supabase.from('profiles').insert({
    id: auth.user.id,
    handle: clean,
    display_name: displayName.trim() || clean,
    avatar_emoji: emoji,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })
  if (error) throw error
}
