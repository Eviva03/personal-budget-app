import type { MerchantRule, NewTransaction } from './types'

function normalized(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

export function merchantRuleFor(transaction: NewTransaction, rules: MerchantRule[]) {
  const description = normalized(transaction.description)
  return rules.find((rule) => description.includes(normalized(rule.pattern))) ?? null
}