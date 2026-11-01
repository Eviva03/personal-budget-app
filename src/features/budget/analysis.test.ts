import { describe, expect, it } from 'vitest'
import { categoryBreakdown, isExpense } from './analysis'
import type { Category, Transaction } from './types'

const category = (id: string, name: string, type: Category['type'] = 'expense'): Category => ({ id, user_id: 'u', name, color: '#123456', type, created_at: '' })
const transaction = (amount: number, occurred_at: string, category_id: string | null, extra: Partial<Transaction> = {}): Transaction => ({ id: `${occurred_at}-${amount}-${category_id}`, user_id: 'u', category_id, amount, description: 'Test', occurred_at, created_at: '', ...extra })

const categories = [category('food', 'Alimentation'), category('car', 'Transport'), category('pay', 'Salaire', 'income')]
const now = new Date(2026, 10, 15)

describe('isExpense', () => {
  const byId = new Map(categories.map((entry) => [entry.id, entry]))
  it('lets an explicit direction win over the category', () => {
    expect(isExpense(transaction(10, '2026-11-02', 'pay', { direction: 'expense' }), byId)).toBe(true)
    expect(isExpense(transaction(10, '2026-11-02', 'food', { direction: 'income' }), byId)).toBe(false)
  })
  it('falls back to the category type and never counts ignored lines', () => {
    expect(isExpense(transaction(10, '2026-11-02', 'pay'), byId)).toBe(false)
    expect(isExpense(transaction(10, '2026-11-02', null), byId)).toBe(true)
    expect(isExpense(transaction(10, '2026-11-02', 'food', { review_status: 'ignored' }), byId)).toBe(false)
  })
})

describe('categoryBreakdown', () => {
  it('groups this month by category, compares with last month and ignores income and older months', () => {
    const rows = categoryBreakdown([
      transaction(30, '2026-11-02', 'food'), transaction(20, '2026-11-09', 'food'), transaction(40, '2026-10-20', 'food'),
      transaction(25, '2026-11-05', 'car'), transaction(2000, '2026-11-01', 'pay'), transaction(99, '2026-09-10', 'car'),
      transaction(5, '2026-11-06', null), transaction(50, '2026-11-07', 'food', { review_status: 'ignored' }),
    ], categories, now)
    expect(rows.map((row) => [row.name, row.current, row.previous])).toEqual([['Alimentation', 50, 40], ['Transport', 25, 0], ['Sans catégorie', 5, 0]])
    expect(rows[0].share).toBeCloseTo(50 / 80)
  })

  it('folds the smallest categories into Autres without losing any amount', () => {
    const many = Array.from({ length: 8 }, (_, index) => category(`c${index}`, `Cat ${index}`))
    const rows = categoryBreakdown(many.map((entry, index) => transaction(100 - index * 10, '2026-11-03', entry.id)), many, now, 4)
    expect(rows).toHaveLength(4)
    expect(rows[3]).toMatchObject({ name: 'Autres', current: 70 + 60 + 50 + 40 + 30 })
    expect(rows.reduce((sum, row) => sum + row.current, 0)).toBe(100 + 90 + 80 + 70 + 60 + 50 + 40 + 30)
  })

  it('returns nothing when there is no spending this month', () => {
    expect(categoryBreakdown([transaction(40, '2026-10-20', 'food')], categories, now)).toEqual([])
  })
})
