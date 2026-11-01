import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteCommitment, deleteTransaction, listCommitments, listTransactions } from './budget-repository'
import { deletionDelayMs, pendingDeletions } from './pending-deletions'

const database = vi.hoisted(() => ({
  rows: [{ id: 'record', user_id: 'user', description: 'Test' }],
  deletes: vi.fn(),
  error: null as null | Error,
}))

vi.mock('../../lib/neon', () => ({
  neon: {
    from: () => ({
      select: () => ({ eq: () => ({ order: async () => ({ data: database.rows, error: null }) }) }),
      delete: () => {
        database.deletes()
        return { eq: () => ({ eq: () => ({ select: async () => ({ data: database.rows, error: database.error }) }) }) }
      },
    }),
  },
}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('window', { dispatchEvent: vi.fn() })
  database.deletes.mockClear()
  database.error = null
})

afterEach(() => {
  pendingDeletions.cancelOtherUsers(undefined)
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('repository deletion undo', () => {
  it('hides a commitment during the grace period and restores it on undo', async () => {
    await deleteCommitment('user', 'record', 'Test')
    expect(await listCommitments('user')).toEqual([])
    expect(database.deletes).not.toHaveBeenCalled()
    pendingDeletions.undo(pendingDeletions.getSnapshot()[0].key)
    expect(await listCommitments('user')).toEqual(database.rows)
    await vi.advanceTimersByTimeAsync(deletionDelayMs)
    expect(database.deletes).not.toHaveBeenCalled()
  })

  it('only sends a transaction DELETE after the grace period', async () => {
    await deleteTransaction('user', 'record', 'Test')
    expect(await listTransactions('user')).toEqual([])
    expect(database.deletes).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(deletionDelayMs)
    expect(database.deletes).toHaveBeenCalledTimes(1)
    expect(pendingDeletions.getSnapshot()).toEqual([])
  })

  it('restores visibility and exposes errors from the actual database deletion', async () => {
    database.error = new Error('Échec réseau')
    await deleteTransaction('user', 'record', 'Test')
    await vi.advanceTimersByTimeAsync(deletionDelayMs)
    expect(await listTransactions('user')).toEqual(database.rows)
    expect(pendingDeletions.getSnapshot()[0]).toMatchObject({ status: 'error', error: 'Échec réseau' })
  })
})