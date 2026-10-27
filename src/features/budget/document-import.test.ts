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

  it('normalizes labels when comparing import duplicates', () => {
    expect(transactionFingerprint({ occurred_at: '2026-06-11', description: 'THE  LINUX  FONDATION', amount: 24.5, category_id: null })).toBe(transactionFingerprint({ occurred_at: '2026-06-11', description: 'the linux fondation', amount: 24.5, category_id: null }))
  })

  it('suggests an existing category from a merchant label', () => {
    expect(suggestCategoryId('CARREFOUR CITY', [{ id: 'food', user_id: 'u', name: 'Alimentation', color: '#000000', type: 'expense', created_at: '' }])).toBe('food')
  })
})