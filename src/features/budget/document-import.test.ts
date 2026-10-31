import { describe, expect, it } from 'vitest'
import { parseTransactionsCsv, parseTransactionsPdfText, suggestCategoryId, transactionFingerprint } from './document-import'

describe('parseTransactionsCsv', () => {
  it('parses French bank-style transaction columns', () => {
    const preview = parseTransactionsCsv('Date;Libelle;Montant\n27/10/2026;Courses;-24,50')
    expect(preview.valid).toEqual([{ occurred_at: '2026-10-27', description: 'Courses', amount: 24.5, category_id: null }])
  })

  it('rejects invalid rows instead of importing them', () => {
    expect(parseTransactionsCsv('Date;Libelle;Montant\nwrong;Courses;24').errors).toHaveLength(1)
  })

  it('detects a dated transaction in extracted PDF text', () => {
    const preview = parseTransactionsPdfText('Activite de la carte depuis 28 mai DATE DESCRIPTION MONTANT 11 juin THE LINUX FOUNDATION 1 LETTERMAN DRIVE Apparaitra en tant qu operation 888,04 $ 94129')
    expect(preview.valid).toEqual([{ occurred_at: '2026-06-11', description: 'THE LINUX FOUNDATION 1 LETTERMAN DRIVE', amount: 888.04, category_id: null }])
  })

  it('detects Revolut-style rows without bank-specific column headings', () => {
    const preview = parseTransactionsPdfText('Statement\n2026-10-01 UBER TRIP -18,20 EUR\n2026-10-02 PAYPAL *SERVICE -32.50 EUR')
    expect(preview.valid).toEqual([
      { occurred_at: '2026-10-01', description: 'UBER TRIP', amount: 18.2, category_id: null },
      { occurred_at: '2026-10-02', description: 'PAYPAL *SERVICE', amount: 32.5, category_id: null },
    ])
  })

  it('detects Revolut French statement rows and ignores the closing balance', () => {
    const preview = parseTransactionsPdfText('Transactions du compte Date Description Argent sortant Argent entrant Solde 22 oct. 2026 Retrait depuis une Pocket 4,00€ 24,65€ 22 oct. 2026 Paiement envoyé par XXX 250,00€ 270,65€ 23 oct. 2026 Virement de XXX 148,00€ 148,65€')
    expect(preview.valid).toEqual([
      { occurred_at: '2026-10-22', description: 'Retrait depuis une Pocket', amount: 4, category_id: null },
      { occurred_at: '2026-10-22', description: 'Paiement envoyé par XXX', amount: 250, category_id: null },
      { occurred_at: '2026-10-23', description: 'Virement de XXX', amount: 148, category_id: null },
    ])
  })

  it('detects transactions in a Revolut screenshot OCR', () => {
    const preview = parseTransactionsPdfText('John Jarelle N Oct 6, 6:51 AM Completed -e30 Personal > Mariage de Chimène Oct 5, 6:59 PM Completed -€4 Bbv Les Cuves Oct 5, 6:59 PM Completed -€4')
    expect(preview.valid).toEqual([
      { occurred_at: '2026-10-06', description: 'John Jarelle N', amount: 30, category_id: null },
      { occurred_at: '2026-10-05', description: 'Personal > Mariage de Chimène', amount: 4, category_id: null },
      { occurred_at: '2026-10-05', description: 'Bbv Les Cuves', amount: 4, category_id: null },
    ])
  })

  it('normalizes labels when comparing import duplicates', () => {
    expect(transactionFingerprint({ occurred_at: '2026-06-11', description: 'THE  LINUX  FONDATION', amount: 24.5, category_id: null })).toBe(transactionFingerprint({ occurred_at: '2026-06-11', description: 'the linux fondation', amount: 24.5, category_id: null }))
  })

  it('suggests an existing category from a merchant label', () => {
    expect(suggestCategoryId('CARREFOUR CITY', [{ id: 'food', user_id: 'u', name: 'Alimentation', color: '#000000', type: 'expense', created_at: '' }])).toBe('food')
  })
})