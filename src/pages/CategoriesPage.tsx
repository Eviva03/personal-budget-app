import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../features/auth/useAuth'
import { createCategory, deleteCategory, listCategories, updateCategory } from '../features/budget/budget-repository'
import type { Category, CategoryType } from '../features/budget/types'
import './pages.css'

type CategoryDraft = Pick<Category, 'name' | 'color' | 'type'>
const emptyDraft: CategoryDraft = { name: '', color: '#4a7462', type: 'expense' }

export function CategoriesPage() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [draft, setDraft] = useState<CategoryDraft>(emptyDraft)
  const [editing, setEditing] = useState<Category | null>(null)
  const [error, setError] = useState('')

  useEffect(() => { if (!user) return; void listCategories(user.id).then(setCategories).catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : 'Impossible de charger les categories.')) }, [user])
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!user || !draft.name.trim()) return
    try { const category = await createCategory(user.id, { ...draft, name: draft.name.trim() }); setCategories((current) => [...current, category].sort((first, second) => first.name.localeCompare(second.name, 'fr'))); setDraft(emptyDraft) } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Impossible de creer la categorie.') }
  }
  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!user || !editing || !editing.name.trim()) return
    try { const updated = await updateCategory(user.id, editing.id, { name: editing.name.trim(), color: editing.color, type: editing.type }); setCategories((current) => current.map((category) => category.id === updated.id ? updated : category)); setEditing(null); window.dispatchEvent(new Event('budget-data-changed')) } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Impossible de modifier la categorie.') }
  }
  async function remove(category: Category) {
    if (!user || !window.confirm(`Supprimer la categorie « ${category.name} » ?`)) return
    try { await deleteCategory(user.id, category.id); setCategories((current) => current.filter((entry) => entry.id !== category.id)); window.dispatchEvent(new Event('budget-data-changed')) } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Impossible de supprimer la categorie.') }
  }
  return <section className="page-placeholder"><p className="eyebrow">ORGANISATION</p><h1>Categories</h1><p className="description">Classez vos mouvements pour faciliter la lecture de votre budget.</p><form className="category-form" onSubmit={save}><input aria-label="Nom de categorie" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} maxLength={80} placeholder="Ex. Alimentation" required /><input aria-label="Couleur de categorie" type="color" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} /><select aria-label="Type de categorie" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as CategoryType })}><option value="expense">Depense</option><option value="income">Revenu</option></select><button className="primary-button" type="submit"><Plus size={17} />Ajouter</button></form>{error && <p className="form-message" role="alert">{error}</p>}<ul className="data-list category-list">{categories.map((category) => <li key={category.id}><div className="category-name"><i style={{ background: category.color }} /><strong>{category.name}</strong><span>{category.type === 'expense' ? 'Depense' : 'Revenu'}</span></div><div className="row-actions"><button className="icon-button" type="button" title="Modifier" aria-label={`Modifier ${category.name}`} onClick={() => setEditing({ ...category })}><Pencil size={16} /></button><button className="icon-button danger-button" type="button" title="Supprimer" aria-label={`Supprimer ${category.name}`} onClick={() => void remove(category)}><Trash2 size={16} /></button></div></li>)}</ul>{editing && <div className="modal-backdrop" role="presentation" onMouseDown={() => setEditing(null)}><section className="entry-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><button className="icon-button" type="button" onClick={() => setEditing(null)} aria-label="Fermer"><X size={20} /></button><p className="eyebrow">CATEGORIE</p><h2>Modifier</h2><form className="entry-form" onSubmit={saveEdit}><label htmlFor="category-name">Nom</label><input id="category-name" value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} maxLength={80} required /><label htmlFor="category-color">Couleur</label><input id="category-color" type="color" value={editing.color} onChange={(event) => setEditing({ ...editing, color: event.target.value })} /><label htmlFor="category-type">Type</label><select id="category-type" value={editing.type} onChange={(event) => setEditing({ ...editing, type: event.target.value as CategoryType })}><option value="expense">Depense</option><option value="income">Revenu</option></select><button className="primary-button" type="submit">Enregistrer</button></form></section></div>}</section>
}