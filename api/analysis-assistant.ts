import { createAuthenticatedNeonClient, hasAuthenticatedUser } from './neon.js'
import { dailyWarningThresholdEur, generateContent, modelChain, quotaError } from './gemini.js'

type ApiRequest = { method?: string; headers: { authorization?: string | string[] | undefined }; body?: unknown }
type ApiResponse = { status: (status: number) => ApiResponse; json: (body: unknown) => void }
type Insight = { summary: string; risks: string[]; anomalies: string[]; recommendations: string[]; tone: 'good' | 'watch' | 'alert' }
type Category = { id: string; name: string; type: 'income' | 'expense' }
type Transaction = { id?: string; amount: number; occurred_at: string; description?: string | null; category_id: string | null; direction?: 'income' | 'expense' | null; review_status?: string | null }
type Commitment = { amount: number; description: string; due_date: string; frequency: 'once' | 'weekly' | 'monthly' | 'yearly'; status: 'active' | 'paused' | 'completed'; installment_count?: number | null }

function send(response: ApiResponse, body: unknown, status = 200) {
  response.status(status).json(body)
}

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function rounded(amount: number) {
  return Math.round(amount * 100) / 100
}

// Fixed peg between the two supported currencies, same value as src/features/budget/money.ts.
const euroToXafRate = 655.957

function clientContext(body: unknown) {
  const value = (body && typeof body === 'object' ? body : {}) as { today?: unknown; displayCurrency?: unknown }
  const now = new Date()
  let today = now
  // The server runs in UTC: trust the browser's local day, but only when it is plausible.
  if (typeof value.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.today)) {
    const candidate = new Date(`${value.today}T12:00:00`)
    if (Math.abs(candidate.getTime() - now.getTime()) <= 2 * 86_400_000) today = candidate
  }
  return { today, displayCurrency: value.displayCurrency === 'XAF' ? 'XAF' as const : 'EUR' as const }
}

// Mirrors monthlyCommitmentAmount() in src/features/budget/budget-engine.ts so the assistant quotes the same figures as the page.
function monthlyCommitmentAmount(commitment: Commitment, reference: Date) {
  if (commitment.status !== 'active') return 0
  const first = new Date(`${commitment.due_date}T00:00:00`)
  const monthDistance = (reference.getFullYear() - first.getFullYear()) * 12 + reference.getMonth() - first.getMonth()
  if (commitment.frequency !== 'once' && monthDistance < 0) return 0
  if (commitment.frequency === 'monthly' && commitment.installment_count && monthDistance >= commitment.installment_count) return 0
  if (commitment.frequency === 'weekly') return commitment.amount * 52 / 12
  if (commitment.frequency === 'monthly') return commitment.amount
  if (commitment.frequency === 'yearly') return commitment.amount / 12
  return monthDistance === 0 ? commitment.amount : 0
}

function nextPayday(paydayDay: number, today: Date) {
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const payday = new Date(today.getFullYear(), today.getMonth(), paydayDay)
  if (payday < startOfToday) payday.setMonth(payday.getMonth() + 1)
  return payday
}

function addMonthsClamped(date: Date, months: number) {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1)
  target.setDate(Math.min(date.getDate(), new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()))
  return target
}

function nextCommitmentDate(commitment: Commitment, today: Date) {
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const first = new Date(`${commitment.due_date}T00:00:00`)
  if (commitment.frequency === 'once') return first >= startOfToday ? first : null
  if (commitment.frequency === 'monthly' && commitment.installment_count && addMonthsClamped(first, commitment.installment_count - 1) < startOfToday) return null
  const date = new Date(first)
  for (let step = 1; date < startOfToday; step++) {
    if (commitment.frequency === 'weekly') date.setDate(date.getDate() + 7)
    else if (commitment.frequency === 'monthly') date.setTime(addMonthsClamped(first, step).getTime())
    else date.setTime(addMonthsClamped(first, step * 12).getTime())
  }
  return date
}

