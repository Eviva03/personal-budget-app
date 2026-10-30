import { createContext } from 'react'

export type AuthUser = {
  id: string
  email: string
}

export type AuthContextValue = {
  configured: boolean
  loading: boolean
  user: AuthUser | null
  signIn: (email: string) => Promise<{ error?: string }>
  verifyCode: (email: string, code: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)