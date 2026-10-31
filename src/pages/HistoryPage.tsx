import { useEffect, useState } from 'react'
import { useAuth } from '../features/auth/useAuth'
import { budgetHistory, type MonthlyBudgetHistory } from '../features/budget/budget-history'
import { getBudgetSettings, listCategories, listCommitments, listTransactions } from '../features/budget/budget-repository'
import { useCurrency } from '../features/budget/CurrencyProvider'
import './pages.css'

export function HistoryPage() {
  const { user } = useAuth()
  const { formatAmount } = useCurrency()
  const [history, setHistory] = useState<MonthlyBudgetHistory[]>([])
  const [error, setError] = useState('')
  useEffect(() => { if (!user) return; void Promise.all([getBudgetSettings(user.id), listTransactions(user.id), listCommitments(user.id), listCategories(user.id)]).then(([settings, transactions, commitments, categories]) => { if (settings) setHistory(budgetHistory(settings, transactions, commitments, categories)) }).catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : 'Impossible de charger l’historique.')) }, [user])
  return <section className="page-placeholder history-page"><p className="eyebrow">RECUL</p><h1>Historique mensuel</h1><p className="description">Relisez chaque mois après coup : les revenus encaissés, les sorties enregistrées, les engagements prévus et ce qu’il restait vraiment après votre réserve.</p>{error ? <p className="form-message">{error}</p> : history.length === 0 ? <div className="placeholder-card"><span className="status-dot" /><p>Configurez votre revenu mensuel pour consulter l’historique.</p></div> : <div className="history-table" role="table"><div className="history-head" role="row"><span>Mois</span><span>Revenus</span><span>Dépenses</span><span>Engagé</span><span>Reste libre</span></div>{history.map((entry) => <div className="history-row" role="row" key={entry.month}><strong>{new Date(`${entry.month}-01T00:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</strong><span>{formatAmount(entry.totalIncome)}</span><span>{formatAmount(entry.realisedExpenses)}</span><span>{formatAmount(entry.projectedCommitments)}</span><b className={entry.freeRemainder < 0 ? 'negative-text' : ''}>{formatAmount(entry.freeRemainder)}</b></div>)}</div>}</section>
}