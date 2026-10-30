import { createAuthenticatedNeonClient, hasAuthenticatedUser } from './neon.js'

type ApiRequest = { method?: string; headers: { authorization?: string | string[] | undefined } }
type ApiResponse = { status: (status: number) => ApiResponse; json: (body: unknown) => void }
type Insight = { summary: string; risks: string[]; anomalies: string[]; recommendations: string[] }
type Category = { id: string; name: string; type: 'income' | 'expense' }
type Transaction = { amount: number; occurred_at: string; category_id: string | null }
type Commitment = { amount: number; description: string; due_date: string; frequency: 'once' | 'weekly' | 'monthly' | 'yearly'; status: 'active' | 'paused' | 'completed' }

function send(response: ApiResponse, body: unknown, status = 200) {
  response.status(status).json(body)
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function rounded(amount: number) {
  return Math.round(amount * 100) / 100
}

function nextPayday(paydayDay: number, today: Date) {
  const payday = new Date(today.getFullYear(), today.getMonth(), paydayDay)
  if (payday < today) payday.setMonth(payday.getMonth() + 1)
  return payday
}

function nextCommitmentDate(commitment: Commitment, today: Date) {
  const date = new Date(`${commitment.due_date}T00:00:00`)
  if (commitment.frequency === 'once') return date >= today ? date : null
  if (commitment.frequency === 'weekly') while (date < today) date.setDate(date.getDate() + 7)
  if (commitment.frequency === 'monthly') while (date < today) date.setMonth(date.getMonth() + 1)
  if (commitment.frequency === 'yearly') while (date < today) date.setFullYear(date.getFullYear() + 1)
  return date
}

function isInsightList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 3 && value.every((item) => typeof item === 'string' && item.length > 0 && item.length <= 220)
}

function insightFrom(value: unknown): Insight | null {
  if (!value || typeof value !== 'object') return null
  const insight = value as Partial<Insight>
  const risks = insight.risks ?? []
  const anomalies = insight.anomalies ?? []
  const recommendations = insight.recommendations ?? []
  if (typeof insight.summary !== 'string' || insight.summary.length === 0 || insight.summary.length > 420 || !isInsightList(risks) || !isInsightList(anomalies) || !isInsightList(recommendations)) return null
  return { summary: insight.summary, risks, anomalies, recommendations }
}

function geminiFailureMessage(status: number) {
  if (status === 400 || status === 404) return 'Le modele Gemini configure est indisponible.'
  if (status === 401 || status === 403) return 'La cle Gemini ne peut pas utiliser le modele configure.'
  if (status === 429) return 'Gemini limite temporairement les analyses. Reessayez dans quelques minutes.'
  return 'Gemini est indisponible pour le moment. Reessayez plus tard.'
}

