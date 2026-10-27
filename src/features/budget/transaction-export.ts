import type { Category, Transaction } from './types'

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`
}

export function transactionsToCsv(transactions: Transaction[], categories: Category[]) {
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]))
  const rows = transactions.map((transaction) => [transaction.occurred_at, transaction.description, transaction.amount.toFixed(2).replace('.', ','), categoryNames.get(transaction.category_id ?? '') ?? ''])
  return ['Date;Libelle;Montant;Categorie', ...rows.map((row) => row.map(csvCell).join(';'))].join('\r\n')
}