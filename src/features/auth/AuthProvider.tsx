import { type ReactNode, useEffect, useRef, useState } from 'react'
import { isNeonConfigured, neon } from '../../lib/neon'
import { AuthContext, type AuthUser } from './auth-context'

function toAuthUser(candidate: { id: string; email?: string | null } | null): AuthUser | null {
  return candidate?.email ? { id: candidate.id, email: candidate.email } : null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(isNeonConfigured)
  const legacyClaimAttempted = useRef(new Set<string>())

  function claimLegacyBudget(userId: string) {
    if (!neon || legacyClaimAttempted.current.has(userId)) return
    legacyClaimAttempted.current.add(userId)
    void (async () => {
      const { error } = await neon.rpc('claim_legacy_budget')
      if (error) legacyClaimAttempted.current.delete(userId)
    })()
  }

  useEffect(() => {
    if (!neon) return
    const client = neon
    async function restoreSession() {
      try {
        const { data } = await client.auth.getUser()
        const authenticatedUser = toAuthUser(data.user)
        setUser(authenticatedUser)
        if (authenticatedUser) claimLegacyBudget(authenticatedUser.id)
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
      if (authenticatedUser) claimLegacyBudget(authenticatedUser.id)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string) {
    if (!neon) return { error: 'Neon n’est pas configuré.' }
    try {
      const { error } = await neon.auth.signInWithOtp({ email })
      return error ? { error: error.message } : {}
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Impossible d’envoyer le code de connexion.' }
    }
  }

  async function verifyCode(email: string, code: string) {
    if (!neon) return { error: 'Neon n’est pas configuré.' }
    try {
      const { data, error } = await neon.auth.verifyOtp({ email, token: code, type: 'email' })
      if (error) return { error: error.message }
      const authenticatedUser = toAuthUser(data?.user ?? null)
      if (!authenticatedUser) return { error: 'Connexion non confirmée. Demandez un nouveau code.' }
      setUser(authenticatedUser)
      claimLegacyBudget(authenticatedUser.id)
      return {}
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Impossible de vérifier ce code. Demandez-en un nouveau.' }
    }
  }

  async function signOut() {
    try {
      await neon?.auth.signOut()
    } catch (error) {
      console.error('Signout error:', error)
    } finally {
      setUser(null)
      window.location.href = '/'
    }
  }

  return <AuthContext value={{ configured: isNeonConfigured, loading, user, signIn, verifyCode, signOut }}>{children}</AuthContext>
}