import { createAuthenticatedNeonClient, hasAuthenticatedUser } from './neon.js'

type CategoryInput = { id: string; name: string; type: 'income' | 'expense' }
type AssistantRequest = { text: string; categories: CategoryInput[] }
type DocumentKind = 'bank_statement' | 'invoice' | 'receipt' | 'unknown'
type ExtractedTransaction = {
  description: string
  amount: number
  occurredAt: string
  categoryId: string | null
}
type DocumentProposal = {
  kind: DocumentKind
  description: string
  amount: number | null
  dueDate: string | null
  categoryId: string | null
  confidence: 'low' | 'medium' | 'high'
  explanation: string
  transactions: ExtractedTransaction[]
}
type ApiRequest = { method?: string; headers: { authorization?: string | string[] | undefined }; body?: unknown }
type ApiResponse = { status: (status: number) => ApiResponse; json: (body: unknown) => void }
const fallbackModel = 'gemini-3.1-flash-lite'

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
  const kindValue = typeof proposal.kind === 'string' ? proposal.kind.toLowerCase().replace(/[ -]/g, '_') : 'unknown'
  const kind: DocumentKind = kindValue === 'bank_statement' || kindValue === 'invoice' || kindValue === 'receipt' ? kindValue : 'unknown'
  const categoryIds = new Set(categories.map((category) => category.id))
  const amount = typeof proposal.amount === 'number' && Number.isFinite(proposal.amount) && proposal.amount >= 0 ? proposal.amount : null
  const dueDate = typeof proposal.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(proposal.dueDate) ? proposal.dueDate : null
  const categoryId = typeof proposal.categoryId === 'string' && categoryIds.has(proposal.categoryId) ? proposal.categoryId : null
  const confidence: DocumentProposal['confidence'] = proposal.confidence === 'high' || proposal.confidence === 'medium' || proposal.confidence === 'low' ? proposal.confidence : 'low'
  const description = typeof proposal.description === 'string' && proposal.description.trim() ? proposal.description.trim().slice(0, 200) : kind === 'bank_statement' ? 'Relevé bancaire' : 'Document à vérifier'
  const explanation = typeof proposal.explanation === 'string' && proposal.explanation.trim() ? proposal.explanation.trim().slice(0, 240) : 'Proposition à vérifier avant toute saisie.'
  const transactions = Array.isArray(proposal.transactions)
    ? proposal.transactions.flatMap((value): ExtractedTransaction[] => {
        if (!value || typeof value !== 'object') return []
        const transaction = value as Partial<ExtractedTransaction>
        const transactionAmount = typeof transaction.amount === 'number' && Number.isFinite(transaction.amount) && transaction.amount > 0 ? transaction.amount : null
        const occurredAt = typeof transaction.occurredAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(transaction.occurredAt) ? transaction.occurredAt : null
        const transactionDescription = typeof transaction.description === 'string' ? transaction.description.trim().slice(0, 200) : ''
        const transactionCategoryId = typeof transaction.categoryId === 'string' && categoryIds.has(transaction.categoryId) ? transaction.categoryId : null
        return transactionAmount !== null && occurredAt && transactionDescription ? [{ description: transactionDescription, amount: transactionAmount, occurredAt, categoryId: transactionCategoryId }] : []
      }).slice(0, 25)
    : []
  return { kind, description, amount, dueDate, categoryId, confidence, explanation, transactions }
}

function parseAssistantJson(text: string): unknown {
  const content = text.trim().replace(/^```(?:json)?\s*|\s*```$/gi, '')
  try {
    return JSON.parse(content)
  } catch {
    const start = content.indexOf('{')
    const end = content.lastIndexOf('}')
    if (start < 0 || end <= start) throw new Error('Assistant response is incomplete')
    return JSON.parse(content.slice(start, end + 1))
  }
}

