import { createAuthenticatedNeonClient, hasAuthenticatedUser } from '../server/neon'

type CategoryInput = { id: string; name: string; type: 'income' | 'expense' }
type AssistantRequest = { text: string; categories: CategoryInput[] }
type DocumentKind = 'bank_statement' | 'invoice' | 'receipt' | 'unknown'
type DocumentProposal = {
  kind: DocumentKind
  description: string
  amount: number | null
  dueDate: string | null
  categoryId: string | null
  confidence: 'low' | 'medium' | 'high'
  explanation: string
}
type ApiRequest = { method?: string; headers: { authorization?: string | string[] | undefined }; body?: unknown }
type ApiResponse = { status: (status: number) => ApiResponse; json: (body: unknown) => void }

function send(response: ApiResponse, body: unknown, status = 200) {
  response.status(status).json(body)
}

function isRequest(value: unknown): value is AssistantRequest {
  if (!value || typeof value !== 'object') return false
  const { text, categories } = value as Partial<AssistantRequest>
  return typeof text === 'string' && text.trim().length > 0 && text.length <= 12_000 && Array.isArray(categories) && categories.length > 0 && categories.length <= 50 && categories.every((category) => typeof category?.id === 'string' && typeof category.name === 'string' && (category.type === 'income' || category.type === 'expense'))
}

function proposalFrom(value: unknown, categories: CategoryInput[]): DocumentProposal | null {
  if (!value || typeof value !== 'object') return null
  const proposal = value as Partial<DocumentProposal>
  const kind = proposal.kind
  const categoryIds = new Set(categories.map((category) => category.id))
  if ((kind !== 'bank_statement' && kind !== 'invoice' && kind !== 'receipt' && kind !== 'unknown') || typeof proposal.description !== 'string' || proposal.description.length > 200 || (proposal.amount !== null && (typeof proposal.amount !== 'number' || !Number.isFinite(proposal.amount) || proposal.amount < 0)) || (proposal.dueDate !== null && (typeof proposal.dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(proposal.dueDate))) || (proposal.categoryId !== null && (typeof proposal.categoryId !== 'string' || !categoryIds.has(proposal.categoryId))) || (proposal.confidence !== 'low' && proposal.confidence !== 'medium' && proposal.confidence !== 'high') || typeof proposal.explanation !== 'string' || proposal.explanation.length > 240) return null
  return { kind, description: proposal.description, amount: proposal.amount ?? null, dueDate: proposal.dueDate ?? null, categoryId: proposal.categoryId ?? null, confidence: proposal.confidence, explanation: proposal.explanation }
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') return send(response, { error: 'Method not allowed.' }, 405)
  const geminiKey = process.env.GEMINI_API_KEY
  const geminiModel = process.env.GEMINI_MODEL
  const authorization = request.headers.authorization
  const token = (Array.isArray(authorization) ? authorization[0] : authorization)?.replace(/^Bearer\s+/i, '')
  if (!geminiKey || !geminiModel) return send(response, { error: 'L assistant n est pas configure.' }, 503)
  if (!token) return send(response, { error: 'Authentification requise.' }, 401)
  if (!isRequest(request.body)) return send(response, { error: 'Envoyez le texte extrait et les categories disponibles.' }, 400)

  const neon = createAuthenticatedNeonClient(token)
  if (!neon) return send(response, { error: 'L assistant n est pas configure.' }, 503)
  if (!await hasAuthenticatedUser(neon)) return send(response, { error: 'Session invalide.' }, 401)
  const { data: allowance, error: allowanceError } = await neon.rpc('consume_ai_import_quota')
  if (allowanceError) return send(response, { error: 'Impossible de verifier le quota assistant.' }, 500)
  if (!allowance?.allowed) return send(response, { error: allowance?.reason === 'global_limit' ? 'Le budget mensuel de l assistant est atteint.' : 'Votre quota mensuel assistant est atteint.' }, 429)

  const prompt = `Tu analyses des documents financiers personnels en francais. Ne crees et ne modifies jamais de donnees. Identifie le type: bank_statement, invoice, receipt ou unknown. Pour une facture ou un ticket, extrais seulement un fournisseur ou libelle, total, echeance ISO si explicite, et une categorie existante. Reponds uniquement en JSON sans markdown: {"kind":"bank_statement|invoice|receipt|unknown","description":"...","amount":number|null,"dueDate":"YYYY-MM-DD"|null,"categoryId":"..."|null,"confidence":"low|medium|high","explanation":"moins de 240 caracteres"}. Categories: ${JSON.stringify(request.body.categories)}. Texte extrait: ${request.body.text}`
  try {
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(geminiKey)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 700 } }) })
    if (!geminiResponse.ok) return send(response, { error: 'L assistant ne peut pas traiter ce document.' }, 502)
    const body = await geminiResponse.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return send(response, { error: 'L assistant n a renvoye aucune proposition.' }, 502)
    const proposal = proposalFrom(JSON.parse(text.trim().replace(/^```json\s*|\s*```$/g, '')), request.body.categories)
    if (!proposal) return send(response, { error: 'La proposition de l assistant est invalide.' }, 502)
    return send(response, { proposal, estimatedMonthlyCostEur: allowance.estimated_cost_eur, costWarning: allowance.estimated_cost_eur >= 3 })
  } catch {
    return send(response, { error: 'La reponse de l assistant est invalide.' }, 502)
  }
}