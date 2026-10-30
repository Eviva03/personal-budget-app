export type BudgetCurrency = 'EUR' | 'XAF'

export const euroToXafRate = 655.957

export function parseAmount(value: string) {
  const amount = Number(value.replace(',', '.'))
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null
}

export function convertAmount(amount: number, fromCurrency: BudgetCurrency, toCurrency: BudgetCurrency) {
  if (fromCurrency === toCurrency) return amount
  const converted = fromCurrency === 'EUR' ? amount * euroToXafRate : amount / euroToXafRate
  return Math.round(converted * 100) / 100
}

export function formatAmount(amount: number, currency: BudgetCurrency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'XAF' ? 0 : 2,
  }).format(amount)
}