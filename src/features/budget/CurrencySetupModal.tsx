import { useState, type FormEvent } from 'react'
import { saveBudgetSettings } from './budget-repository'
import type { BudgetCurrency } from './money'

type CurrencySetupModalProps = {
  userId: string
  onComplete: () => void
}

export function CurrencySetupModal({ userId, onComplete }: CurrencySetupModalProps) {
  const [currency, setCurrency] = useState<BudgetCurrency>('EUR')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await saveBudgetSettings(userId, {
        monthly_income: 0,
        reserve_amount: 0,
        payday_day: 1,
        budget_currency: currency,
        display_currency: currency,
      })
      window.dispatchEvent(new Event('currency-settings-changed'))
      onComplete()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible d’enregistrer votre devise.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="currency-setup-backdrop" role="presentation">
    <section className="currency-setup-modal" role="dialog" aria-modal="true" aria-labelledby="currency-setup-title">
      <p className="eyebrow">PREMIÈRE CONFIGURATION</p>
      <h2 id="currency-setup-title">Dans quelle devise tenez-vous votre budget ?</h2>
      <p>Cette devise servira à enregistrer vos revenus, dépenses et engagements. Elle ne pourra plus être modifiée ensuite.</p>
      <form onSubmit={submit}>
        <fieldset disabled={saving}>
          <legend>Devise d’origine</legend>
          <label className="currency-choice">
            <input type="radio" name="budget-currency" value="EUR" checked={currency === 'EUR'} onChange={() => setCurrency('EUR')} />
            <span><strong>Euro</strong><small>EUR</small></span>
          </label>
          <label className="currency-choice">
            <input type="radio" name="budget-currency" value="XAF" checked={currency === 'XAF'} onChange={() => setCurrency('XAF')} />
            <span><strong>Franc CFA d’Afrique centrale</strong><small>FCFA / XAF</small></span>
          </label>
        </fieldset>
        {error && <p className="form-message" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Enregistrement...' : 'Commencer mon budget'}</button>
      </form>
    </section>
  </div>
}