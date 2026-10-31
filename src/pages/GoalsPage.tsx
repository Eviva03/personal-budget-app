import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../features/auth/useAuth'
import { createGoalAllocation, createSavingsGoal, listCategories, listGoalAllocations, listSavingsGoals, listTransactions } from '../features/budget/budget-repository'
import { useCurrency } from '../features/budget/CurrencyProvider'
import { convertAmount, parseAmount } from '../features/budget/money'
import type { Category, GoalAllocation, SavingsGoal, Transaction } from '../features/budget/types'
import './pages.css'

const today = new Date().toISOString().slice(0, 10)

export function GoalsPage() {
  const { user } = useAuth()
  const { budgetCurrency, displayCurrency, formatAmount } = useCurrency()
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [allocations, setAllocations] = useState<GoalAllocation[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [goalId, setGoalId] = useState('')
  const [transactionId, setTransactionId] = useState('')
  const [allocationAmount, setAllocationAmount] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    void Promise.all([listSavingsGoals(user.id), listGoalAllocations(user.id), listTransactions(user.id), listCategories(user.id)])
      .then(([nextGoals, nextAllocations, nextTransactions, nextCategories]) => {
        setGoals(nextGoals)
        setAllocations(nextAllocations)
        setTransactions(nextTransactions)
        setCategories(nextCategories)
      })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Impossible de charger les objectifs.'))
  }, [user])

  const incomeTransactions = transactions.filter((transaction) => transaction.direction === 'income' || (!transaction.direction && categories.find((category) => category.id === transaction.category_id)?.type === 'income'))
  const allocatedForGoal = (id: string) => allocations.filter((allocation) => allocation.goal_id === id).reduce((sum, allocation) => sum + allocation.amount, 0)
  const allocatedForTransaction = (id: string) => allocations.filter((allocation) => allocation.transaction_id === id).reduce((sum, allocation) => sum + allocation.amount, 0)

  async function createGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !name.trim()) return
    const displayedAmount = parseAmount(targetAmount)
    if (!displayedAmount) { setMessage('Saisissez un objectif supérieur à zéro.'); return }
    setSaving(true); setMessage('')
    try {
      const goal = await createSavingsGoal(user.id, { name: name.trim(), target_amount: convertAmount(displayedAmount, displayCurrency, budgetCurrency), target_date: targetDate || null })
      setGoals((current) => [...current, goal])
      setName(''); setTargetAmount(''); setTargetDate('')
      setMessage('Objectif créé.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Impossible de créer cet objectif.') } finally { setSaving(false) }
  }

  async function allocateIncome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !goalId || !transactionId) return
    const displayedAmount = parseAmount(allocationAmount)
    const amount = displayedAmount === null ? null : convertAmount(displayedAmount, displayCurrency, budgetCurrency)
    const transaction = incomeTransactions.find((entry) => entry.id === transactionId)
    if (!amount || !transaction || amount > transaction.amount - allocatedForTransaction(transaction.id)) { setMessage('Le montant depasse le revenu encore disponible pour cette affectation.'); return }
    setSaving(true); setMessage('')
    try {
      const allocation = await createGoalAllocation(user.id, { goal_id: goalId, transaction_id: transactionId, amount, allocated_at: today })
      setAllocations((current) => [allocation, ...current])
      setAllocationAmount('')
      setMessage('Revenu affecté à l’objectif.')
      window.dispatchEvent(new Event('budget-data-changed'))
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Impossible d’affecter ce revenu.') } finally { setSaving(false) }
  }

  return <section className="page-placeholder goals-page">
    <p className="eyebrow">ÉPARGNE</p><h1>Objectifs</h1><p className="description">Créez un projet, indiquez le montant à atteindre, puis affectez-y une partie d’un revenu ponctuel. Cette somme est réservée à votre objectif et ne doit plus servir aux dépenses courantes.</p>
    <form className="goal-form" onSubmit={createGoal}>
      <input aria-label="Nom de l’objectif" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex. Fonds de sécurité" maxLength={80} required />
      <input aria-label={`Cible de l’objectif en ${displayCurrency}`} value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)} inputMode="decimal" placeholder={`Cible (${displayCurrency})`} required />
      <input aria-label="Échéance de l’objectif" type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
      <button className="primary-button" type="submit" disabled={saving}>Créer l’objectif</button>
    </form>
    {goals.length > 0 && <form className="goal-allocation" onSubmit={allocateIncome}>
      <select aria-label="Objectif a alimenter" value={goalId} onChange={(event) => setGoalId(event.target.value)} required><option value="">Choisir un objectif</option>{goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}</select>
      <select aria-label="Revenu a affecter" value={transactionId} onChange={(event) => setTransactionId(event.target.value)} required><option value="">Choisir un revenu</option>{incomeTransactions.map((transaction) => <option key={transaction.id} value={transaction.id}>{transaction.description} - {formatAmount(transaction.amount - allocatedForTransaction(transaction.id))} disponible</option>)}</select>
      <input aria-label={`Montant a affecter en ${displayCurrency}`} value={allocationAmount} onChange={(event) => setAllocationAmount(event.target.value)} inputMode="decimal" placeholder={`Montant (${displayCurrency})`} required />
      <button className="secondary-button" type="submit" disabled={saving}>Affecter</button>
    </form>}
    {message && <p className="form-message" role="status">{message}</p>}
    {goals.length === 0 ? <div className="placeholder-card"><span className="status-dot" /><p>Créez un objectif pour commencer à affecter vos primes, dons, ventes ou remboursements.</p></div> : <div className="goal-grid">{goals.map((goal) => {
      const saved = allocatedForGoal(goal.id)
      const progress = Math.min(100, Math.round(saved / goal.target_amount * 100))
      return <article className="goal-card" key={goal.id}><div><strong>{goal.name}</strong><span>{formatAmount(saved)} sur {formatAmount(goal.target_amount)}</span></div><div className="goal-progress" aria-label={`${progress}% atteint`}><span style={{ width: `${progress}%` }} /></div><footer><b>{progress}%</b>{goal.target_date && <span>Echeance: {new Date(`${goal.target_date}T00:00:00`).toLocaleDateString('fr-FR')}</span>}</footer></article>
    })}</div>}
  </section>
}