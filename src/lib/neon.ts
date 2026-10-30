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

export const neon = isNeonConfigured
  ? createClient({
      auth: { url: serviceUrl('neonauth', 'auth'), adapter: SupabaseAuthAdapter() },
      dataApi: { url: serviceUrl('apirest', 'rest/v1') },
    })
  : null