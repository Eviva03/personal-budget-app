import type { Commitment, Transaction } from './types'

export type UpcomingCommitment = Commitment & { nextDueDate: string }
export type SpendingPoint = { label: string; amount: number }

function localDate(value: string) { return new Date(`${value}T00:00:00`) }
function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }

export function nextPayday(paydayDay: number, referenceDate = new Date()) {
  const candidate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), paydayDay)
  if (candidate < new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate())) candidate.setMonth(candidate.getMonth() + 1)
  return candidate
}

function nextOccurrence(commitment: Commitment, referenceDate: Date) {
  const due = localDate(commitment.due_date)
  if (commitment.frequency === 'once') return due >= referenceDate ? due : null
  const next = new Date(due)
  while (next < referenceDate) {
    if (commitment.frequency === 'weekly') next.setDate(next.getDate() + 7)
    if (commitment.frequency === 'monthly') next.setMonth(next.getMonth() + 1)
    if (commitment.frequency === 'yearly') next.setFullYear(next.getFullYear() + 1)
  }
  return next
}

export function commitmentsUntilPayday(commitments: Commitment[], paydayDay: number, referenceDate = new Date()): UpcomingCommitment[] {
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate())
  const payday = nextPayday(paydayDay, today)
  return commitments.filter((commitment) => commitment.status === 'active').map((commitment) => ({ commitment, due: nextOccurrence(commitment, today) })).filter((item): item is { commitment: Commitment; due: Date } => item.due !== null && item.due <= payday).sort((left, right) => left.due.getTime() - right.due.getTime()).map(({ commitment, due }) => ({ ...commitment, nextDueDate: dateKey(due) }))
}

export function spendingByDay(transactions: Transaction[], referenceDate = new Date()): SpendingPoint[] {
  const year = referenceDate.getFullYear(); const month = referenceDate.getMonth()
  const grouped = new Map<string, number>()
  transactions.filter((transaction) => { const date = localDate(transaction.occurred_at); return date.getFullYear() === year && date.getMonth() === month }).forEach((transaction) => grouped.set(transaction.occurred_at, (grouped.get(transaction.occurred_at) ?? 0) + transaction.amount))
  return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, amount]) => ({ label: new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(localDate(date)), amount }))
}