function normalizedInsightList(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().slice(0, 220))
    .filter(Boolean)
    .slice(0, 3)
}

function insightFrom(value: unknown): Insight | null {
  if (!value || typeof value !== 'object') return null
  const insight = value as Partial<Insight>
  if (typeof insight.summary !== 'string' || !insight.summary.trim()) return null
  return {
    summary: insight.summary.trim().slice(0, 420),
    risks: normalizedInsightList(insight.risks),
    anomalies: normalizedInsightList(insight.anomalies),
    recommendations: normalizedInsightList(insight.recommendations),
    tone: insight.tone === 'good' || insight.tone === 'alert' ? insight.tone : 'watch',
  }
}

function geminiFailureMessage(status: number) {
  if (status === 400 || status === 404) return 'Le modèle Gemini configuré est indisponible.'
  if (status === 401 || status === 403) return 'La clé Gemini ne peut pas utiliser le modèle configuré.'
  if (status === 429) return 'Gemini limite temporairement les analyses. Réessayez dans quelques minutes.'
  return 'Gemini est indisponible pour le moment. Réessayez plus tard.'
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') return send(response, { error: 'Method not allowed.' }, 405)
  const geminiKey = process.env.GEMINI_API_KEY
  const geminiModel = process.env.GEMINI_MODEL
  const authorization = request.headers.authorization
  const token = (Array.isArray(authorization) ? authorization[0] : authorization)?.replace(/^Bearer\s+/i, '')
  if (!geminiKey || !geminiModel) return send(response, { error: 'L’assistant n’est pas configuré.' }, 503)
  if (!token) return send(response, { error: 'Authentification requise.' }, 401)

  const neon = createAuthenticatedNeonClient(token)
  if (!neon) return send(response, { error: 'L’assistant n’est pas configuré.' }, 503)
  if (!await hasAuthenticatedUser(neon)) return send(response, { error: 'Session invalide.' }, 401)

  const { today, displayCurrency } = clientContext(request.body)
  const monthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const [{ data: settings, error: settingsError }, { data: categories, error: categoriesError }, { data: transactions, error: transactionsError }, { data: commitments, error: commitmentsError }] = await Promise.all([
    neon.from('budget_settings').select('monthly_income, reserve_amount, payday_day, budget_currency').maybeSingle(),
    neon.from('categories').select('id, name, type'),
    neon.from('transactions').select('id, amount, occurred_at, description, category_id, direction, review_status').gte('occurred_at', isoDate(monthStart)),
    neon.from('commitments').select('amount, description, due_date, frequency, status, installment_count'),
  ])
  if (settingsError || categoriesError || transactionsError || commitmentsError) return send(response, { error: 'Impossible de charger les données budgétaires.' }, 500)
  if (!settings) return send(response, { error: 'Configurez votre budget avant cette analyse.' }, 400)

  const { data: allowance, error: allowanceError } = await neon.rpc('consume_ai_import_quota')
  if (allowanceError) return send(response, { error: 'Impossible de vérifier le quota de l’assistant.' }, 500)
  if (!allowance?.allowed) return send(response, { error: quotaError(allowance?.reason) }, 429)

  const typedCategories = (categories ?? []) as Category[]
  const typedTransactions = ((transactions ?? []) as Transaction[]).filter((transaction) => transaction.review_status !== 'ignored')
  const typedCommitments = (commitments ?? []) as Commitment[]
  const categoryById = new Map(typedCategories.map((category) => [category.id, category]))
  const isIncome = (transaction: Transaction) => transaction.direction === 'income' || (!transaction.direction && categoryById.get(transaction.category_id ?? '')?.type === 'income')
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()
  const currentExpenses = typedTransactions.filter((transaction) => {
    const date = new Date(`${transaction.occurred_at}T00:00:00`)
    return date.getFullYear() === currentYear && date.getMonth() === currentMonth && !isIncome(transaction)
  })
  const currentIncome = typedTransactions.filter((transaction) => {
    const date = new Date(`${transaction.occurred_at}T00:00:00`)
    return date.getFullYear() === currentYear && date.getMonth() === currentMonth && isIncome(transaction)
  })
  const categorySpending = typedCategories.filter((category) => category.type === 'expense').map((category) => {
    const amounts = typedTransactions.filter((transaction) => transaction.category_id === category.id)
    const current = amounts.filter((transaction) => new Date(`${transaction.occurred_at}T00:00:00`).getMonth() === currentMonth).reduce((sum, transaction) => sum + transaction.amount, 0)
    const previous = amounts.filter((transaction) => new Date(`${transaction.occurred_at}T00:00:00`).getMonth() === (currentMonth + 11) % 12).reduce((sum, transaction) => sum + transaction.amount, 0)
    return { name: category.name, current: rounded(current), previous: rounded(previous) }
  }).filter((category) => category.current > 0 || category.previous > 0).sort((left, right) => right.current - left.current).slice(0, 8)
  const payday = nextPayday(settings.payday_day, today)
  const upcoming = typedCommitments.filter((commitment) => commitment.status === 'active').flatMap((commitment) => {
    const dueDate = nextCommitmentDate(commitment, today)
    return dueDate && dueDate <= payday ? [{ description: commitment.description.slice(0, 80), amount: rounded(commitment.amount), dueDate: isoDate(dueDate) }] : []
  }).sort((left, right) => left.dueDate.localeCompare(right.dueDate)).slice(0, 8)
  const daysUntilPayday = Math.max(1, Math.round((payday.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000))
  const budgetCurrency = (settings.budget_currency ?? 'EUR') as 'EUR' | 'XAF'
  const convert = (amount: number) => rounded(budgetCurrency === displayCurrency ? amount : budgetCurrency === 'EUR' ? amount * euroToXafRate : amount / euroToXafRate)
  const expensesTotal = currentExpenses.reduce((sum, transaction) => sum + transaction.amount, 0)
  const incomeTotal = currentIncome.reduce((sum, transaction) => sum + transaction.amount, 0)
  const projectedCommitments = typedCommitments.reduce((sum, commitment) => sum + monthlyCommitmentAmount(commitment, today), 0)
    const { data: allocations, error: allocationsError } = await neon.from('goal_allocations').select('amount, allocated_at, transaction_id')
    if (allocationsError) return send(response, { error: 'Impossible de charger les données budgétaires.' }, 500)
  const typedAllocations = (allocations ?? []) as Array<{ amount: number; allocated_at: string; transaction_id: string | null }>
    const knownTransactions = new Map(((transactions ?? []) as Transaction[]).map((transaction) => [transaction.id, transaction]))
    const missingIds = [...new Set(typedAllocations.flatMap((allocation) => allocation.transaction_id && !knownTransactions.has(allocation.transaction_id) ? [allocation.transaction_id] : []))]
    if (missingIds.length > 0) {
      const { data: older } = await neon.from('transactions').select('id, amount, occurred_at, category_id, review_status').in('id', missingIds)
      for (const transaction of (older ?? []) as Transaction[]) knownTransactions.set(transaction.id, transaction)
    }
    const allocatedTotal = typedAllocations.reduce((sum, allocation) => {
      const income = allocation.transaction_id ? knownTransactions.get(allocation.transaction_id) : undefined
      if (income?.review_status === 'ignored') return sum
      const date = new Date(`${income?.occurred_at ?? allocation.allocated_at}T00:00:00`)
      return date.getFullYear() === currentYear && date.getMonth() === currentMonth ? sum + allocation.amount : sum
    }, 0)
    const freeRemainder = settings.monthly_income + incomeTotal - expensesTotal - projectedCommitments - allocatedTotal - settings.reserve_amount
  const largestExpenses = [...currentExpenses].sort((left, right) => right.amount - left.amount).slice(0, 5).map((transaction) => ({ date: transaction.occurred_at, description: (transaction.description ?? '').slice(0, 40), amount: convert(transaction.amount) }))
  const snapshot = {
    today: isoDate(today), currency: displayCurrency, daysUntilPayday,
    monthlyIncome: convert(settings.monthly_income), reserve: convert(settings.reserve_amount),
    currentMonthExpenses: convert(expensesTotal),
    currentMonthExtraIncome: convert(incomeTotal),
      allocatedToSavingsGoals: convert(allocatedTotal),
    projectedMonthlyCommitments: convert(projectedCommitments),
    freeRemainder: convert(freeRemainder),
    dailyAllowanceUntilPayday: convert(freeRemainder / daysUntilPayday),
    upcomingCommitmentsBeforePayday: upcoming.map((item) => ({ ...item, amount: convert(item.amount) })),
    largestExpenses,
    categorySpending: categorySpending.map((category) => ({ ...category, current: convert(category.current), previous: convert(category.previous) })),
  }
  const prompt = `Tu es un assistant d analyse de budget personnel en francais. Base-toi exclusivement sur le resume chiffre fourni et reprends ses montants tels quels sans les recalculer: freeRemainder est le reste libre du mois apres reserve, dailyAllowanceUntilPayday le montant disponible par jour jusqu a la paie. Tous les montants sont dans la devise du champ currency; cite cette devise si tu mentionnes un montant. Ne crees et ne modifies jamais de donnees. Ne donne pas de conseil financier professionnel, seulement des pistes budgetaires prudentes. Si freeRemainder est negatif, la situation est en alerte; s il est inferieur a la reserve ou tres serre, a surveiller; sinon saine. Reponds uniquement en JSON sans markdown: {"tone":"good|watch|alert","summary":"phrase factuelle moins de 420 caracteres","risks":["maximum 3 risques concrets"],"anomalies":["maximum 3 depenses ou categories inhabituelles en citant leur libelle, tableau vide si aucune"],"recommendations":["maximum 3 actions concretes et non prescriptives"]}. Ne pretend pas connaitre une information absente. Resume: ${JSON.stringify(snapshot)}`
  try {
    const models = modelChain(geminiModel)
    const { response: geminiResponse, model } = await generateContent(models, geminiKey, JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 1200 } }))
    if (!geminiResponse.ok) {
      const providerResponse = await geminiResponse.text()
      console.error('Gemini budget analysis request failed', { status: geminiResponse.status, providerResponse: providerResponse.slice(0, 1_000) })
      return send(response, { error: geminiFailureMessage(geminiResponse.status) }, 502)
    }
    const body = await geminiResponse.json() as { candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[] }
    const candidate = body.candidates?.[0]
    const text = (candidate?.content?.parts ?? []).filter((part) => !part.thought).map((part) => part.text ?? '').join('')
    if (!text.trim()) {
      console.warn('Gemini returned no analysis text', { model, finishReason: candidate?.finishReason })
      return send(response, { error: 'L’assistant n’a renvoyé aucune analyse.' }, 502)
    }
    const cleaned = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')
    const parsed = (() => {
      try { return JSON.parse(cleaned) } catch {
        const start = cleaned.indexOf('{')
        const end = cleaned.lastIndexOf('}')
        return start >= 0 && end > start ? JSON.parse(cleaned.slice(start, end + 1)) : null
      }
    })()
    const insight = insightFrom(parsed)
    if (!insight) console.error('Gemini budget analysis response did not match the insight schema', { model, finishReason: candidate?.finishReason, response: text.slice(0, 1_000) })
    if (!insight) return send(response, { error: 'La réponse de l’assistant est invalide.' }, 502)
    return send(response, { insight, model, estimatedDailyCostEur: allowance.estimated_cost_eur, costWarning: allowance.estimated_cost_eur >= dailyWarningThresholdEur })
  } catch (error) {
    console.error('Gemini budget analysis response could not be processed', { error: error instanceof Error ? error.message : String(error) })
    return send(response, { error: 'Gemini ne répond pas pour le moment. Réessayez dans quelques instants.' }, 502)
  }
}