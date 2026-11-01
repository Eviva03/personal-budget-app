import type { BudgetSettings, Category, Commitment, GoalAllocation, SavingsGoal, Transaction } from './types'

type BudgetBackup = { exported_at: string; settings: BudgetSettings | null; categories: Category[]; transactions: Transaction[]; commitments: Commitment[]; goals: SavingsGoal[]; goal_allocations: GoalAllocation[] }

export function createBudgetBackup(data: Omit<BudgetBackup, 'exported_at' | 'goals' | 'goal_allocations'> & Partial<Pick<BudgetBackup, 'goals' | 'goal_allocations'>>, exportedAt = new Date().toISOString()) {
  return JSON.stringify({ exported_at: exportedAt, goals: [], goal_allocations: [], ...data }, null, 2)
}