import type { Commitment, Transaction } from './types'

type EngineInput = {
  monthlyIncome: number
  reserve: number
  transactions: Transaction[]
  commitments: Commitment[]
  referenceDate?: Date
}

export type BudgetSummary = {
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
  const monthDistance = (referenceDate.getFullYear() - firstDueDate.getFullYear()) * 12 + referenceDate.getMonth() - firstDueDate.getMonth()
  return monthDistance >= commitment.installment_count
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

export function calculateBudget({ monthlyIncome, reserve, transactions, commitments, referenceDate = new Date() }: EngineInput): BudgetSummary {
  const realisedExpenses = transactions.filter((transaction) => isInMonth(transaction.occurred_at, referenceDate)).reduce((sum, transaction) => sum + transaction.amount, 0)
  const projectedCommitments = commitments.reduce((sum, commitment) => sum + monthlyCommitmentAmount(commitment, referenceDate), 0)
  const projectedRemainder = monthlyIncome - realisedExpenses - projectedCommitments
  return { realisedExpenses: round(realisedExpenses), projectedCommitments: round(projectedCommitments), projectedRemainder: round(projectedRemainder), reserve: round(reserve), freeRemainder: round(projectedRemainder - reserve) }
}