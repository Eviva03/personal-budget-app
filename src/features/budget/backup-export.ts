import type { BudgetSettings, Category, Commitment, Transaction } from './types'

type BudgetBackup = { exported_at: string; settings: BudgetSettings | null; categories: Category[]; transactions: Transaction[]; commitments: Commitment[] }

export function createBudgetBackup(data: Omit<BudgetBackup, 'exported_at'>, exportedAt = new Date().toISOString()) {
  return JSON.stringify({ exported_at: exportedAt, ...data }, null, 2)
}