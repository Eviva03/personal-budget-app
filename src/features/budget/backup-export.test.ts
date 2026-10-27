import { describe, expect, it } from 'vitest'
import { createBudgetBackup } from './backup-export'

describe('createBudgetBackup', () => {
  it('creates a portable JSON backup', () => {
    expect(JSON.parse(createBudgetBackup({ settings: null, categories: [], transactions: [], commitments: [] }, '2026-10-27T00:00:00.000Z')).exported_at).toBe('2026-10-27T00:00:00.000Z')
  })
})