async function generateDocumentAnalysis(models: string[], apiKey: string, body: string) {
  for (const model of models) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal: AbortSignal.timeout(15_000),
      })
      if (response.status !== 429 && response.status !== 503) return response
    } catch {
      // Try the fallback after a transient network failure or timeout.
    }
  }
  throw new Error('Gemini is unavailable')
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') return send(response, { error: 'Method not allowed.' }, 405)
  const geminiKey = process.env.GEMINI_API_KEY
  const geminiModel = process.env.GEMINI_MODEL
  const authorization = request.headers.authorization
  const token = (Array.isArray(authorization) ? authorization[0] : authorization)?.replace(/^Bearer\s+/i, '')
  if (!geminiKey || !geminiModel) return send(response, { error: 'L’assistant n’est pas configuré.' }, 503)
  if (!token) return send(response, { error: 'Authentification requise.' }, 401)
  if (!isRequest(request.body)) return send(response, { error: 'Envoyez le texte extrait et les catégories disponibles.' }, 400)

  const neon = createAuthenticatedNeonClient(token)
  if (!neon) return send(response, { error: 'L’assistant n’est pas configuré.' }, 503)
  if (!await hasAuthenticatedUser(neon)) return send(response, { error: 'Session invalide.' }, 401)
  const { data: allowance, error: allowanceError } = await neon.rpc('consume_ai_import_quota')
  if (allowanceError) return send(response, { error: 'Impossible de vérifier le quota de l’assistant.' }, 500)
  if (!allowance?.allowed) return send(response, { error: allowance?.reason === 'global_limit' ? 'Le budget mensuel de l’assistant est atteint.' : 'Votre quota mensuel pour l’assistant est atteint.' }, 429)

  const prompt = `Tu analyses des documents financiers personnels en francais. Ne crees et ne modifies jamais de donnees. Identifie le type: bank_statement, invoice, receipt ou unknown. Pour une facture ou un ticket, extrais seulement un fournisseur ou libelle, total, echeance ISO si explicite, et une categorie existante. Pour un bank_statement, extrais au plus 10 operations dont la date, le libelle et le montant sont explicites; ignore les totaux, soldes et valeurs incertaines. Chaque operation doit avoir une date ISO et un montant positif. Reponds uniquement en JSON sans markdown: {"kind":"bank_statement|invoice|receipt|unknown","description":"...","amount":number|null,"dueDate":"YYYY-MM-DD"|null,"categoryId":"..."|null,"confidence":"low|medium|high","explanation":"moins de 240 caracteres","transactions":[{"description":"...","amount":number,"occurredAt":"YYYY-MM-DD","categoryId":"..."|null}]}. Categories: ${JSON.stringify(request.body.categories)}. Texte extrait: ${request.body.text}`
  try {
    const geminiResponse = await generateDocumentAnalysis([...new Set([geminiModel, fallbackModel])], geminiKey, JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 2_500 } }))
    if (!geminiResponse.ok) return send(response, { error: 'L’assistant ne peut pas traiter ce document.' }, 502)
    const body = await geminiResponse.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return send(response, { error: 'L’assistant n’a renvoyé aucune proposition.' }, 502)
    const proposal = proposalFrom(parseAssistantJson(text), request.body.categories)
    if (!proposal) {
      console.error('Gemini document proposal did not match the expected shape', { response: text.slice(0, 1_000) })
      return send(response, { error: 'La proposition de l’assistant est invalide.' }, 502)
    }
    return send(response, { proposal, estimatedMonthlyCostEur: allowance.estimated_cost_eur, costWarning: allowance.estimated_cost_eur >= 3 })
  } catch (error) {
    console.error('Gemini document proposal could not be processed', { error: error instanceof Error ? error.message : String(error) })
    return send(response, { error: error instanceof Error && error.message === 'Assistant response is incomplete' ? 'La réponse de l’assistant est incomplète. Réessayez dans quelques instants.' : 'La réponse de l’assistant est invalide.' }, 502)
  }
}