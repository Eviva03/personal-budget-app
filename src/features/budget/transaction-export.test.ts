import { describe, expect, it } from 'vitest'
import { transactionsToCsv } from './transaction-export'

describe('transactionsToCsv', () => {
  it('exports French CSV columns and escapes labels', () => {
    expect(transactionsToCsv([{ id: 't', user_id: 'u', category_id: 'food', amount: 24.5, description: 'Courses "bio"', occurred_at: '2026-10-27', created_at: '' }], [{ id: 'food', user_id: 'u', name: 'Alimentation', color: '#000000', type: 'expense', created_at: '' }])).toContain('"Courses ""bio"""')
  })
})