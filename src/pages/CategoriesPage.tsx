import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../features/auth/useAuth'
import { CategoryIcon, CategoryIconOptions } from '../features/budget/category-icon'
import { createCategory, deleteCategory, listCategories, updateCategory } from '../features/budget/budget-repository'
import type { Category, CategoryIconName, CategoryType } from '../features/budget/types'
import './pages.css'

type CategoryDraft = Pick<Category, 'name' | 'color' | 'type'> & { icon: CategoryIconName }
const emptyDraft: CategoryDraft = { name: '', color: '#387c70', icon: 'tag', type: 'expense' }

export function CategoriesPage() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [draft, setDraft] = useState<CategoryDraft>(emptyDraft)
  const [editing, setEditing] = useState<Category | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    void listCategories(user.id).then(setCategories).catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : 'Impossible de charger les catégories.'))
  }, [user])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !draft.name.trim()) return
    try {
      const category = await createCategory(user.id, { ...draft, name: draft.name.trim() })
      setCategories((current) => [...current, category].sort((first, second) => first.name.localeCompare(second.name, 'fr')))
      setDraft(emptyDraft)
      window.dispatchEvent(new Event('budget-data-changed'))
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Impossible de créer la catégorie.') }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !editing || !editing.name.trim()) return
    try {
      const updated = await updateCategory(user.id, editing.id, { name: editing.name.trim(), color: editing.color, icon: editing.icon ?? 'tag', type: editing.type })
      setCategories((current) => current.map((category) => category.id === updated.id ? updated : category))
      setEditing(null)
      window.dispatchEvent(new Event('budget-data-changed'))
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Impossible de modifier la catégorie.') }
  }

  async function remove(category: Category) {
    if (!user || !window.confirm(`Supprimer la catégorie « ${category.name} » ?`)) return
    try {
      await deleteCategory(user.id, category.id)
      setCategories((current) => current.filter((entry) => entry.id !== category.id))
      window.dispatchEvent(new Event('budget-data-changed'))
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Impossible de supprimer la catégorie.') }
  }

  return <section className="page-placeholder">
    <p className="eyebrow">ORGANISATION</p><h1>Catégories</h1><p className="description">Les catégories donnent un sens à vos mouvements : une dépense sert au suivi des sorties, un revenu alimente vos entrées. Elles facilitent les filtres, les importations et les analyses.</p>
    <form className="category-form" onSubmit={save}>
      <input aria-label="Nom de catégorie" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} maxLength={80} placeholder="Ex. Paiements fractionnés" required />
      <input aria-label="Couleur de catégorie" type="color" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} />
      <select aria-label="Icône de catégorie" value={draft.icon} onChange={(event) => setDraft({ ...draft, icon: event.target.value as CategoryIconName })}><CategoryIconOptions /></select>
      <select aria-label="Type de catégorie" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as CategoryType })}><option value="expense">Dépense</option><option value="income">Revenu</option></select>
      <button className="primary-button" type="submit"><Plus size={17} />Ajouter</button>
    </form>
    {error && <p className="form-message" role="alert">{error}</p>}
    <ul className="data-list category-list">{categories.map((category) => <li key={category.id}><div className="category-name"><span className="category-icon" style={{ color: category.color }}><CategoryIcon name={category.icon} /></span><strong>{category.name}</strong><span>{category.type === 'expense' ? 'Dépense' : 'Revenu'}</span></div><div className="row-actions"><button className="icon-button" type="button" title="Modifier" aria-label={`Modifier ${category.name}`} onClick={() => setEditing({ ...category, icon: category.icon ?? 'tag' })}><Pencil size={16} /></button><button className="icon-button danger-button" type="button" title="Supprimer" aria-label={`Supprimer ${category.name}`} onClick={() => void remove(category)}><Trash2 size={16} /></button></div></li>)}</ul>
    {editing && <div className="modal-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setEditing(null) }}><section className="entry-modal" role="dialog" aria-modal="true"><button className="icon-button" type="button" onClick={() => setEditing(null)} aria-label="Fermer"><X size={20} /></button><p className="eyebrow">CATÉGORIE</p><h2>Modifier</h2><form className="entry-form" onSubmit={saveEdit}><label htmlFor="category-name">Nom</label><input id="category-name" value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} maxLength={80} required /><label htmlFor="category-color">Couleur</label><input id="category-color" type="color" value={editing.color} onChange={(event) => setEditing({ ...editing, color: event.target.value })} /><label htmlFor="category-icon">Icône</label><select id="category-icon" value={editing.icon ?? 'tag'} onChange={(event) => setEditing({ ...editing, icon: event.target.value as CategoryIconName })}><CategoryIconOptions /></select><label htmlFor="category-type">Type</label><select id="category-type" value={editing.type} onChange={(event) => setEditing({ ...editing, type: event.target.value as CategoryType })}><option value="expense">Dépense</option><option value="income">Revenu</option></select><button className="primary-button" type="submit">Enregistrer</button></form></section></div>}
  </section>
}