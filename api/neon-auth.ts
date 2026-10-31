import { handleAuthProxyRequest, validateCookieConfig } from '@neondatabase/neon-js/auth/server'

async function proxy(request: Request) {
  const baseUrl = process.env.NEON_AUTH_BASE_URL?.replace(/\/$/, '')
  const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET
  if (!baseUrl || !cookieSecret) return Response.json({ error: 'Auth proxy is not configured.' }, { status: 500 })
  validateCookieConfig({ secret: cookieSecret })

  const url = new URL(request.url)
  const path = url.searchParams.get('path') ?? ''
  url.searchParams.delete('path')
  // The proxy's cached get-session omits the set-auth-jwt header the Data API needs.
  if (path === 'get-session') url.searchParams.set('disableCookieCache', 'true')
  // Only plain endpoint names, so the upstream host and base path can never be escaped.
  if (!/^[a-z0-9-]+(\/[a-z0-9-]+)*$/i.test(path)) return Response.json({ error: 'Invalid auth path.' }, { status: 400 })

  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text()
  return handleAuthProxyRequest({
    request: new Request(url, { method: request.method, headers: request.headers, body }),
    path,
    baseUrl,
    cookieSecret,
  })
}

export const GET = proxy
export const POST = proxy
