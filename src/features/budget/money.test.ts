import { describe, expect, it } from 'vitest'
import { convertAmount, formatAmount, parseAmount } from './money'

describe('parseAmount', () => {
  it('accepts French decimal values and rounds them to cents', () => {
    expect(parseAmount('12,345')).toBe(12.35)
  })

  it('rejects zero, negatives, and invalid amounts', () => {
    expect(parseAmount('0')).toBeNull()
    expect(parseAmount('-3')).toBeNull()
    expect(parseAmount('budget')).toBeNull()
  })

  it('converts between euros and Central African CFA francs at the fixed rate', () => {
    expect(convertAmount(1, 'EUR', 'XAF')).toBe(655.96)
    expect(convertAmount(655.957, 'XAF', 'EUR')).toBe(1)
    expect(convertAmount(2800, 'EUR', 'EUR')).toBe(2800)
  })

  it('formats CFA francs without a decimal fraction', () => {
    expect(formatAmount(1836679.6, 'XAF')).toContain('1\u202f836\u202f680')
  })
})