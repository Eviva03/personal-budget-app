import { describe, expect, it, vi } from 'vitest'
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

  it('keeps merchants whose name contains total or solde', () => {
    const preview = parseTransactionsPdfText('Date Description Montant 7 octobre TOTAL ACCESS 0452 -52,65 € 8 octobre SOLDE ET DESTOCKAGE SARL -19,90 € 9 octobre SOLDE -1 234,56 €')
    expect(preview.valid.map((item) => item.description)).toEqual(['TOTAL ACCESS 0452', 'SOLDE ET DESTOCKAGE SARL'])
  })

  it('does not absorb reference numbers into the amount', () => {
    const preview = parseTransactionsPdfText('Date Description Montant 5 octobre CARTE 1234 24,50 € 6 octobre VIR 2 100,00 € 7 octobre RETRAIT -1.234,56 €')
    expect(preview.valid.map((item) => [item.description, item.amount])).toEqual([['CARTE 1234', 24.5], ['VIR', 2100], ['RETRAIT', 1234.56]])
  })

  it('marks unsigned amounts as income only when the statement prints signs', () => {
    const signed = parseTransactionsPdfText('Date Description Montant 5 octobre CARREFOUR -24,50 € 6 octobre VIR SALAIRE 2 100,00 €')
    expect(signed.valid.map((item) => item.direction)).toEqual([undefined, 'income'])
    const unsigned = parseTransactionsPdfText('Date Description Montant 5 octobre CARREFOUR 24,50 € 6 octobre NETFLIX 13,99 €')
    expect(unsigned.valid.map((item) => item.direction)).toEqual([undefined, undefined])
  })

  it('reads separate debit and credit CSV columns and keeps the direction', () => {
    const preview = parseTransactionsCsv('Date;Libellé;Débit;Crédit\n05/10/2026;CARREFOUR;24,50;\n06/10/2026;VIR SALAIRE;;2 100,00')
    expect(preview.valid.map((item) => [item.description, item.amount, item.direction])).toEqual([['CARREFOUR', 24.5, undefined], ['VIR SALAIRE', 2100, 'income']])
  })

  it('uses the previous year for operations dated well after today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2027, 0, 10))
    try {
      const preview = parseTransactionsPdfText('Date Description Montant 28 décembre BOULANGERIE -4,20 € 3 janvier NETFLIX -13,99 €')
      expect(preview.valid.map((item) => item.occurred_at)).toEqual(['2026-12-28', '2027-01-03'])
    } finally { vi.useRealTimers() }
  })

  it('reads a 300-line multi-page statement without losing or reclassifying lines', () => {
    const merchants = ['CARREFOUR CITY 1234', 'NETFLIX.COM', 'TOTAL ACCESS 0452', 'VIR SALAIRE ACME SAS', 'BOULANGERIE PAUL', 'AMAZON EU SARL']
    const pages = Array.from({ length: 6 }, (_, page) => {
      const rows = Array.from({ length: 50 }, (_, line) => {
        const index = page * 50 + line
        const merchant = merchants[index % merchants.length]
        const amount = merchant.startsWith('VIR') ? '2 100,00' : `-${10 + (index % 90)},${String((index * 13) % 100).padStart(2, '0')}`
        return `${(index % 27) + 1} octobre ${merchant} ${amount} €`
      })
      return `Releve de compte page ${page + 1} Date Description Montant ${rows.join(' ')} Solde en fin de page 1 234,56 €`
    })
    const preview = parseTransactionsPdfText(pages.join('\n'))
    expect(preview.valid).toHaveLength(300)
    expect(preview.valid.filter((item) => item.direction === 'income')).toHaveLength(50)
    expect(preview.errors).toEqual([])
  })
})