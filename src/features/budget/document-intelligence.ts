import type { NewTransaction } from './types'

export type DocumentKind = 'bank_statement' | 'invoice' | 'receipt' | 'unknown'

export type DocumentAnalysis = {
  kind: DocumentKind
  confidence: 'low' | 'medium' | 'high'
  explanation: string
  invoice: { description: string; dueDate: string | null; amount: number | null } | null
}

function normalized(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function parseDate(value: string) {
  const french = value.match(/(\d{2})[./-](\d{2})[./-](\d{4})/)
  if (french) return `${french[3]}-${french[2]}-${french[1]}`
  const iso = value.match(/\d{4}-\d{2}-\d{2}/)
  return iso?.[0] ?? null
}

function amountAfter(label: string, text: string) {
  const match = text.match(new RegExp(`${label}[^\\d]{0,40}(-?[\\d\\s]+[,.]\\d{2})\\s*(?:€|eur)`, 'i'))
  const amount = Number(match?.[1].replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(amount) ? Math.abs(amount) : null
}

function invoiceDescription(text: string) {
  const supplier = text.split(/\r?\n/).map((line) => line.trim()).find((line) => line.length >= 3 && line.length <= 80 && !/(facture|date|total|tva|client|adresse|siret)/i.test(line))
  return supplier ?? 'Facture importee'
}

export function analyzeDocumentText(text: string, transactions: NewTransaction[]): DocumentAnalysis {
  const compact = normalized(text)
  if (transactions.length > 0 || /transactions du compte|solde d.?ouverture|argent sortant|argent entrant|releve/.test(compact)) {
    return { kind: 'bank_statement', confidence: transactions.length > 0 ? 'high' : 'medium', explanation: transactions.length > 0 ? `${transactions.length} transaction(s) detectee(s) dans le releve.` : 'Le document ressemble a un releve bancaire.', invoice: null }
  }

  const amount = amountAfter('(?:total\\s*(?:ttc|a payer)?|montant\\s*(?:total|du)?)', text)
  const dueDateMatch = text.match(/(?:date d.?echeance|echeance|a regler avant|a payer avant)\D{0,30}(\d{2}[./-]\d{2}[./-]\d{4}|\d{4}-\d{2}-\d{2})/i)
  const dueDate = dueDateMatch ? parseDate(dueDateMatch[1]) : null
  if (/facture|invoice|montant\s*(?:total|du)|total\s*(?:ttc|a payer)/.test(compact)) {
    return { kind: 'invoice', confidence: amount === null ? 'medium' : 'high', explanation: amount === null ? 'Facture detectee, total a verifier.' : 'Facture detectee avec un total a verifier.', invoice: { description: invoiceDescription(text), dueDate, amount } }
  }

  if (/ticket|recu|receipt|tva|total/.test(compact)) {
    return { kind: 'receipt', confidence: 'low', explanation: 'Ticket ou recu detecte. Verifiez la date et le total avant import.', invoice: { description: invoiceDescription(text), dueDate: null, amount: amountAfter('total', text) } }
  }

  return { kind: 'unknown', confidence: 'low', explanation: 'Type de document inconnu. L assistant peut proposer une interpretation apres validation.', invoice: null }
}