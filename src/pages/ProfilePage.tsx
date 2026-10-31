import { Download } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { createBudgetBackup } from '../features/budget/backup-export'
import { getBudgetSettings, listCategories, listCommitments, listTransactions, saveBudgetSettings } from '../features/budget/budget-repository'
import type { BudgetSettings } from '../features/budget/types'
import type { BudgetCurrency } from '../features/budget/money'
import './pages.css'

export function ProfilePage() {
	const { configured, loading, user, signIn, signOut, verifyCode } = useAuth()
	const navigate = useNavigate()
	const location = useLocation()
	const [email, setEmail] = useState('')
	const [code, setCode] = useState('')
	const [codeRequested, setCodeRequested] = useState(false)
	const [message, setMessage] = useState('')
	const [submitting, setSubmitting] = useState(false)
	const [exporting, setExporting] = useState(false)
	const [exportError, setExportError] = useState('')
	const [settings, setSettings] = useState<BudgetSettings | null>(null)
	const [budgetCurrency, setBudgetCurrency] = useState<BudgetCurrency>('EUR')
	const [displayCurrency, setDisplayCurrency] = useState<BudgetCurrency>('EUR')
	const [currencySaving, setCurrencySaving] = useState(false)
	const [currencyMessage, setCurrencyMessage] = useState('')

	useEffect(() => {
		if (!user) { setSettings(null); return }
		void getBudgetSettings(user.id).then((nextSettings) => {
			setSettings(nextSettings)
			setBudgetCurrency(nextSettings?.budget_currency ?? 'EUR')
			setDisplayCurrency(nextSettings?.display_currency ?? nextSettings?.budget_currency ?? 'EUR')
		}).catch(() => setCurrencyMessage('Impossible de charger les devises.'))
	}, [user])

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setSubmitting(true)
		setMessage('')
		const result = await signIn(email)
		const isRateLimited = result.error?.toLowerCase().includes('rate limit')
		if (!result.error) setCodeRequested(true)
		setMessage(isRateLimited ? 'Trop de codes ont été demandés. Attendez environ une heure avant de réessayer.' : result.error ?? 'Un code de connexion vient de vous être envoyé.')
		setSubmitting(false)
	}

	async function handleCodeSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setSubmitting(true)
		setMessage('')
		try {
			const result = await verifyCode(email, code.trim())
			if (result.error) setMessage(result.error)
			else navigate((location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/', { replace: true })
		} catch (error) {
			setMessage(error instanceof Error ? error.message : 'Impossible de vérifier ce code. Demandez-en un nouveau.')
		} finally {
			setSubmitting(false)
		}
	}

	async function downloadBackup() {
		if (!user) return
		setExporting(true); setExportError('')
		try { const [settings, categories, transactions, commitments] = await Promise.all([getBudgetSettings(user.id), listCategories(user.id), listTransactions(user.id), listCommitments(user.id)]); const url = URL.createObjectURL(new Blob([createBudgetBackup({ settings, categories, transactions, commitments })], { type: 'application/json' })); const link = window.document.createElement('a'); link.href = url; link.download = `horizon-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url) } catch (requestError) { setExportError(requestError instanceof Error ? requestError.message : 'Impossible de créer la sauvegarde.') } finally { setExporting(false) }
	}

	async function saveCurrencies(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (!user) return
		setCurrencySaving(true); setCurrencyMessage('')
		try {
			const nextSettings = await saveBudgetSettings(user.id, {
				monthly_income: settings?.monthly_income ?? 0,
				reserve_amount: settings?.reserve_amount ?? 0,
				payday_day: settings?.payday_day ?? 1,
				budget_currency: budgetCurrency,
				display_currency: displayCurrency,
			})
			setSettings(nextSettings)
			window.dispatchEvent(new Event('currency-settings-changed'))
			setCurrencyMessage('Préférences de devise enregistrées.')
		} catch (requestError) {
			setCurrencyMessage(requestError instanceof Error ? requestError.message : 'Impossible d’enregistrer les devises.')
		} finally { setCurrencySaving(false) }
	}

	if (!configured) {
		return <section className="page-placeholder"><p className="eyebrow">CONFIGURATION</p><h1>Connectez Neon.</h1><p className="description">Ajoutez l’URL publique Neon dans votre fichier <code>.env.local</code> pour activer la connexion.</p><div className="placeholder-card"><span className="status-dot" aria-hidden="true" /><p>VITE_NEON_URL est nécessaire.</p></div></section>
	}

	if (loading) return <section className="page-placeholder"><p className="eyebrow">ESPACE PERSONNEL</p><h1>Chargement...</h1></section>

	if (user) {
		return <section className="page-placeholder"><p className="eyebrow">ESPACE PERSONNEL</p><h1>Vous êtes connecté.</h1><p className="description">Gérez ici l’affichage de vos montants et téléchargez une copie de vos réglages, catégories, transactions et engagements. Votre compte : {user.email}</p><form className="currency-settings" onSubmit={saveCurrencies}><h2>Devises</h2><label htmlFor="budget-currency">Devise d’origine</label><select id="budget-currency" value={budgetCurrency} disabled><option value="EUR">Euro (EUR)</option><option value="XAF">Franc CFA d’Afrique centrale (FCFA)</option></select><p>Les montants sont enregistrés dans cette devise, verrouillée après la première configuration.</p><label htmlFor="display-currency">Devise d’affichage</label><select id="display-currency" value={displayCurrency} onChange={(event) => setDisplayCurrency(event.target.value as BudgetCurrency)}><option value="EUR">Euro (EUR)</option><option value="XAF">Franc CFA d’Afrique centrale (FCFA)</option></select><button className="primary-button" type="submit" disabled={currencySaving}>{currencySaving ? 'Enregistrement...' : 'Enregistrer les devises'}</button>{currencyMessage && <p className="form-message" role="status">{currencyMessage}</p>}</form><div className="profile-actions"><button className="primary-button" type="button" onClick={() => void downloadBackup()} disabled={exporting}><Download size={18} />{exporting ? 'Préparation...' : 'Télécharger ma sauvegarde'}</button><button className="secondary-button" type="button" onClick={() => void signOut()}>Se déconnecter</button></div>{exportError && <p className="form-message" role="alert">{exportError}</p>}</section>
	}

	return <section className="page-placeholder"><p className="eyebrow">ESPACE PERSONNEL</p><h1>Bienvenue.</h1><p className="description">{codeRequested ? 'Saisissez le code reçu par e-mail pour ouvrir votre espace.' : 'Entrez votre adresse e-mail pour recevoir un code de connexion sécurisé.'}</p>{codeRequested ? <form className="auth-form" onSubmit={handleCodeSubmit}><label htmlFor="verification-code">Code de connexion</label><input id="verification-code" inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} required autoComplete="one-time-code" placeholder="000000" /><button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Vérification...' : 'Se connecter'}</button><button className="secondary-button" type="button" onClick={() => { setCodeRequested(false); setCode(''); setMessage('') }} disabled={submitting}>Utiliser une autre adresse</button>{message && <p className="form-message" role="status">{message}</p>}</form> : <form className="auth-form" onSubmit={handleSubmit}><label htmlFor="email">Adresse e-mail</label><input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="vous@exemple.fr" /><button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Envoi...' : 'Recevoir un code'}</button>{message && <p className="form-message" role="status">{message}</p>}</form>}</section>
}