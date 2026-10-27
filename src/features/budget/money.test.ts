import { describe, expect, it } from 'vitest'
import { parseAmount } from './money'

describe('parseAmount', () => {
  it('accepts French decimal values and rounds them to cents', () => {
    expect(parseAmount('12,345')).toBe(12.35)
  })

  it('rejects zero, negatives, and invalid amounts', () => {
    expect(parseAmount('0')).toBeNull()
    expect(parseAmount('-3')).toBeNull()
    expect(parseAmount('budget')).toBeNull()
  })
})