async function generateAnalysis(url: string, body: string) {
  let geminiResponse: Response | undefined
  for (let attempt = 0; attempt < 3; attempt += 1) {
    geminiResponse = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body })
    if (geminiResponse.ok || (geminiResponse.status !== 429 && geminiResponse.status !== 503) || attempt === 2) return geminiResponse
    await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)))
  }
  throw new Error('Gemini did not return a response.')
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') return send(response, { error: 'Method not allowed.' }, 405)
  const geminiKey = process.env.GEMINI_API_KEY
  const geminiModel = process.env.GEMINI_MODEL
  const authorization = request.headers.authorization
  const token = (Array.isArray(authorization) ? authorization[0] : authorization)?.replace(/^Bearer\s+/i, '')
  if (!geminiKey || !geminiModel) return send(response, { error: 'L assistant n est pas configure.' }, 503)
  if (!token) return send(response, { error: 'Authentification requise.' }, 401)

  const neon = createAuthenticatedNeonClient(token)
  if (!neon) return send(response, { error: 'L assistant n est pas configure.' }, 503)
  if (!await hasAuthenticatedUser(neon)) return send(response, { error: 'Session invalide.' }, 401)

  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const [{ data: settings, error: settingsError }, { data: categories, error: categoriesError }, { data: transactions, error: transactionsError }, { data: commitments, error: commitmentsError }] = await Promise.all([
    neon.from('budget_settings').select('monthly_income, reserve_amount, payday_day').maybeSingle(),
    neon.from('categories').select('id, name, type'),
    neon.from('transactions').select('amount, occurred_at, category_id').gte('occurred_at', isoDate(monthStart)),
    neon.from('commitments').select('amount, description, due_date, frequency, status'),
  ])
  if (settingsError || categoriesError || transactionsError || commitmentsError) return send(response, { error: 'Impossible de charger les donnees budgetaires.' }, 500)
  if (!settings) return send(response, { error: 'Configurez votre budget avant cette analyse.' }, 400)

  const { data: allowance, error: allowanceError } = await neon.rpc('consume_ai_import_quota')
  if (allowanceError) return send(response, { error: 'Impossible de verifier le quota assistant.' }, 500)
  if (!allowance?.allowed) return send(response, { error: allowance?.reason === 'global_limit' ? 'Le budget mensuel de l assistant est atteint.' : 'Votre quota mensuel assistant est atteint.' }, 429)

  const typedCategories = (categories ?? []) as Category[]
  const typedTransactions = (transactions ?? []) as Transaction[]
  const typedCommitments = (commitments ?? []) as Commitment[]
  const categoryById = new Map(typedCategories.map((category) => [category.id, category]))
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()
  const currentExpenses = typedTransactions.filter((transaction) => {
    const date = new Date(`${transaction.occurred_at}T00:00:00`)
    return date.getFullYear() === currentYear && date.getMonth() === currentMonth && categoryById.get(transaction.category_id ?? '')?.type !== 'income'
  })
  const currentIncome = typedTransactions.filter((transaction) => {
    const date = new Date(`${transaction.occurred_at}T00:00:00`)
    return date.getFullYear() === currentYear && date.getMonth() === currentMonth && categoryById.get(transaction.category_id ?? '')?.type === 'income'
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
  const daysUntilPayday = Math.max(0, Math.ceil((payday.getTime() - today.getTime()) / 86_400_000))
  const snapshot = {
    today: isoDate(today), daysUntilPayday, monthlyIncome: settings.monthly_income, reserve: settings.reserve_amount,
    currentMonthExpenses: rounded(currentExpenses.reduce((sum, transaction) => sum + transaction.amount, 0)),
    currentMonthIncome: rounded(currentIncome.reduce((sum, transaction) => sum + transaction.amount, 0)),
    upcomingCommitments: upcoming, categorySpending,
  }
  const prompt = `Tu es un assistant d analyse de budget personnel en francais. Base-toi exclusivement sur le resume chiffre fourni. Ne crees et ne modifies jamais de donnees. Ne donne pas de conseil financier professionnel, seulement des pistes budgetaires prudentes. Reponds uniquement en JSON sans markdown: {"summary":"phrase factuelle moins de 420 caracteres","risks":["maximum 3 risques concrets"],"anomalies":["maximum 3 depenses ou categories inhabituelles, tableau vide si aucune"],"recommendations":["maximum 3 actions concretes et non prescriptives"]}. Ne pretend pas connaitre une information absente. Resume: ${JSON.stringify(snapshot)}`
  try {
    const geminiResponse = await generateAnalysis(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(geminiKey)}`, JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 700 } }))
    if (!geminiResponse.ok) {
      const providerResponse = await geminiResponse.text()
      console.error('Gemini budget analysis request failed', { status: geminiResponse.status, providerResponse: providerResponse.slice(0, 1_000) })
      return send(response, { error: geminiFailureMessage(geminiResponse.status) }, 502)
    }
    const body = await geminiResponse.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return send(response, { error: 'L assistant n a renvoye aucune analyse.' }, 502)
    const parsed = JSON.parse(text.trim().replace(/^```json\s*|\s*```$/g, ''))
    const insight = insightFrom(parsed)
    if (!insight) console.error('Gemini budget analysis response did not match the insight schema', { response: text.slice(0, 1_000) })
    if (!insight) return send(response, { error: 'La reponse de l assistant est invalide.' }, 502)
    return send(response, { insight, estimatedMonthlyCostEur: allowance.estimated_cost_eur, costWarning: allowance.estimated_cost_eur >= 3 })
  } catch (error) {
    console.error('Gemini budget analysis response could not be processed', { error: error instanceof Error ? error.message : String(error) })
    return send(response, { error: 'La reponse de l assistant est invalide.' }, 502)
  }
}