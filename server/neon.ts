import { createClient } from '@neondatabase/neon-js'

function dataApiUrl(connectionUrl: string) {
  const url = new URL(connectionUrl)
  const hostname = url.hostname.split('.')
  const serviceIndex = hostname.findIndex((part) => part === 'neonauth' || part === 'apirest')
  if (serviceIndex === -1) hostname.splice(1, 0, 'apirest')
  else hostname[serviceIndex] = 'apirest'
  url.hostname = hostname.join('.')
  const pathname = url.pathname.replace(/\/(auth|rest\/v1)\/?$/, '').replace(/\/$/, '')
  url.pathname = `${pathname}/rest/v1`
  return url.toString()
}

export function createAuthenticatedNeonClient(token: string) {
  const connectionUrl = process.env.NEON_URL ?? process.env.NEON_AUTH_BASE_URL
  if (!connectionUrl) return null
  return createClient({ dataApi: { url: dataApiUrl(connectionUrl), getToken: async () => token } })
}

export async function hasAuthenticatedUser(client: NonNullable<ReturnType<typeof createAuthenticatedNeonClient>>) {
  const { data, error } = await client.from('profiles').select('id').maybeSingle()
  return !error && Boolean(data)
}