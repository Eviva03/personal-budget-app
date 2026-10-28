import { CalendarDays, ReceiptText, TrendingDown, WalletCards } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../features/auth/useAuth'
import { getBudgetSettings, listCategories, listCommitments, listTransactions } from '../features/budget/budget-repository'
import { formatAmount } from '../features/budget/money'
import { commitmentsUntilPayday, nextPayday, spendingByDay, type SpendingPoint, type UpcomingCommitment } from '../features/budget/projection'
import './pages.css'

export function AnalysisPage() {
	const { user } = useAuth(); const [upcoming, setUpcoming] = useState<UpcomingCommitment[]>([]); const [spending, setSpending] = useState<SpendingPoint[]>([]); const [payday, setPayday] = useState<Date | null>(null); const [daysUntilPayday, setDaysUntilPayday] = useState(0); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
	useEffect(() => {
		if (!user) return
		const userId = user.id

		async function load() {
			setLoading(true)
			try {
				const [settings, commitments, transactions, categories] = await Promise.all([getBudgetSettings(userId), listCommitments(userId), listTransactions(userId), listCategories(userId)])
				if (!settings) {
					setError('Configurez votre budget depuis l accueil pour voir votre projection.')
					return
				}

				const categoryById = new Map(categories.map((category) => [category.id, category]))
				const monthlyExpenses = transactions.filter((transaction) => categoryById.get(transaction.category_id ?? '')?.type !== 'income')
				const nextPaydayDate = nextPayday(settings.payday_day)
				setPayday(nextPaydayDate)
				setDaysUntilPayday(Math.max(0, Math.ceil((nextPaydayDate.getTime() - new Date().getTime()) / 86_400_000)))
				setUpcoming(commitmentsUntilPayday(commitments, settings.payday_day))
				setSpending(spendingByDay(monthlyExpenses))
			} catch (loadError) {
				setError(loadError instanceof Error ? loadError.message : 'Impossible de charger votre analyse.')
			} finally {
				setLoading(false)
			}
		}

		void load()
	}, [user])
	const maxAmount = Math.max(...spending.map((point) => point.amount), 1)
	const spendingTotal = spending.reduce((total, point) => total + point.amount, 0)
	const upcomingTotal = upcoming.reduce((total, item) => total + item.amount, 0)
	return <section className="analysis-page"><p className="eyebrow">COMPRENDRE</p><h1>Projection.</h1><p className="description">Les depenses prevues jusqu a votre prochaine paie et le rythme de vos sorties ce mois-ci.</p>{loading ? <p>Chargement...</p> : error ? <div className="placeholder-card"><span className="status-dot" /><p>{error}</p></div> : <><div className="analysis-overview"><article className="analysis-metric"><CalendarDays size={19} /><span>Prochaine paie</span><strong>{daysUntilPayday === 0 ? 'Aujourd hui' : `${daysUntilPayday} jour${daysUntilPayday > 1 ? 's' : ''}`}</strong></article><article className="analysis-metric"><WalletCards size={19} /><span>A payer avant</span><strong>{formatAmount(upcomingTotal)}</strong></article><article className="analysis-metric expense-metric"><TrendingDown size={19} /><span>Depense ce mois</span><strong>{formatAmount(spendingTotal)}</strong></article><article className="analysis-metric"><ReceiptText size={19} /><span>Jours avec sorties</span><strong>{spending.length}</strong></article></div><div className="analysis-grid"><article className="analysis-panel"><div className="analysis-panel-heading"><div><p className="panel-label">PROCHAINE PAIE</p><strong className="payday-date">{payday?.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</strong></div><span className="analysis-total">{formatAmount(upcomingTotal)}</span></div><p className="panel-subtitle">{upcoming.length} echeance{upcoming.length > 1 ? 's' : ''} a couvrir avant cette date</p><ol className="timeline">{upcoming.length === 0 ? <li className="timeline-empty">Aucune echeance avant la prochaine paie.</li> : upcoming.map((item) => <li key={item.id}><time>{new Date(`${item.nextDueDate}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</time><div><strong>{item.description}</strong><span>{item.frequency === 'once' ? 'Ponctuel' : 'Engagement recurrent'}</span></div><b>{formatAmount(item.amount)}</b></li>)}</ol></article><article className="analysis-panel"><div className="analysis-panel-heading"><div><p className="panel-label">DEPENSES DU MOIS</p><strong className="chart-title">Par jour</strong></div><span className="analysis-total expense-total">{formatAmount(spendingTotal)}</span></div><div className="spending-chart" aria-label="Graphique des depenses par jour">{spending.length === 0 ? <p>Aucune depense enregistree ce mois-ci.</p> : spending.map((point) => <div className="chart-column" key={point.label}><span>{formatAmount(point.amount)}</span><i style={{ height: `${Math.max(8, point.amount / maxAmount * 150)}px` }} /><small>{point.label}</small></div>)}</div></article></div></>}</section>
}