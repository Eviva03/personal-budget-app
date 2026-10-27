import { calculateBudget, type BudgetSummary } from './budget-engine'
import type { BudgetSettings, Commitment, Transaction } from './types'

export type MonthlyBudgetHistory = BudgetSummary & { month: string }

export function budgetHistory(settings: BudgetSettings, transactions: Transaction[], commitments: Commitment[], months = 6, referenceDate = new Date()): MonthlyBudgetHistory[] {
  return Array.from({ length: months }, (_, index) => {
    const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - index, 1)
    const summary = calculateBudget({ monthlyIncome: settings.monthly_income, reserve: settings.reserve_amount, transactions, commitments, referenceDate: date })
    return { month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, ...summary }
  })
}