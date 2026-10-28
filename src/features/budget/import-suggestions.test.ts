import { describe, expect, it } from 'vitest'
import { suggestImport } from './import-suggestions'
import type { Category, Transaction } from './types'

const categories: Category[] = [
  { id: 'food', user_id: 'user', name: 'Alimentation', color: '#000000', type: 'expense', created_at: '' },
  { id: 'transport', user_id: 'user', name: 'Transport', color: '#000000', type: 'expense', created_at: '' },
]

function transaction(overrides: Partial<Transaction>): Transaction {
  return { id: 'transaction', user_id: 'user', category_id: null, amount: 20, description: 'Example', occurred_at: '2026-01-01', created_at: '', ...overrides }
}

describe('suggestImport', () => {
  it('uses the category previously selected by the user for the same merchant', () => {
    const history = [
      transaction({ id: 'one', description: 'CB CARREFOUR CITY 1234', category_id: 'food' }),
      transaction({ id: 'two', description: 'Carrefour City 5678', category_id: 'food' }),
    ]

    expect(suggestImport({ description: 'CARREFOUR CITY 9876', occurred_at: '2026-03-01', amount: 25, category_id: null }, categories, history)).toMatchObject({ categoryId: 'food', confidence: 'high' })
  })

  it('detects a monthly recurring merchant from its transaction dates', () => {
    const history = [
      transaction({ id: 'one', description: 'NETFLIX', occurred_at: '2026-01-05' }),
      transaction({ id: 'two', description: 'NETFLIX', occurred_at: '2026-02-05' }),
    ]

    expect(suggestImport({ description: 'Netflix', occurred_at: '2026-03-05', amount: 14, category_id: null }, categories, history).recurrence).toBe('monthly')
  })

  it('detects an explicit installment count in a label', () => {
    expect(suggestImport({ description: 'Mensualite 3/12 - ordinateur', occurred_at: '2026-03-05', amount: 60, category_id: null }, categories, []).installmentCount).toBe(12)
  })
})