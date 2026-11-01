import { describe, expect, it } from 'vitest'
import { createBudgetBackup } from './backup-export'

describe('createBudgetBackup', () => {
  it('creates a portable JSON backup', () => {
    expect(JSON.parse(createBudgetBackup({ settings: null, categories: [], transactions: [], commitments: [] }, '2026-10-27T00:00:00.000Z')).exported_at).toBe('2026-10-27T00:00:00.000Z')
  })

  it('includes savings goals and their allocations', () => {
    const goal = { id: 'g', user_id: 'u', name: 'Voyage', target_amount: 1000, target_date: null, created_at: '' }
    const allocation = { id: 'a', user_id: 'u', goal_id: 'g', transaction_id: null, amount: 50, allocated_at: '2026-10-27', created_at: '' }
    const backup = JSON.parse(createBudgetBackup({ settings: null, categories: [], transactions: [], commitments: [], goals: [goal], goal_allocations: [allocation] }))
    expect(backup.goals).toEqual([goal])
    expect(backup.goal_allocations).toEqual([allocation])
    expect(JSON.parse(createBudgetBackup({ settings: null, categories: [], transactions: [], commitments: [] })).goals).toEqual([])
  })
})
