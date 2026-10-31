import type { Category, Commitment, Transaction } from './types'

type EngineInput = {
  monthlyIncome: number
  reserve: number
  transactions: Transaction[]
  commitments: Commitment[]
  categories?: Category[]
  referenceDate?: Date
}

export type BudgetSummary = {
  monthlyIncome: number
  additionalIncome: number
  totalIncome: number
  realisedExpenses: number
  projectedCommitments: number
  projectedRemainder: number
  reserve: number
  freeRemainder: number
}

function isInMonth(dateValue: string, referenceDate: Date) {
  const date = new Date(`${dateValue}T00:00:00`)
  return date.getFullYear() === referenceDate.getFullYear() && date.getMonth() === referenceDate.getMonth()
}

export function isCommitmentDueInMonth(commitment: Commitment, referenceDate: Date) {
  if (commitment.frequency !== 'monthly' || !commitment.installment_count) return true
  const firstDueDate = new Date(`${commitment.due_date}T00:00:00`)
  const monthDistance = (referenceDate.getFullYear() - firstDueDate.getFullYear()) * 12 + referenceDate.getMonth() - firstDueDate.getMonth()
  return monthDistance >= 0 && monthDistance < commitment.installment_count
}

export function isCommitmentFinished(commitment: Commitment, referenceDate = new Date()) {
  if (commitment.frequency !== 'monthly' || !commitment.installment_count) return false
  const firstDueDate = new Date(`${commitment.due_date}T00:00:00`)
  const finalDueDate = new Date(firstDueDate)
  finalDueDate.setMonth(finalDueDate.getMonth() + commitment.installment_count - 1)
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate())
  return today > finalDueDate
}

function monthlyCommitmentAmount(commitment: Commitment, referenceDate: Date) {
  if (commitment.status !== 'active') return 0
  if (!isCommitmentDueInMonth(commitment, referenceDate)) return 0
  if (commitment.frequency === 'weekly') return commitment.amount * 52 / 12
  if (commitment.frequency === 'monthly') return commitment.amount
  if (commitment.frequency === 'yearly') return commitment.amount / 12
  return isInMonth(commitment.due_date, referenceDate) ? commitment.amount : 0
}

function round(amount: number) { return Math.round(amount * 100) / 100 }

export function calculateBudget({ monthlyIncome, reserve, transactions, commitments, categories = [], referenceDate = new Date() }: EngineInput): BudgetSummary {
  const incomeCategoryIds = new Set(categories.filter((category) => category.type === 'income').map((category) => category.id))
  const monthlyTransactions = transactions.filter((transaction) => isInMonth(transaction.occurred_at, referenceDate))
  const isIncome = (transaction: Transaction) => transaction.direction === 'income' || (!transaction.direction && incomeCategoryIds.has(transaction.category_id ?? ''))
  const additionalIncome = monthlyTransactions.filter(isIncome).reduce((sum, transaction) => sum + transaction.amount, 0)
  const realisedExpenses = monthlyTransactions.filter((transaction) => !isIncome(transaction)).reduce((sum, transaction) => sum + transaction.amount, 0)
  const projectedCommitments = commitments.reduce((sum, commitment) => sum + monthlyCommitmentAmount(commitment, referenceDate), 0)
  const totalIncome = monthlyIncome + additionalIncome
  const projectedRemainder = totalIncome - realisedExpenses - projectedCommitments
  return { monthlyIncome: round(monthlyIncome), additionalIncome: round(additionalIncome), totalIncome: round(totalIncome), realisedExpenses: round(realisedExpenses), projectedCommitments: round(projectedCommitments), projectedRemainder: round(projectedRemainder), reserve: round(reserve), freeRemainder: round(projectedRemainder - reserve) }
}