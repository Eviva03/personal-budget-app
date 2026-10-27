import type { User } from '@supabase/supabase-js'
import { createContext } from 'react'

export type AuthContextValue = {
  configured: boolean
  loading: boolean
  user: User | null
  signIn: (email: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)