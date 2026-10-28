import { suggestCategoryId } from './document-import'
import type { Category, NewTransaction, Transaction } from './types'

export type SuggestionConfidence = 'high' | 'medium' | 'low'
export type Recurrence = 'weekly' | 'monthly' | 'yearly'

export type ImportSuggestion = {
  categoryId: string | null
  confidence: SuggestionConfidence | null
  reason: string | null
  recurrence: Recurrence | null
  installmentCount: number | null
}

function normalized(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(?:cb|carte|paiement|achat)\b/g, '')
    .replace(/\d+/g, '')
    .replace(/[^a-z]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function mode(values: string[]) {
  const counts = new Map<string, number>()
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1))
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null
}

function recurrenceFor(transactions: Transaction[], merchant: string): Recurrence | null {
  const dates = transactions
    .filter((transaction) => normalized(transaction.description) === merchant)
    .map((transaction) => new Date(`${transaction.occurred_at}T00:00:00`).getTime())
    .sort((left, right) => left - right)

  if (dates.length < 2) return null
  const intervals = dates.slice(1).map((date, index) => Math.round((date - dates[index]) / 86_400_000))
  const average = intervals.reduce((total, interval) => total + interval, 0) / intervals.length
  if (average >= 5 && average <= 10) return 'weekly'
  if (average >= 20 && average <= 40) return 'monthly'
  if (average >= 330 && average <= 400) return 'yearly'
  return null
}

function installmentCountFor(description: string) {
  const match = description.match(/(?:mensualite|mensualité|echeance|échéance)?\s*\d{1,2}\s*(?:\/|sur)\s*(\d{1,2})/i)
  const count = Number(match?.[1])
  return Number.isInteger(count) && count >= 2 ? count : null
}

export function suggestImport(transaction: NewTransaction, categories: Category[], history: Transaction[]): ImportSuggestion {
  const merchant = normalized(transaction.description)
  const matchingHistory = history.filter((item) => item.category_id && normalized(item.description) === merchant)
  const matchingCategory = mode(matchingHistory.map((item) => item.category_id as string))
  const occurrences = matchingHistory.filter((item) => item.category_id === matchingCategory).length
  const keywordCategory = suggestCategoryId(transaction.description, categories)
  const recurrence = recurrenceFor(history, merchant)
  const installmentCount = installmentCountFor(transaction.description)

  if (matchingCategory) {
    return {
      categoryId: matchingCategory,
      confidence: occurrences >= 2 ? 'high' : 'medium',
      reason: occurrences >= 2 ? `Categorie retenue ${occurrences} fois pour ce libelle.` : 'Categorie retenue lors d un import precedent.',
      recurrence,
      installmentCount,
    }
  }

  if (keywordCategory) {
    return {
      categoryId: keywordCategory,
      confidence: 'low',
      reason: 'Categorie suggeree a partir du libelle.',
      recurrence,
      installmentCount,
    }
  }

  return { categoryId: null, confidence: null, reason: null, recurrence, installmentCount }
}