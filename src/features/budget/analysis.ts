import type { Category, Transaction } from './types'

export type CategorySpend = { id: string | null; name: string; color: string; current: number; previous: number; share: number }

const othersId = '__others'

function monthIndex(date: string) {
  const parsed = new Date(`${date}T00:00:00`)
  return parsed.getFullYear() * 12 + parsed.getMonth()
}

function round(amount: number) {
  return Math.round(amount * 100) / 100
}

// Same rule everywhere: an explicit direction wins, otherwise the category type decides; ignored lines never count.
export function isExpense(transaction: Transaction, categoriesById: Map<string, Category>) {
  if (transaction.review_status === 'ignored') return false
  if (transaction.direction) return transaction.direction !== 'income'
  return categoriesById.get(transaction.category_id ?? '')?.type !== 'income'
}

// Spending of the reference month per category, with the previous month alongside; the smallest rows are folded into "Autres".
export function categoryBreakdown(transactions: Transaction[], categories: Category[], referenceDate = new Date(), limit = 6): CategorySpend[] {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const currentMonth = referenceDate.getFullYear() * 12 + referenceDate.getMonth()
  const totals = new Map<string | null, { current: number; previous: number }>()

  for (const transaction of transactions) {
    if (!isExpense(transaction, byId)) continue
    const month = monthIndex(transaction.occurred_at)
    if (month !== currentMonth && month !== currentMonth - 1) continue
    const key = transaction.category_id && byId.has(transaction.category_id) ? transaction.category_id : null
    const entry = totals.get(key) ?? { current: 0, previous: 0 }
    if (month === currentMonth) entry.current += transaction.amount
    else entry.previous += transaction.amount
    totals.set(key, entry)
  }

  const totalCurrent = [...totals.values()].reduce((sum, entry) => sum + entry.current, 0)
  const rows = [...totals.entries()]
    .map(([id, entry]): CategorySpend => {
      const category = id ? byId.get(id) : undefined
      return { id, name: category?.name ?? 'Sans catégorie', color: category?.color ?? '#94a3b8', current: round(entry.current), previous: round(entry.previous), share: totalCurrent > 0 ? entry.current / totalCurrent : 0 }
    })
    .filter((row) => row.current > 0)
    .sort((left, right) => right.current - left.current)

  if (rows.length <= limit) return rows
  const rest = rows.slice(limit - 1)
  return [
    ...rows.slice(0, limit - 1),
    { id: othersId, name: 'Autres', color: '#94a3b8', current: round(rest.reduce((sum, row) => sum + row.current, 0)), previous: round(rest.reduce((sum, row) => sum + row.previous, 0)), share: rest.reduce((sum, row) => sum + row.share, 0) },
  ]
}
