import { type ReactNode, useEffect, useState } from 'react'
import { isNeonConfigured, neon } from '../../lib/neon'
import { AuthContext, type AuthUser } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(isNeonConfigured)

  useEffect(() => {
    if (!neon) return
    const client = neon
    function toAuthUser(candidate: { id: string; email?: string | null } | null): AuthUser | null {
      return candidate?.email ? { id: candidate.id, email: candidate.email } : null
    }
    async function restoreSession() {
      try {
        const { data } = await client.auth.getUser()
        const authenticatedUser = toAuthUser(data.user)
        if (authenticatedUser) await client.rpc('claim_legacy_budget')
        setUser(authenticatedUser)
      } catch (error) {
        console.error('Neon session restoration failed', error)
      } finally {
        setLoading(false)
      }
    }
    void restoreSession()
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      const authenticatedUser = toAuthUser(session?.user ?? null)
      setUser(authenticatedUser)
      if (authenticatedUser) void client.rpc('claim_legacy_budget')
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string) {
    if (!neon) return { error: 'Neon n est pas configure.' }
    const { error } = await neon.auth.signInWithOtp({ email })
    return error ? { error: error.message } : {}
  }

  async function verifyCode(email: string, code: string) {
    if (!neon) return { error: 'Neon n est pas configure.' }
    const { error } = await neon.auth.verifyOtp({ email, token: code, type: 'email' })
    return error ? { error: error.message } : {}
  }

  async function signOut() { await neon?.auth.signOut() }

  return <AuthContext value={{ configured: isNeonConfigured, loading, user, signIn, verifyCode, signOut }}>{children}</AuthContext>
}