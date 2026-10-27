export function parseAmount(value: string) {
  const amount = Number(value.replace(',', '.'))
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null
}

export function formatAmount(amount: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}