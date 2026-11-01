import { describe, expect, it } from 'vitest'
import { calculateBudget, isCommitmentFinished } from './budget-engine'
import type { Commitment, GoalAllocation, Transaction } from './types'

const transaction = (amount: number, occurred_at: string): Transaction => ({ id: 't', user_id: 'u', category_id: null, amount, description: 'Test', occurred_at, created_at: '' })
const commitment = (amount: number, frequency: Commitment['frequency'], due_date = '2026-10-10'): Commitment => ({ id: 'c', user_id: 'u', category_id: null, amount, description: 'Test', due_date, frequency, installment_count: null, status: 'active', created_at: '' })

describe('calculateBudget', () => {
  it('calculates realised expenses, normalized commitments, reserve, and free remainder', () => {
    expect(calculateBudget({ monthlyIncome: 2000, reserve: 250, transactions: [transaction(100, '2026-10-02'), transaction(30, '2026-09-30')], commitments: [commitment(24, 'monthly'), commitment(52, 'weekly'), commitment(1200, 'yearly'), commitment(100, 'once')], referenceDate: new Date('2026-10-27') })).toEqual({ monthlyIncome: 2000, additionalIncome: 0, totalIncome: 2000, realisedExpenses: 100, projectedCommitments: 449.33, allocatedToGoals: 0, projectedRemainder: 1450.67, reserve: 250, freeRemainder: 1200.67 })
  })

  it('adds income transactions only to the month in which they occur', () => {
    const incomeCategory = { id: 'income', user_id: 'u', name: 'Revenus ponctuels', color: '#000000', type: 'income' as const, created_at: '' }
    const bonus = { ...transaction(300, '2026-10-18'), id: 'bonus', category_id: incomeCategory.id, description: 'Prime' }
    expect(calculateBudget({ monthlyIncome: 2000, reserve: 250, transactions: [transaction(100, '2026-10-02'), bonus, { ...bonus, id: 'past', occurred_at: '2026-09-18' }], commitments: [], categories: [incomeCategory], referenceDate: new Date('2026-10-27') })).toMatchObject({ additionalIncome: 300, totalIncome: 2300, realisedExpenses: 100, projectedRemainder: 2200, freeRemainder: 1950 })
  })

  it('uses an explicit income direction even before a category is assigned', () => {
    const income = { ...transaction(75, '2026-10-18'), id: 'gift', direction: 'income' as const, description: 'Don' }
    expect(calculateBudget({ monthlyIncome: 2000, reserve: 0, transactions: [income], commitments: [], referenceDate: new Date('2026-10-27') })).toMatchObject({ additionalIncome: 75, realisedExpenses: 0, totalIncome: 2075 })
  })

  it('ignores transactions the user marked as ignored', () => {
    const ignored = { ...transaction(80, '2026-10-05'), id: 'ignored', review_status: 'ignored' as const }
    expect(calculateBudget({ monthlyIncome: 1000, reserve: 0, transactions: [transaction(20, '2026-10-02'), ignored], commitments: [], referenceDate: new Date('2026-10-27') }).realisedExpenses).toBe(20)
  })
  it('reserves allocated income for goals in the month the income was received', () => {
    const bonus = { ...transaction(300, '2026-10-18'), id: 'bonus', direction: 'income' as const }
    const allocation = (overrides: Partial<GoalAllocation>): GoalAllocation => ({ id: 'a', user_id: 'u', goal_id: 'g', transaction_id: 'bonus', amount: 100, allocated_at: '2026-10-19', created_at: '', ...overrides })
    const budget = (allocations: GoalAllocation[], transactions = [bonus]) => calculateBudget({ monthlyIncome: 1000, reserve: 0, transactions, commitments: [], allocations, referenceDate: new Date('2026-10-27') })
    expect(budget([allocation({})])).toMatchObject({ allocatedToGoals: 100, projectedRemainder: 1200, freeRemainder: 1200 })
    expect(budget([allocation({ transaction_id: null })]).allocatedToGoals).toBe(100)
    expect(budget([allocation({ transaction_id: null, allocated_at: '2026-09-19' })]).allocatedToGoals).toBe(0)
    expect(budget([allocation({})], [{ ...bonus, review_status: 'ignored' as const }]).allocatedToGoals).toBe(0)
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

  it('does not count a recurring commitment in months before its first due date', () => {
    const gym = commitment(40, 'monthly', '2027-01-05')
    expect(calculateBudget({ monthlyIncome: 1000, reserve: 0, transactions: [], commitments: [gym], referenceDate: new Date('2026-11-10') }).projectedCommitments).toBe(0)
    expect(calculateBudget({ monthlyIncome: 1000, reserve: 0, transactions: [], commitments: [gym], referenceDate: new Date('2027-01-10') }).projectedCommitments).toBe(40)
  })

  it('keeps an August four-installment plan active through November', () => {
    const phone = { ...commitment(30, 'monthly', '2026-08-28'), installment_count: 4 }
    expect(isCommitmentFinished(phone, new Date('2026-10-28'))).toBe(false)
    expect(calculateBudget({ monthlyIncome: 1000, reserve: 0, transactions: [], commitments: [phone], referenceDate: new Date('2026-10-28') }).projectedCommitments).toBe(30)
    expect(isCommitmentFinished(phone, new Date('2026-12-01'))).toBe(true)
  })
})