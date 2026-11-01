export const deletionDelayMs = 15_000

export type PendingDeletion = {
  key: string
  userId: string
  table: 'transactions' | 'commitments'
  recordId: string
  label: string
  status: 'pending' | 'deleting' | 'error'
  error?: string
}

type DeletionRequest = Omit<PendingDeletion, 'key' | 'status' | 'error'>

export function createDeletionQueue(onChange: () => void = () => {}) {
  let snapshot: PendingDeletion[] = []
  const listeners = new Set<() => void>()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  function publish() {
    for (const listener of listeners) listener()
    onChange()
  }

  function remove(key: string) {
    const timer = timers.get(key)
    if (timer !== undefined) clearTimeout(timer)
    timers.delete(key)
    snapshot = snapshot.filter((entry) => entry.key !== key)
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    hides(userId: string, table: PendingDeletion['table'], recordId: string) {
      return snapshot.some((entry) => entry.userId === userId && entry.table === table && entry.recordId === recordId && entry.status !== 'error')
    },
    schedule(request: DeletionRequest, commit: () => Promise<void>) {
      const key = `${request.userId}:${request.table}:${request.recordId}`
      if (snapshot.some((entry) => entry.key === key && entry.status !== 'error')) return
      remove(key)
      snapshot = [...snapshot, { ...request, key, status: 'pending' }]
      timers.set(key, setTimeout(async () => {
        timers.delete(key)
        snapshot = snapshot.map((entry) => entry.key === key ? { ...entry, status: 'deleting' } : entry)
        publish()
        try {
          await commit()
          remove(key)
        } catch (error) {
          snapshot = snapshot.map((entry) => entry.key === key ? {
            ...entry,
            status: 'error',
            error: error instanceof Error ? error.message : 'La suppression a échoué. La ligne a été conservée.',
          } : entry)
        }
        publish()
      }, deletionDelayMs))
      publish()
    },
    undo(key: string) {
      if (!snapshot.some((entry) => entry.key === key && entry.status === 'pending')) return
      remove(key)
      publish()
    },
    dismissError(key: string) {
      if (!snapshot.some((entry) => entry.key === key && entry.status === 'error')) return
      remove(key)
      publish()
    },
    cancelOtherUsers(userId: string | undefined) {
      const entries = snapshot.filter((entry) => entry.userId !== userId && entry.status !== 'deleting')
      if (entries.length === 0) return
      for (const entry of entries) remove(entry.key)
      publish()
    },
  }
}

export const pendingDeletions = createDeletionQueue(() => {
  window.dispatchEvent(new Event('budget-data-changed'))
})