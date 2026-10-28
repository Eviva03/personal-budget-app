import { describe, expect, it } from 'vitest'
import { calculateBudget } from './budget-engine'
import type { Commitment, Transaction } from './types'

const transaction = (amount: number, occurred_at: string): Transaction => ({ id: 't', user_id: 'u', category_id: null, amount, description: 'Test', occurred_at, created_at: '' })
const commitment = (amount: number, frequency: Commitment['frequency'], due_date = '2026-10-10'): Commitment => ({ id: 'c', user_id: 'u', category_id: null, amount, description: 'Test', due_date, frequency, installment_count: null, status: 'active', created_at: '' })

describe('calculateBudget', () => {
  it('calculates realised expenses, normalized commitments, reserve, and free remainder', () => {
    expect(calculateBudget({ monthlyIncome: 2000, reserve: 250, transactions: [transaction(100, '2026-10-02'), transaction(30, '2026-09-30')], commitments: [commitment(24, 'monthly'), commitment(52, 'weekly'), commitment(1200, 'yearly'), commitment(100, 'once')], referenceDate: new Date('2026-10-27') })).toEqual({ realisedExpenses: 100, projectedCommitments: 449.33, projectedRemainder: 1450.67, reserve: 250, freeRemainder: 1200.67 })
  })

  it('excludes paused and past one-off commitments', () => {
    const paused = { ...commitment(90, 'monthly'), status: 'paused' as const }
    expect(calculateBudget({ monthlyIncome: 500, reserve: 0, transactions: [], commitments: [paused, commitment(50, 'once', '2026-09-10')], referenceDate: new Date('2026-10-27') }).projectedCommitments).toBe(0)
  })

  it('includes a finite monthly installment only during its planned months', () => {
    const installment = { ...commitment(100, 'monthly', '2026-11-05'), installment_count: 3 }
    expect(calculateBudget({ monthlyIncome: 1000, reserve: 0, transactions: [], commitments: [installment], referenceDate: new Date('2026-12-10') }).projectedCommitments).toBe(100)
    expect(calculateBudget({ monthlyIncome: 1000, reserve: 0, transactions: [], commitments: [installment], referenceDate: new Date('2027-02-10') }).projectedCommitments).toBe(0)
  })
})