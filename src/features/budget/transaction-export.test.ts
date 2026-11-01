import { describe, expect, it } from 'vitest'
import { parseTransactionsCsv } from './document-import'
import { transactionsToCsv } from './transaction-export'
import type { Category, Transaction } from './types'

const tx = (overrides: Partial<Transaction>): Transaction => ({ id: 't', user_id: 'u', category_id: null, amount: 10, description: 'Test', occurred_at: '2026-10-27', created_at: '', ...overrides })
const incomeCategory: Category = { id: 'inc', user_id: 'u', name: 'Revenus', color: '#000000', type: 'income', created_at: '' }

describe('transactionsToCsv', () => {
  it('escapes quotes in descriptions', () => {
    expect(transactionsToCsv([tx({ category_id: 'food', amount: 24.5, description: 'Courses "bio"' })], [{ id: 'food', user_id: 'u', name: 'Alimentation', color: '#000000', type: 'expense', created_at: '' }])).toContain('"Courses ""bio"""')
  })

  it('tells incomes from expenses and survives a re-import', () => {
    const csv = transactionsToCsv([tx({ description: 'Salaire', amount: 2100, direction: 'income' }), tx({ description: 'Prime', amount: 300, category_id: 'inc' }), tx({ description: 'Courses', amount: 24.5 })], [incomeCategory])
    expect(csv.split('\r\n')[0]).toBe('Date;Libelle;Montant;Categorie;Sens')
    expect(csv).toContain('"Revenu"')
    const { valid, errors } = parseTransactionsCsv(csv)
    expect(errors).toEqual([])
    expect(valid.map((row) => [row.description, row.amount, row.direction ?? 'expense'])).toEqual([['Salaire', 2100, 'income'], ['Prime', 300, 'income'], ['Courses', 24.5, 'expense']])
  })
})
