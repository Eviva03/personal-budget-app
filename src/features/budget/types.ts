import type { BudgetCurrency } from './money'

export type CategoryType = 'income' | 'expense'
export type TransactionDirection = 'income' | 'expense'
export type TransactionReviewStatus = 'confirmed' | 'needs_review' | 'ignored'
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
  direction?: TransactionDirection
  review_status?: TransactionReviewStatus
  source?: 'manual' | 'import' | 'assistant'
  merchant_name?: string | null
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

export type NewTransaction = Pick<Transaction, 'amount' | 'description' | 'occurred_at' | 'category_id'> & Partial<Pick<Transaction, 'direction' | 'review_status' | 'source' | 'merchant_name'>>
export type NewCommitment = Pick<Commitment, 'amount' | 'description' | 'due_date' | 'frequency' | 'installment_count' | 'category_id'>

export type SavingsGoal = {
  id: string
  user_id: string
  name: string
  target_amount: number
  target_date: string | null
  created_at: string
}

export type GoalAllocation = {
  id: string
  user_id: string
  goal_id: string
  transaction_id: string | null
  amount: number
  allocated_at: string
  created_at: string
}

export type BudgetSettings = {
  user_id: string
  monthly_income: number
  reserve_amount: number
  payday_day: number
  budget_currency: BudgetCurrency
  display_currency: BudgetCurrency
  updated_at: string
}

export type MerchantRule = {
  id: string
  user_id: string
  pattern: string
  category_id: string | null
  direction: TransactionDirection
  created_at: string
}

export type ImportJournalStatus = 'proposed' | 'imported' | 'partial' | 'failed' | 'dismissed'
export type ImportDocumentType = 'csv' | 'pdf' | 'image' | 'receipt' | 'invoice' | 'bank_statement' | 'unknown'

export type ImportJournalEntry = {
  id: string
  user_id: string
  file_name: string
  document_type: ImportDocumentType
  source: 'local' | 'assistant'
  status: ImportJournalStatus
  detected_count: number
  imported_count: number
  message: string | null
  created_at: string
  updated_at: string
}