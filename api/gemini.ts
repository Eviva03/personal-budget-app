const retryableStatuses = new Set([404, 429, 500, 502, 503, 504])

// 0.01 EUR per call against a 0.20 EUR daily cap shared by all users.
export const dailyWarningThresholdEur = 0.18

// Fast, stable aliases come first; the model set in GEMINI_MODEL stays in the chain as a fallback.
// -latest aliases keep working when a version name is retired or overloaded.
const preferredModels = ['gemini-flash-lite-latest', 'gemini-3.5-flash']
const fallbackModels = ['gemini-3-flash-preview', 'gemini-3.1-flash-lite']
const perModelTimeoutMs = 12_000
const totalBudgetMs = 45_000
const unhealthyForMs = 120_000

// Models that just failed are tried last for a couple of minutes, so one overloaded model does not add a delay to every request.
const unhealthyUntil = new Map<string, number>()

export function modelChain(configured: string) {
  const all = [...new Set([...preferredModels, configured, ...fallbackModels])]
  const now = Date.now()
  return [...all.filter((model) => (unhealthyUntil.get(model) ?? 0) <= now), ...all.filter((model) => (unhealthyUntil.get(model) ?? 0) > now)]
}

export function quotaError(reason: unknown) {
  return reason === 'global_limit'
    ? 'La limite quotidienne de l’assistant est atteinte pour tous les utilisateurs. Réessayez demain.'
    : 'Vous avez atteint votre limite quotidienne d’analyses. Elle se renouvelle demain.'
}

export type GeminiResult = { response: Response; model: string }

// A slow, missing or overloaded model falls through to the next one; the key travels in a header, never in the URL.
export async function generateContent(models: string[], apiKey: string, body: string): Promise<GeminiResult> {
  const deadline = Date.now() + totalBudgetMs
  let last: GeminiResult | null = null
  let lastError: unknown
  for (const model of [...new Set(models)]) {
    const remaining = deadline - Date.now()
    if (remaining < 2_000) break
    const started = Date.now()
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body,
        signal: AbortSignal.timeout(Math.min(perModelTimeoutMs, remaining)),
      })
      console.info('Gemini call', { model, status: response.status, ms: Date.now() - started })
      if (!retryableStatuses.has(response.status)) {
        unhealthyUntil.delete(model)
        return { response, model }
      }
      unhealthyUntil.set(model, Date.now() + unhealthyForMs)
      last = { response, model }
    } catch (error) {
      lastError = error
      unhealthyUntil.set(model, Date.now() + unhealthyForMs)
      console.warn('Gemini call failed', { model, ms: Date.now() - started, error: error instanceof Error ? error.name : String(error) })
    }
  }
  if (last) return last
  throw lastError ?? new Error('Gemini did not return a response.')
}