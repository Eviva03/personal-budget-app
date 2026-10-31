import { describe, expect, it } from 'vitest'
import { merchantRuleFor } from './merchant-rules'

describe('merchantRuleFor', () => {
  it('matches accents and casing in an imported description', () => {
    expect(merchantRuleFor({ description: 'PAIEMENT Carrefour City', amount: 12, occurred_at: '2026-10-30', category_id: null }, [{ id: 'rule', user_id: 'user', pattern: 'carrefour', category_id: 'groceries', direction: 'expense', created_at: '' }])?.category_id).toBe('groceries')
  })
})