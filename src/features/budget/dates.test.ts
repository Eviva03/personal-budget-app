import { describe, expect, it } from 'vitest'
import { addMonthsClamped, todayIso } from './dates'

describe('addMonthsClamped', () => {
  it('clamps to the end of shorter months without drifting', () => {
    const jan31 = new Date(2026, 0, 31)
    expect(todayIso(addMonthsClamped(jan31, 1))).toBe('2026-02-28')
    expect(todayIso(addMonthsClamped(jan31, 2))).toBe('2026-03-31')
    expect(todayIso(addMonthsClamped(new Date(2026, 9, 31), 1))).toBe('2026-11-30')
    expect(todayIso(addMonthsClamped(new Date(2028, 1, 29), 12))).toBe('2029-02-28')
  })
})

describe('todayIso', () => {
  it('uses the local calendar day, not the UTC day', () => {
    expect(todayIso(new Date(2026, 10, 1, 0, 30))).toBe('2026-11-01')
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})
