import { Pencil, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../features/auth/useAuth'
import { isCommitmentFinished } from '../features/budget/budget-engine'
import { CategoryIcon } from '../features/budget/category-icon'
import { CommitmentImport } from '../features/budget/CommitmentImport'
import { deleteCommitment, listCategories, listCommitments, updateCommitment } from '../features/budget/budget-repository'
import { useCurrency } from '../features/budget/CurrencyProvider'
import type { Category, Commitment, NewCommitment } from '../features/budget/types'
import './pages.css'

const frequencyLabels = { once: 'Unique', weekly: 'Hebdomadaire', monthly: 'Mensuelle', yearly: 'Annuelle' }

function installmentLabel(item: Commitment) {
  if (item.frequency !== 'monthly' || !item.installment_count) return frequencyLabels[item.frequency]
  const firstDueDate = new Date(`${item.due_date}T00:00:00`)
  const today = new Date()
  const monthDistance = (today.getFullYear() - firstDueDate.getFullYear()) * 12 + today.getMonth() - firstDueDate.getMonth()
  return `Mensualite ${Math.max(1, monthDistance + 1)}/${item.installment_count}`
}

export function CommitmentsPage() {
  const { user } = useAuth()
  const { formatAmount } = useCurrency()
  const [items, setItems] = useState<Commitment[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [editing, setEditing] = useState<Commitment | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [kind, setKind] = useState('')
  const [sortBy, setSortBy] = useState('due-date')
  const activeItems = items.filter((item) => !isCommitmentFinished(item))
  const filteredItems = activeItems.filter((item) => (!query || item.description.toLowerCase().includes(query.toLowerCase())) && (!from || item.due_date >= from) && (!to || item.due_date <= to) && (!categoryId || item.category_id === categoryId) && (!kind || (kind === 'installment' ? Boolean(item.installment_count) : kind === 'recurring' ? item.frequency === 'monthly' && !item.installment_count : item.frequency === kind))).sort((left, right) => sortBy === 'amount' ? right.amount - left.amount : sortBy === 'name' ? left.description.localeCompare(right.description, 'fr') : left.due_date.localeCompare(right.due_date))

  useEffect(() => {
    if (!user) return
    const load = () => {
      setLoading(true)
      void Promise.all([listCommitments(user.id), listCategories(user.id)])
        .then(([commitments, availableCategories]) => { setItems(commitments); setCategories(availableCategories) })
        .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les engagements.'))
        .finally(() => setLoading(false))
    }
    load()
    window.addEventListener('budget-data-changed', load)
    return () => window.removeEventListener('budget-data-changed', load)
  }, [user])

  async function saveEdit() {
    if (!user || !editing || !editing.description.trim() || editing.amount <= 0) return
    setSaving(true)
    try {
      const changes: NewCommitment = {
        description: editing.description.trim(), amount: editing.amount, due_date: editing.due_date,
        frequency: editing.frequency, installment_count: editing.frequency === 'monthly' ? editing.installment_count ?? null : null,
        category_id: editing.category_id,
      }
      await updateCommitment(user.id, editing.id, changes)
      setItems((current) => current.map((item) => item.id === editing.id ? { ...item, ...changes } : item))
      setEditing(null)
      window.dispatchEvent(new Event('budget-data-changed'))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de modifier l engagement.')
    } finally { setSaving(false) }
  }

  async function remove(item: Commitment) {
    if (!user || !window.confirm(`Supprimer « ${item.description} » ?`)) return
    try {
      await deleteCommitment(user.id, item.id)
      setItems((current) => current.filter((entry) => entry.id !== item.id))
      window.dispatchEvent(new Event('budget-data-changed'))
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Impossible de supprimer l engagement.') }
  }

  return <section className="page-placeholder">
    <p className="eyebrow">A VENIR</p>
    <h1>Engagements</h1>
    <p className="description">Suivez les depenses deja prevues et leurs prochaines echeances.</p>
    {user && <CommitmentImport userId={user.id} onImported={() => window.dispatchEvent(new Event('budget-data-changed'))} />}
    {loading ? <p>Chargement...</p> : error ? <p className="form-message">{error}</p> : activeItems.length === 0 ? <div className="placeholder-card"><span className="status-dot" /><p>Aucun engagement actif. Utilisez le bouton + pour en ajouter un.</p></div> : <><div className="list-toolbar"><div className="toolbar-search"><input aria-label="Rechercher un engagement" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un engagement" /></div><div className="toolbar-filters"><input aria-label="Premiere echeance a partir du" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /><input aria-label="Premiere echeance jusqu au" type="date" value={to} onChange={(event) => setTo(event.target.value)} /><select aria-label="Filtrer les engagements par categorie" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Toutes categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><select aria-label="Filtrer par type de paiement" value={kind} onChange={(event) => setKind(event.target.value)}><option value="">Tous les types</option><option value="installment">Paiements fractionnes</option><option value="recurring">Mensuels recurrents</option><option value="once">Ponctuels</option><option value="weekly">Hebdomadaires</option><option value="yearly">Annuels</option></select><select aria-label="Trier les engagements" value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="due-date">Trier par echeance</option><option value="amount">Trier par montant</option><option value="name">Trier par nom</option></select></div></div><p className="filter-count">{filteredItems.length} engagement(s) affiche(s)</p>{filteredItems.length === 0 ? <div className="placeholder-card"><span className="status-dot" /><p>Aucun engagement ne correspond aux filtres.</p></div> : <ul className="data-list transaction-list">{filteredItems.map((item) => { const category = categories.find((entry) => entry.id === item.category_id); const isInstallment = Boolean(item.installment_count); return <li key={item.id} className={`commitment-row ${isInstallment ? 'commitment-installment' : item.frequency === 'monthly' ? 'commitment-recurring' : ''}`}><div><strong>{item.description}</strong><span>{new Date(`${item.due_date}T00:00:00`).toLocaleDateString('fr-FR')} · {installmentLabel(item)} · {category ? <span className="category-chip" style={{ '--category-color': category.color } as React.CSSProperties}><span className="category-chip-icon"><CategoryIcon name={category.icon} size={14} /></span>{category.name}</span> : 'Sans categorie'}</span></div><strong>{formatAmount(item.amount)}</strong><div className="row-actions"><button className="icon-button" type="button" title="Modifier" aria-label={`Modifier ${item.description}`} onClick={() => setEditing({ ...item })}><Pencil size={16} /></button><button className="icon-button danger-button" type="button" title="Supprimer" aria-label={`Supprimer ${item.description}`} onClick={() => void remove(item)}><Trash2 size={16} /></button></div></li> })}</ul>}</>}
    {editing && <div className="modal-backdrop" role="presentation" onMouseDown={() => setEditing(null)}><section className="entry-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><button className="icon-button" type="button" onClick={() => setEditing(null)} aria-label="Fermer"><X size={20} /></button><p className="eyebrow">ENGAGEMENT</p><h2>Modifier</h2><div className="entry-form"><label htmlFor="commitment-description">Description</label><input id="commitment-description" value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} maxLength={200} /><label htmlFor="commitment-amount">Montant par echeance</label><input id="commitment-amount" type="number" min="0.01" step="0.01" value={editing.amount} onChange={(event) => setEditing({ ...editing, amount: Number(event.target.value) })} /><label htmlFor="commitment-date">Premiere echeance</label><input id="commitment-date" type="date" value={editing.due_date} onChange={(event) => setEditing({ ...editing, due_date: event.target.value })} /><label htmlFor="commitment-frequency">Frequence</label><select id="commitment-frequency" value={editing.frequency} onChange={(event) => setEditing({ ...editing, frequency: event.target.value as Commitment['frequency'] })}>{Object.entries(frequencyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{editing.frequency === 'monthly' && <><label htmlFor="commitment-installments">Nombre de mensualites <small>(vide = sans fin)</small></label><input id="commitment-installments" type="number" min="2" step="1" value={editing.installment_count ?? ''} onChange={(event) => setEditing({ ...editing, installment_count: event.target.value ? Number(event.target.value) : null })} /></>}<label htmlFor="commitment-category">Categorie</label><select id="commitment-category" value={editing.category_id ?? ''} onChange={(event) => setEditing({ ...editing, category_id: event.target.value || null })}><option value="">Sans categorie</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><button className="primary-button" type="button" onClick={() => void saveEdit()} disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button></div></section></div>}
  </section>
}