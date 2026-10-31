import { createClient, SupabaseAuthAdapter } from '@neondatabase/neon-js'

function publicUrl(value: string | undefined) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

const neonUrl = publicUrl(import.meta.env.VITE_NEON_URL)
const neonAuthUrl = publicUrl(import.meta.env.VITE_NEON_AUTH_URL)

export const isNeonConfigured = Boolean(neonUrl || neonAuthUrl)

function serviceUrl(service: 'neonauth' | 'apirest', suffix: 'auth' | 'rest/v1') {
  const url = new URL(neonUrl ?? neonAuthUrl!)
  const hostname = url.hostname.split('.')
  const serviceIndex = hostname.findIndex((part) => part === 'neonauth' || part === 'apirest')
  if (serviceIndex === -1) hostname.splice(1, 0, service)
  else hostname[serviceIndex] = service
  url.hostname = hostname.join('.')
  const pathname = url.pathname.replace(/\/(auth|rest\/v1)\/?$/, '').replace(/\/$/, '')
  url.pathname = `${pathname}/${suffix}`
  return url.toString()
}

// Safari blocks third-party cookies, so in production auth goes through the same-origin proxy (api/neon-auth.ts).
function authUrl() {
  if (import.meta.env.PROD && typeof window !== 'undefined') return `${window.location.origin}/neon-auth`
  return serviceUrl('neonauth', 'auth')
}

export const neon = isNeonConfigured
  ? createClient({
      auth: { url: authUrl(), adapter: SupabaseAuthAdapter() },
      dataApi: { url: serviceUrl('apirest', 'rest/v1') },
    })
  : null