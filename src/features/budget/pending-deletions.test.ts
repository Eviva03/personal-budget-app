import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDeletionQueue, deletionDelayMs } from './pending-deletions'

const request = { userId: 'user', table: 'commitments' as const, recordId: 'rent', label: 'Loyer' }

afterEach(() => { vi.useRealTimers() })

describe('deferred deletions', () => {
  it('hides a row immediately but only deletes after the undo window', async () => {
    vi.useFakeTimers()
    const queue = createDeletionQueue()
    const commit = vi.fn().mockResolvedValue(undefined)
    queue.schedule(request, commit)
    expect(queue.hides('user', 'commitments', 'rent')).toBe(true)
    expect(queue.hides('other', 'commitments', 'rent')).toBe(false)
    expect(commit).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(deletionDelayMs)
    expect(commit).toHaveBeenCalledTimes(1)
    expect(queue.getSnapshot()).toEqual([])
  })

  it('undo preserves the original row without issuing any database mutation', async () => {
    vi.useFakeTimers()
    const queue = createDeletionQueue()
    const commit = vi.fn()
    queue.schedule(request, commit)
    queue.undo(queue.getSnapshot()[0].key)
    await vi.advanceTimersByTimeAsync(deletionDelayMs)
    expect(commit).not.toHaveBeenCalled()
    expect(queue.hides('user', 'commitments', 'rent')).toBe(false)
  })

  it('supports undoing several deletions independently and avoids duplicate requests', async () => {
    vi.useFakeTimers()
    const queue = createDeletionQueue()
    const first = vi.fn().mockResolvedValue(undefined)
    const second = vi.fn().mockResolvedValue(undefined)
    queue.schedule(request, first)
    queue.schedule(request, first)
    queue.schedule({ ...request, recordId: 'phone', label: 'Téléphone' }, second)
    expect(queue.getSnapshot()).toHaveLength(2)
    queue.undo(queue.getSnapshot()[0].key)
    await vi.advanceTimersByTimeAsync(deletionDelayMs)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('shows the row again and retains an error if the database rejects deletion', async () => {
    vi.useFakeTimers()
    const queue = createDeletionQueue()
    queue.schedule(request, vi.fn().mockRejectedValue(new Error('Connexion indisponible')))
    await vi.advanceTimersByTimeAsync(deletionDelayMs)
    expect(queue.hides('user', 'commitments', 'rent')).toBe(false)
    expect(queue.getSnapshot()[0]).toMatchObject({ status: 'error', error: 'Connexion indisponible' })
    queue.dismissError(queue.getSnapshot()[0].key)
    expect(queue.getSnapshot()).toEqual([])
  })

  it('cancels pending deletions on logout or account change', async () => {
    vi.useFakeTimers()
    const queue = createDeletionQueue()
    const commit = vi.fn()
    queue.schedule(request, commit)
    queue.cancelOtherUsers(undefined)
    await vi.advanceTimersByTimeAsync(deletionDelayMs)
    expect(commit).not.toHaveBeenCalled()
    expect(queue.getSnapshot()).toEqual([])
  })

  it('does not offer undo once the database mutation has started', async () => {
    vi.useFakeTimers()
    const queue = createDeletionQueue()
    let finish!: () => void
    queue.schedule(request, () => new Promise<void>((resolve) => { finish = resolve }))
    await vi.advanceTimersByTimeAsync(deletionDelayMs)
    const key = queue.getSnapshot()[0].key
    queue.undo(key)
    expect(queue.getSnapshot()[0].status).toBe('deleting')
    finish()
    await Promise.resolve()
    expect(queue.getSnapshot()).toEqual([])
  })
})