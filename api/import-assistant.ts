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

function json(body: unknown, status = 200) {
  return Response.json(body, { status })
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

export default async function handler(request: Request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY
  const geminiKey = process.env.GEMINI_API_KEY
  const geminiModel = process.env.GEMINI_MODEL
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!supabaseUrl || !supabaseKey || !geminiKey || !geminiModel) return json({ error: 'L assistant n est pas configure.' }, 503)
  if (!token) return json({ error: 'Authentification requise.' }, 401)

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return json({ error: 'Requete invalide.' }, 400)
  }
  if (!isRequest(payload)) return json({ error: 'Envoyez entre une et dix lignes avec leurs categories.' }, 400)

  const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) return json({ error: 'Session invalide.' }, 401)

  const { data: allowance, error: allowanceError } = await supabase.rpc('consume_ai_import_quota')
  if (allowanceError) return json({ error: 'Impossible de verifier le quota assistant.' }, 500)
  if (!allowance?.allowed) return json({ error: allowance?.reason === 'global_limit' ? 'Le budget mensuel de l assistant est atteint.' : 'Votre quota mensuel assistant est atteint.' }, 429)

  const prompt = `Tu classes des lignes de budget francaises. Propose uniquement une categorie existante, sans creer ni modifier de transaction. Reponds avec un tableau JSON sans markdown: [{"id":"...","categoryId":"... ou null","confidence":"low|medium|high","explanation":"moins de 240 caracteres"}]. Categories: ${JSON.stringify(payload.categories)}. Lignes ambiguës: ${JSON.stringify(payload.lines)}`
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(geminiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 1200 } }),
    })
    if (!response.ok) return json({ error: 'L assistant ne peut pas traiter cette demande.' }, 502)
    const responseBody = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    const text = responseBody.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return json({ error: 'L assistant n a renvoye aucune proposition.' }, 502)
    return json({ suggestions: suggestionsFrom(extractJson(text), payload.lines, payload.categories), estimatedMonthlyCostEur: allowance.estimated_cost_eur, costWarning: allowance.estimated_cost_eur >= 3 })
  } catch {
    return json({ error: 'La reponse de l assistant est invalide.' }, 502)
  }
}