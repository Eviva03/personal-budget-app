import { createAuthenticatedNeonClient, hasAuthenticatedUser } from './neon.js'
import { dailyWarningThresholdEur, generateContent, modelChain, quotaError } from './gemini.js'

type CategoryInput = { id: string; name: string; type: 'income' | 'expense' }
type ImportLine = { id: string; description: string; amount: number; occurredAt: string }
type AssistantRequest = { lines: ImportLine[]; categories: CategoryInput[] }
type AssistantSuggestion = {
  id: string
  categoryId: string | null
  confidence: 'low' | 'medium' | 'high'
  explanation: string
}

const maxLines = 25

type ApiRequest = {
  method?: string
  headers: { authorization?: string | string[] | undefined }
  body?: unknown
}

type ApiResponse = {
  status: (status: number) => ApiResponse
  json: (body: unknown) => void
}

function send(response: ApiResponse, body: unknown, status = 200) {
  response.status(status).json(body)
}

function isRequest(value: unknown): value is AssistantRequest {
  if (!value || typeof value !== 'object') return false
  const { lines, categories } = value as Partial<AssistantRequest>
  return Array.isArray(lines) && lines.length > 0 && lines.length <= maxLines && Array.isArray(categories) && categories.length > 0 && categories.length <= 50 && lines.every((line) => typeof line?.id === 'string' && typeof line.description === 'string' && line.description.length <= 200 && typeof line.amount === 'number' && Number.isFinite(line.amount) && typeof line.occurredAt === 'string') && categories.every((category) => typeof category?.id === 'string' && typeof category.name === 'string' && (category.type === 'income' || category.type === 'expense'))
}

function suggestionList(text: string): unknown[] {
  const cleaned = text.trim().replace(/^```(?:json)?\s*|\s*```$/gi, '')
  try {
    const parsed: unknown = JSON.parse(cleaned)
    if (Array.isArray(parsed)) return parsed
    if (parsed && typeof parsed === 'object') {
      const list = Object.values(parsed).find(Array.isArray)
      if (list) return list
    }
  } catch {
    // A truncated answer still contains complete objects worth keeping.
  }
  return [...cleaned.matchAll(/\{[^{}]*\}/g)].flatMap((match) => {
    try { return [JSON.parse(match[0]) as unknown] } catch { return [] }
  })
}

function suggestionsFrom(value: unknown, lines: ImportLine[], categories: CategoryInput[]) {
  if (!Array.isArray(value)) return []
  const lineIds = new Set(lines.map((line) => line.id))
  const categoryIds = new Set(categories.map((category) => category.id))
  return value.flatMap((item): AssistantSuggestion[] => {
    if (!item || typeof item !== 'object') return []
    const suggestion = item as Partial<AssistantSuggestion>
    const confidence = suggestion.confidence
    if (typeof suggestion.id !== 'string' || !lineIds.has(suggestion.id) || typeof suggestion.explanation !== 'string' || (confidence !== 'low' && confidence !== 'medium' && confidence !== 'high') || (suggestion.categoryId !== null && (typeof suggestion.categoryId !== 'string' || !categoryIds.has(suggestion.categoryId)))) return []
    return [{ id: suggestion.id, categoryId: suggestion.categoryId ?? null, confidence, explanation: suggestion.explanation.trim().slice(0, 240) }]
  })
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') return send(response, { error: 'Method not allowed.' }, 405)

  const geminiKey = process.env.GEMINI_API_KEY
  const geminiModel = process.env.GEMINI_MODEL
  const authorization = request.headers.authorization
  const token = (Array.isArray(authorization) ? authorization[0] : authorization)?.replace(/^Bearer\s+/i, '')
  if (!geminiKey || !geminiModel) return send(response, { error: 'L’assistant n’est pas configuré.' }, 503)
  if (!token) return send(response, { error: 'Authentification requise.' }, 401)

  const payload = request.body
  if (!isRequest(payload)) return send(response, { error: 'Envoyez entre une et vingt-cinq lignes avec leurs catégories.' }, 400)

  const neon = createAuthenticatedNeonClient(token)
  if (!neon) return send(response, { error: 'L’assistant n’est pas configuré.' }, 503)
  if (!await hasAuthenticatedUser(neon)) return send(response, { error: 'Session invalide.' }, 401)

  const { data: allowance, error: allowanceError } = await neon.rpc('consume_ai_import_quota')
  if (allowanceError) return send(response, { error: 'Impossible de vérifier le quota de l’assistant.' }, 500)
  if (!allowance?.allowed) return send(response, { error: quotaError(allowance?.reason) }, 429)

  const prompt = `Tu classes des lignes de budget francaises. Propose uniquement une categorie existante, sans creer ni modifier de transaction. Reponds avec un tableau JSON sans markdown: [{"id":"...","categoryId":"... ou null","confidence":"low|medium|high","explanation":"moins de 120 caracteres"}]. Categories: ${JSON.stringify(payload.categories)}. Lignes ambiguës: ${JSON.stringify(payload.lines)}`
  try {
    const { response: geminiResponse, model } = await generateContent(modelChain(geminiModel), geminiKey, JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 4000 } }))
    if (!geminiResponse.ok) return send(response, { error: 'L’assistant ne peut pas traiter cette demande.' }, 502)
    const responseBody = await geminiResponse.json() as { candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[] }
    const candidate = responseBody.candidates?.[0]
    const text = (candidate?.content?.parts ?? []).filter((part) => !part.thought).map((part) => part.text ?? '').join('')
    if (!text.trim()) {
      console.warn('Gemini returned no text', { model, finishReason: candidate?.finishReason })
      return send(response, { error: 'L’assistant n’a renvoyé aucune proposition.' }, 502)
    }
    const suggestions = suggestionsFrom(suggestionList(text), payload.lines, payload.categories)
    if (suggestions.length === 0) {
      console.warn('Gemini suggestions unreadable', { model, finishReason: candidate?.finishReason, sample: text.slice(0, 300) })
      return send(response, { error: 'L’assistant n’a pas pu proposer de catégorie fiable. Réessayez.' }, 502)
    }
    return send(response, { suggestions, model, estimatedDailyCostEur: allowance.estimated_cost_eur, costWarning: allowance.estimated_cost_eur >= dailyWarningThresholdEur })
  } catch (error) {
    console.error('Gemini suggestions could not be processed', { error: error instanceof Error ? error.message : String(error) })
    return send(response, { error: 'La réponse de l’assistant est invalide.' }, 502)
  }
}