import { Undo2, X } from 'lucide-react'
import { useEffect, useSyncExternalStore } from 'react'
import { useAuth } from '../features/auth/useAuth'
import { pendingDeletions } from '../features/budget/pending-deletions'
import './DeletionUndo.css'

export function DeletionUndo() {
  const { user } = useAuth()
  const snapshot = useSyncExternalStore(pendingDeletions.subscribe, pendingDeletions.getSnapshot)
  const userId = user?.id

  useEffect(() => {
    pendingDeletions.cancelOtherUsers(userId)
  }, [userId])

  const entries = snapshot.filter((entry) => entry.userId === userId)
  if (entries.length === 0) return null

  return (
    <section className="deletion-undo" aria-label="Suppressions récentes">
      <p className="deletion-undo-heading">Annulation disponible pendant 15 secondes</p>
      <ul>
        {entries.map((entry) => (
          <li key={entry.key}>
            <div role={entry.status === 'error' ? 'alert' : 'status'}>
              <strong>{entry.label}</strong>
              <p>{entry.status === 'pending' ? 'Suppression en attente' : entry.status === 'deleting' ? 'Suppression en cours…' : `Suppression non confirmée. ${entry.error}`}</p>
            </div>
            {entry.status === 'pending' && (
              <button type="button" onClick={() => pendingDeletions.undo(entry.key)} aria-label={`Annuler la suppression de ${entry.label}`}>
                <Undo2 size={18} aria-hidden="true" /> Annuler
              </button>
            )}
            {entry.status === 'error' && (
              <button className="deletion-undo-dismiss" type="button" title="Fermer le message" aria-label={`Fermer le message pour ${entry.label}`} onClick={() => pendingDeletions.dismissError(entry.key)}>
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}