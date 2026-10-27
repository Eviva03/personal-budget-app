import { FileText, Upload, X } from 'lucide-react'
import { useState, type ChangeEvent } from 'react'
import { createTransactions, listCategories, listTransactions } from './budget-repository'
import { parseTransactionsCsv, readPdfText, suggestCategoryId, transactionFingerprint, type ImportPreview } from './document-import'
import type { Category, NewTransaction } from './types'

type TransactionImportProps = { userId: string; onImported: () => void }

export function TransactionImport({ userId, onImported }: TransactionImportProps) {
  const [preview, setPreview] = useState<ImportPreview | null>(null); const [categories, setCategories] = useState<Category[]>([]); const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false); const [message, setMessage] = useState(''); const [ocrProgress, setOcrProgress] = useState<number | null>(null)
  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return
    setMessage(''); setPreview(null); setOcrProgress(null)
    try { const [nextPreview, availableCategories] = await Promise.all([file.name.toLowerCase().endsWith('.pdf') ? readPdfText(file, setOcrProgress) : file.text().then(parseTransactionsCsv), listCategories(userId)]); setCategories(availableCategories); setPreview({ ...nextPreview, valid: nextPreview.valid.map((transaction) => ({ ...transaction, category_id: suggestCategoryId(transaction.description, availableCategories) })) }) } catch (error) { setMessage(error instanceof Error ? error.message : 'Impossible de lire ce document.') } finally { setOcrProgress(null) }
  }
  function updateTransaction(index: number, field: keyof NewTransaction, value: string) {
    setPreview((current) => current ? { ...current, valid: current.valid.map((transaction, currentIndex) => currentIndex === index ? { ...transaction, [field]: field === 'amount' ? Number(value) : field === 'category_id' ? value || null : value } : transaction) } : null)
  }
  async function importValid() {
    if (!preview?.valid.length) return
    if (preview.valid.some((transaction) => !transaction.description.trim() || !transaction.occurred_at || !Number.isFinite(transaction.amount) || transaction.amount <= 0)) { setMessage('Corrigez les lignes incompletes ou les montants invalides avant import.'); return }
    setSaving(true)
    try {
      const existing = await listTransactions(userId)
      const fingerprints = new Set(existing.map(transactionFingerprint))
      const transactions = preview.valid.filter((transaction) => {
        const fingerprint = transactionFingerprint(transaction)
        if (fingerprints.has(fingerprint)) return false
        fingerprints.add(fingerprint)
        return true
      })
      if (transactions.length === 0) { setMessage('Toutes les lignes existent deja et n ont pas ete importees.'); return }
      await createTransactions(userId, transactions); onImported(); setMessage(`${transactions.length} transaction(s) importee(s)${transactions.length < preview.valid.length ? `, ${preview.valid.length - transactions.length} doublon(s) ignore(s).` : '.'}`); setPreview(null)
    } catch (error) { const details = error instanceof Error ? [error.message, 'details' in error && typeof error.details === 'string' ? error.details : '', 'hint' in error && typeof error.hint === 'string' ? error.hint : ''].filter(Boolean).join(' ') : ''; setMessage(details || 'Impossible d importer les transactions.') } finally { setSaving(false) }
  }
  return <section className="transaction-import"><button className="import-trigger" type="button" onClick={() => setOpen(!open)}><Upload size={18} />Importer un document</button>{open && <div className="import-panel"><label className="file-picker"><FileText size={19} /><span>Choisir un CSV ou PDF</span><input type="file" accept=".csv,text/csv,application/pdf" onChange={(event) => void selectFile(event)} /></label>{ocrProgress !== null && <p className="import-result">Lecture OCR en cours: {ocrProgress}%</p>}{preview && <><p className="import-result">{preview.valid.length} ligne(s) valide(s) detectee(s).</p>{preview.errors.map((error) => <p className="form-message" key={error}>{error}</p>)}{preview.pdfText && <details><summary>Texte extrait du PDF</summary><p className="pdf-text">{preview.pdfText.slice(0, 1500)}</p></details>}{preview.valid.length > 0 && <><div className="import-preview">{preview.valid.map((transaction, index) => <div className="import-row" key={`${index}-${transactionFingerprint(transaction)}`}><input aria-label={`Date de la ligne ${index + 1}`} type="date" value={transaction.occurred_at} onChange={(event) => updateTransaction(index, 'occurred_at', event.target.value)} /><input aria-label={`Libelle de la ligne ${index + 1}`} value={transaction.description} onChange={(event) => updateTransaction(index, 'description', event.target.value)} maxLength={200} /><input aria-label={`Montant de la ligne ${index + 1}`} type="number" min="0.01" step="0.01" value={transaction.amount} onChange={(event) => updateTransaction(index, 'amount', event.target.value)} /><select aria-label={`Categorie de la ligne ${index + 1}`} value={transaction.category_id ?? ''} onChange={(event) => updateTransaction(index, 'category_id', event.target.value)}><option value="">Sans categorie</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>)}</div><button className="primary-button" type="button" onClick={() => void importValid()} disabled={saving}>{saving ? 'Import...' : `Importer ${preview.valid.length} ligne(s)`}</button></>}</>} {message && <p className="form-message">{message}</p>}<button className="close-import" type="button" onClick={() => { setOpen(false); setPreview(null) }} aria-label="Fermer l import"><X size={16} /></button></div>}</section>
}