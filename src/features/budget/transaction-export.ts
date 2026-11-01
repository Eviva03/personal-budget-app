import type { Category, Transaction } from './types'

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`
}

export function transactionsToCsv(transactions: Transaction[], categories: Category[]) {
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]))
  const categoryTypes = new Map(categories.map((category) => [category.id, category.type]))
  // Same rule as the budget: an explicit direction wins, otherwise the category type decides.
  const sens = (transaction: Transaction) => (transaction.direction ?? (categoryTypes.get(transaction.category_id ?? '') === 'income' ? 'income' : 'expense')) === 'income' ? 'Revenu' : 'Depense'
  const rows = transactions.map((transaction) => [transaction.occurred_at, transaction.description, transaction.amount.toFixed(2).replace('.', ','), categoryNames.get(transaction.category_id ?? '') ?? '', sens(transaction)])
  return ['Date;Libelle;Montant;Categorie;Sens', ...rows.map((row) => row.map(csvCell).join(';'))].join('\r\n')
}