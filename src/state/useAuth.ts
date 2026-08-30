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
  refresh: () => Promise<void>
}

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
    void refresh()
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (next?.user) void loadProfile(next.user.id)
      else {
        setProfile(null)
        setPhase('signed-out')
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [refresh, loadProfile])

  return { phase, session, profile, refresh }
}

export async function sendMagicLink(email: string): Promise<void> {
  if (!supabase) throw new Error('Cloud not configured')
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: authRedirectUrl() },
  })
  if (error) throw error
}

/**
 * An installed PWA has its own storage, separate from Safari. A magic link tapped in
 * Mail opens in Safari, so the session lands in the wrong box and the PWA never sees
 * it — and PKCE fails outright, since the code verifier lives in the PWA's storage.
 *
 * Typing the emailed code keeps the whole exchange inside the app, where it belongs.
 */
export async function verifyEmailCode(email: string, token: string): Promise<void> {
  if (!supabase) throw new Error('Cloud not configured')
  const clean = { email: email.trim(), token: token.trim() }

  // A first-ever sign-in is a signup confirmation; a returning user gets a magic-link
  // OTP. The generic 'email' type covers both on most versions, but fall back rather
  // than tell someone their correct code is wrong.
  const attempts = ['email', 'signup', 'magiclink'] as const
  let lastError: Error | null = null

  for (const type of attempts) {
    const { error } = await supabase.auth.verifyOtp({ ...clean, type })
    if (!error) return
    lastError = error
    // A wrong or expired code is final — only retry when the *type* was the problem.
    if (/expired|invalid/i.test(error.message) && !/type/i.test(error.message)) break
  }
  throw lastError ?? new Error('Could not verify that code.')
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut()
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
