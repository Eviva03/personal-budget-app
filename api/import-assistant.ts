import { createClient } from '@supabase/supabase-js'

type CategoryInput = { id: string; name: string; type: 'income' | 'expense' }
type ImportLine = { id: string; description: string; amount: number; occurredAt: string }
type AssistantRequest = { lines: ImportLine[]; categories: CategoryInput[] }
type AssistantSuggestion = {
  id: string
  categoryId: string | null
  confidence: 'low' | 'medium' | 'high'
  explanation: string
}

const maxLines = 10

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

function extractJson(text: string) {
  const value = text.trim().replace(/^```json\s*|\s*```$/g, '')
  return JSON.parse(value) as unknown
}

function suggestionsFrom(value: unknown, lines: ImportLine[], categories: CategoryInput[]) {
  if (!Array.isArray(value)) return []
  const lineIds = new Set(lines.map((line) => line.id))
  const categoryIds = new Set(categories.map((category) => category.id))
  return value.flatMap((item): AssistantSuggestion[] => {
    if (!item || typeof item !== 'object') return []
    const suggestion = item as Partial<AssistantSuggestion>
    const confidence = suggestion.confidence
    if (typeof suggestion.id !== 'string' || !lineIds.has(suggestion.id) || typeof suggestion.explanation !== 'string' || suggestion.explanation.length > 240 || (confidence !== 'low' && confidence !== 'medium' && confidence !== 'high') || (suggestion.categoryId !== null && (typeof suggestion.categoryId !== 'string' || !categoryIds.has(suggestion.categoryId)))) return []
    return [{ id: suggestion.id, categoryId: suggestion.categoryId ?? null, confidence, explanation: suggestion.explanation }]
  })
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') return send(response, { error: 'Method not allowed.' }, 405)

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY
  const geminiKey = process.env.GEMINI_API_KEY
  const geminiModel = process.env.GEMINI_MODEL
  const authorization = request.headers.authorization
  const token = (Array.isArray(authorization) ? authorization[0] : authorization)?.replace(/^Bearer\s+/i, '')
  if (!supabaseUrl || !supabaseKey || !geminiKey || !geminiModel) return send(response, { error: 'L assistant n est pas configure.' }, 503)
  if (!token) return send(response, { error: 'Authentification requise.' }, 401)

  const payload = request.body
  if (!isRequest(payload)) return send(response, { error: 'Envoyez entre une et dix lignes avec leurs categories.' }, 400)

  const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) return send(response, { error: 'Session invalide.' }, 401)

  const { data: allowance, error: allowanceError } = await supabase.rpc('consume_ai_import_quota')
  if (allowanceError) return send(response, { error: 'Impossible de verifier le quota assistant.' }, 500)
  if (!allowance?.allowed) return send(response, { error: allowance?.reason === 'global_limit' ? 'Le budget mensuel de l assistant est atteint.' : 'Votre quota mensuel assistant est atteint.' }, 429)

  const prompt = `Tu classes des lignes de budget francaises. Propose uniquement une categorie existante, sans creer ni modifier de transaction. Reponds avec un tableau JSON sans markdown: [{"id":"...","categoryId":"... ou null","confidence":"low|medium|high","explanation":"moins de 240 caracteres"}]. Categories: ${JSON.stringify(payload.categories)}. Lignes ambiguës: ${JSON.stringify(payload.lines)}`
  try {
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(geminiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 1200 } }),
    })
    if (!geminiResponse.ok) return send(response, { error: 'L assistant ne peut pas traiter cette demande.' }, 502)
    const responseBody = await geminiResponse.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    const text = responseBody.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return send(response, { error: 'L assistant n a renvoye aucune proposition.' }, 502)
    return send(response, { suggestions: suggestionsFrom(extractJson(text), payload.lines, payload.categories), estimatedMonthlyCostEur: allowance.estimated_cost_eur, costWarning: allowance.estimated_cost_eur >= 3 })
  } catch {
    return send(response, { error: 'La reponse de l assistant est invalide.' }, 502)
  }
}