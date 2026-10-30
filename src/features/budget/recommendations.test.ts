import { describe, expect, it } from 'vitest'
import { getRecommendations } from './recommendations'
import type { BudgetSummary } from './budget-engine'
import type { UpcomingCommitment } from './projection'

const summary = (freeRemainder: number, projectedRemainder = freeRemainder, reserve = 0): BudgetSummary => ({ realisedExpenses: 0, projectedCommitments: 0, projectedRemainder, reserve, freeRemainder })
const upcoming: UpcomingCommitment = { id: 'c', user_id: 'u', category_id: null, amount: 24, description: 'Sport', due_date: '2026-10-28', frequency: 'monthly', status: 'active', created_at: '', nextDueDate: '2026-10-28' }

describe('getRecommendations', () => {
  it('alerts when the projected free remainder is negative', () => expect(getRecommendations(summary(-20), []).at(0)?.level).toBe('alert'))
  it('warns when the reserve is not fully covered', () => expect(getRecommendations(summary(40, 100, 200), []).at(0)?.title).toBe('Reserve exposee'))
  it('explains upcoming payment exposure', () => expect(getRecommendations(summary(300), [upcoming]).at(1)?.message).toContain('24,00 €'))
})