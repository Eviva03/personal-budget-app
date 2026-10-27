import type { User } from '@supabase/supabase-js'
import { type ReactNode, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getUser().then(({ data }) => { setUser(data.user); setLoading(false) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string) {
    if (!supabase) return { error: 'Supabase n est pas configure.' }
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
    return error ? { error: error.message } : {}
  }

  async function signOut() { await supabase?.auth.signOut() }

  return <AuthContext value={{ configured: isSupabaseConfigured, loading, user, signIn, signOut }}>{children}</AuthContext>
}