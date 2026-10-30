import type { BudgetCurrency } from './money'

export type CategoryType = 'income' | 'expense'
export type CategoryIconName = 'banknote' | 'bus' | 'credit-card' | 'dumbbell' | 'house' | 'shopping-bag' | 'smartphone' | 'tag' | 'utensils'
export type CommitmentFrequency = 'once' | 'weekly' | 'monthly' | 'yearly'
export type CommitmentStatus = 'active' | 'paused' | 'completed'

export type Category = {
  id: string
  user_id: string
  name: string
  color: string
  icon?: CategoryIconName
  type: CategoryType
  created_at: string
}

export type Transaction = {
  id: string
  user_id: string
  category_id: string | null
  amount: number
  description: string
  occurred_at: string
  created_at: string
  category?: Pick<Category, 'name' | 'color' | 'type'> | null
}

export type Commitment = {
  id: string
  user_id: string
  category_id: string | null
  amount: number
  description: string
  due_date: string
  frequency: CommitmentFrequency
  installment_count?: number | null
  status: CommitmentStatus
  created_at: string
  category?: Pick<Category, 'name' | 'color' | 'type'> | null
}

export type NewTransaction = Pick<Transaction, 'amount' | 'description' | 'occurred_at' | 'category_id'>
export type NewCommitment = Pick<Commitment, 'amount' | 'description' | 'due_date' | 'frequency' | 'installment_count' | 'category_id'>

export type BudgetSettings = {
  user_id: string
  monthly_income: number
  reserve_amount: number
  payday_day: number
  budget_currency: BudgetCurrency
  display_currency: BudgetCurrency
  updated_at: string
}