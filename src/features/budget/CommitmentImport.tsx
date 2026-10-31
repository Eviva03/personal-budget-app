import { FileText, Upload, X } from 'lucide-react'
import Papa from 'papaparse'
import { useState, type ChangeEvent } from 'react'
import { createCommitments, listCategories } from './budget-repository'
import { parseAmount } from './money'
import type { Category, CommitmentFrequency, NewCommitment } from './types'

type CommitmentImportProps = { userId: string; onImported: () => void }
const frequencies: { value: CommitmentFrequency; label: string }[] = [{ value: 'once', label: 'Unique' }, { value: 'weekly', label: 'Hebdomadaire' }, { value: 'monthly', label: 'Mensuelle' }, { value: 'yearly', label: 'Annuelle' }]

function parseDate(value: string) {
  const french = value.trim().match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/)
  if (french) return `${french[3]}-${french[2]}-${french[1]}`
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : null
}

function valueFor(row: Record<string, string>, names: string[]) {
  const key = Object.keys(row).find((name) => names.includes(name.trim().toLowerCase()))
  return key ? row[key]?.trim() ?? '' : ''
}

function parseCsv(csv: string): { valid: NewCommitment[]; errors: string[] } {
  const delimiter = csv.split(/\r?\n/, 1)[0]?.includes(';') ? ';' : ','
  const result = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: 'greedy', delimiter, transformHeader: (column) => column.trim() })
  const valid: NewCommitment[] = []; const errors: string[] = []
  result.data.forEach((row, index) => {
    const description = valueFor(row, ['libelle', 'libellé', 'description', 'nom'])
    const dueDate = parseDate(valueFor(row, ['date', 'echeance', 'échéance', 'premiere echeance', 'première échéance']))
    const amount = parseAmount(valueFor(row, ['montant', 'amount']).replace(/\s/g, ''))
    const rawFrequency = valueFor(row, ['frequence', 'fréquence', 'frequency']).toLowerCase()
    const frequency: CommitmentFrequency = rawFrequency.includes('hebdo') ? 'weekly' : rawFrequency.includes('ann') ? 'yearly' : rawFrequency.includes('mens') ? 'monthly' : 'once'
    const installments = Number(valueFor(row, ['mensualites', 'mensualités', 'installments']))
    if (!description || !dueDate || !amount) { errors.push(`Ligne ${index + 2} : date, libellé ou montant invalide.`); return }
    valid.push({ description, due_date: dueDate, amount, frequency, installment_count: frequency === 'monthly' && Number.isInteger(installments) && installments >= 2 ? installments : null, category_id: null })
  })
  if (result.errors.length > 0) errors.push('Le fichier CSV contient une structure invalide.')
  return { valid, errors }
}

export function CommitmentImport({ userId, onImported }: CommitmentImportProps) {
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<NewCommitment[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setMessage(''); setPreview([])
    const [content, availableCategories] = await Promise.all([file.text(), listCategories(userId)])
    const parsed = parseCsv(content)
    setCategories(availableCategories); setPreview(parsed.valid)
    setMessage(parsed.errors.join(' ') || `${parsed.valid.length} engagement(s) détecté(s).`)
  }

  function updateRow(index: number, field: keyof NewCommitment, value: string) {
    setPreview((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, [field]: field === 'amount' || field === 'installment_count' ? (value ? Number(value) : null) : field === 'category_id' ? value || null : value } : item))
  }

  async function importPreview() {
    if (!preview.length || preview.some((item) => !item.description.trim() || !item.due_date || !item.amount || item.amount <= 0)) { setMessage('Corrigez les lignes incomplètes avant l’import.'); return }
    setSaving(true)
    try { await createCommitments(userId, preview); onImported(); setMessage(`${preview.length} engagement(s) importé(s).`); setPreview([]) } catch (error) { setMessage(error instanceof Error ? error.message : 'Impossible d’importer les engagements.') } finally { setSaving(false) }
  }

  return <section className="commitment-import"><button className="import-trigger" type="button" onClick={() => setOpen((current) => !current)}><Upload size={18} />Importer des engagements</button>{open && <div className="import-panel"><button className="close-import" type="button" onClick={() => setOpen(false)} aria-label="Fermer l import"><X size={18} /></button><label className="file-picker"><FileText size={19} /><span>Choisir un fichier CSV</span><input type="file" accept=".csv,text/csv" onChange={(event) => void selectFile(event)} /></label><p className="import-hint">Colonnes reconnues: date, libelle, montant, frequence et mensualites.</p>{message && <p className="import-result">{message}</p>}{preview.length > 0 && <><div className="commitment-import-preview">{preview.map((item, index) => <div className="commitment-import-row" key={`${index}-${item.description}`}><input aria-label={`Date ${index + 1}`} type="date" value={item.due_date} onChange={(event) => updateRow(index, 'due_date', event.target.value)} /><input aria-label={`Libelle ${index + 1}`} value={item.description} onChange={(event) => updateRow(index, 'description', event.target.value)} /><input aria-label={`Montant ${index + 1}`} type="number" min="0.01" step="0.01" value={item.amount} onChange={(event) => updateRow(index, 'amount', event.target.value)} /><select aria-label={`Frequence ${index + 1}`} value={item.frequency} onChange={(event) => updateRow(index, 'frequency', event.target.value)}>{frequencies.map((frequency) => <option key={frequency.value} value={frequency.value}>{frequency.label}</option>)}</select>{item.frequency === 'monthly' && <input aria-label={`Mensualites ${index + 1}`} type="number" min="2" placeholder="Mensualites" value={item.installment_count ?? ''} onChange={(event) => updateRow(index, 'installment_count', event.target.value)} />}<select aria-label={`Categorie ${index + 1}`} value={item.category_id ?? ''} onChange={(event) => updateRow(index, 'category_id', event.target.value)}><option value="">Sans categorie</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>)}</div><button className="primary-button" type="button" onClick={() => void importPreview()} disabled={saving}>{saving ? 'Import...' : `Importer ${preview.length} engagement(s)`}</button></>}</div>}</section>
}