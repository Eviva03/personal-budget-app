import { describe, expect, it } from 'vitest'
import { commitmentsUntilPayday, nextPayday, spendingByDay } from './projection'
import type { Commitment, Transaction } from './types'

const commitment = (frequency: Commitment['frequency'], due_date: string): Commitment => ({ id: frequency, user_id: 'u', category_id: null, amount: 10, description: frequency, due_date, frequency, status: 'active', created_at: '' })
const transaction = (amount: number, occurred_at: string): Transaction => ({ id: occurred_at, user_id: 'u', category_id: null, amount, description: 'test', occurred_at, created_at: '' })

describe('projection helpers', () => {
  it('finds the next payday across a month boundary', () => { const payday = nextPayday(5, new Date('2026-10-27')); expect([payday.getFullYear(), payday.getMonth() + 1, payday.getDate()]).toEqual([2026, 11, 5]) })
  it('keeps only active commitments due before the next payday', () => expect(commitmentsUntilPayday([commitment('monthly', '2026-10-28'), commitment('monthly', '2026-11-10'), commitment('once', '2026-09-10')], 5, new Date('2026-10-27')).map((item) => item.description)).toEqual(['monthly']))
  it('excludes a completed installment plan from the payday projection', () => {
    const phone = { ...commitment('monthly', '2026-08-28'), installment_count: 4 }
    expect(commitmentsUntilPayday([phone], 5, new Date('2026-12-01'))).toEqual([])
  })
  it('groups current-month transactions by day', () => expect(spendingByDay([transaction(10, '2026-10-02'), transaction(5, '2026-10-02'), transaction(9, '2026-09-30')], new Date('2026-10-27'))).toEqual([{ label: '2 oct.', amount: 15 }]))
})