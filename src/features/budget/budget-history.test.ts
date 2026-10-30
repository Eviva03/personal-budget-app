import { describe, expect, it } from 'vitest'
import { budgetHistory } from './budget-history'

describe('budgetHistory', () => {
  it('creates a current and previous monthly view', () => {
    const history = budgetHistory({ user_id: 'u', monthly_income: 1000, reserve_amount: 100, payday_day: 1, budget_currency: 'EUR', display_currency: 'EUR', updated_at: '' }, [{ id: 't', user_id: 'u', category_id: null, amount: 25, description: 'Courses', occurred_at: '2026-10-10', created_at: '' }], [], 2, new Date(2026, 9, 27))
    expect(history.map((entry) => entry.month)).toEqual(['2026-10', '2026-09'])
    expect(history[0].realisedExpenses).toBe(25)
  })
})