import { describe, expect, it } from 'vitest'
import { analyzeDocumentText } from './document-intelligence'

describe('analyzeDocumentText', () => {
  it('identifies a statement when transactions have been extracted', () => {
    expect(analyzeDocumentText('Releve EUR', [{ occurred_at: '2026-10-22', description: 'Uber', amount: 18.2, category_id: null }])).toMatchObject({ kind: 'bank_statement', confidence: 'high' })
  })

  it('extracts an invoice amount and due date for review', () => {
    const analysis = analyzeDocumentText('FACTURE\nAcme Energie\nTotal TTC: 84,50 EUR\nDate d echeance: 15/11/2026', [])
    expect(analysis).toMatchObject({ kind: 'invoice', invoice: { amount: 84.5, dueDate: '2026-11-15' } })
  })

  it('extracts a receipt total for a transaction review', () => {
    const analysis = analyzeDocumentText('TICKET DE CAISSE\nBoulangerie du Centre\nTotal: 12,40 EUR', [])
    expect(analysis).toMatchObject({ kind: 'receipt', invoice: { amount: 12.4 } })
  })

  it('keeps an unknown document reviewable instead of guessing a transaction', () => {
    expect(analyzeDocumentText('Document administratif sans montant', [])).toMatchObject({ kind: 'unknown', confidence: 'low' })
  })
})