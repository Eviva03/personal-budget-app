import { X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { createCommitment, createTransaction, listCategories } from './budget-repository'
import { parseAmount } from './money'
import type { Category } from './types'

type AddBudgetModalProps = { userId: string; onClose: () => void; onCreated: () => void }
type EntryType = 'transaction' | 'commitment'
type SupabaseError = { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }

const today = new Date().toISOString().slice(0, 10)

export function AddBudgetModal({ userId, onClose, onCreated }: AddBudgetModalProps) {
  const [entryType, setEntryType] = useState<EntryType>('transaction')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [frequency, setFrequency] = useState('once')
  const [installmentCount, setInstallmentCount] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { void listCategories(userId).then(setCategories).catch(() => undefined) }, [userId])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedAmount = parseAmount(amount)
    if (!parsedAmount) { setError('Saisissez un montant superieur a zero.'); return }
    setSaving(true); setError('')
    try {
      if (entryType === 'transaction') await createTransaction(userId, { amount: parsedAmount, description, occurred_at: date, category_id: categoryId || null })
      else await createCommitment(userId, { amount: parsedAmount, description, due_date: date, frequency: frequency as 'once' | 'weekly' | 'monthly' | 'yearly', installment_count: frequency === 'monthly' && installmentCount ? Number(installmentCount) : null, category_id: categoryId || null })
      onCreated(); onClose()
    } catch (requestError) {
      const supabaseError = requestError as SupabaseError
      const detail = [supabaseError.message, supabaseError.details, supabaseError.hint]
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .join(' ')
      setError(detail || 'Impossible d enregistrer cette donnee.')
    } finally { setSaving(false) }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="entry-modal" role="dialog" aria-modal="true" aria-labelledby="entry-title" onMouseDown={(event) => event.stopPropagation()}><button className="icon-button" type="button" onClick={onClose} aria-label="Fermer"><X size={20} /></button><p className="eyebrow">NOUVELLE DONNEE</p><h2 id="entry-title">Ajouter</h2><form className="entry-form" onSubmit={submit}><div className="entry-type"><button type="button" className={entryType === 'transaction' ? 'selected' : ''} onClick={() => setEntryType('transaction')}>Transaction</button><button type="button" className={entryType === 'commitment' ? 'selected' : ''} onClick={() => setEntryType('commitment')}>Engagement</button></div><label htmlFor="entry-description">Description</label><input id="entry-description" value={description} onChange={(event) => setDescription(event.target.value)} required maxLength={200} placeholder="Ex. Courses" /><label htmlFor="entry-amount">Montant par echeance</label><input id="entry-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required placeholder="0,00" /><label htmlFor="entry-date">{entryType === 'transaction' ? 'Date' : 'Premiere echeance'}</label><input id="entry-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />{entryType === 'commitment' && <><label htmlFor="entry-frequency">Frequence</label><select id="entry-frequency" value={frequency} onChange={(event) => setFrequency(event.target.value)}><option value="once">Unique</option><option value="weekly">Hebdomadaire</option><option value="monthly">Mensuelle</option><option value="yearly">Annuelle</option></select>{frequency === 'monthly' && <><label htmlFor="entry-installments">Nombre de mensualites <small>(laisser vide pour sans fin)</small></label><input id="entry-installments" type="number" min="2" step="1" value={installmentCount} onChange={(event) => setInstallmentCount(event.target.value)} placeholder="Ex. 3" /></>}</>}<label htmlFor="entry-category">Categorie</label><select id="entry-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Sans categorie</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{error && <p className="form-message" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button></form></section></div>
}