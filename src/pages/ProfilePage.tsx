import { Download } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useAuth } from '../features/auth/useAuth'
import { createBudgetBackup } from '../features/budget/backup-export'
import { getBudgetSettings, listCategories, listCommitments, listTransactions } from '../features/budget/budget-repository'
import './pages.css'

export function ProfilePage() {
	const { configured, loading, user, signIn, signOut, verifyCode } = useAuth()
	const [email, setEmail] = useState('')
	const [code, setCode] = useState('')
	const [codeRequested, setCodeRequested] = useState(false)
	const [message, setMessage] = useState('')
	const [submitting, setSubmitting] = useState(false)
	const [exporting, setExporting] = useState(false)
	const [exportError, setExportError] = useState('')

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setSubmitting(true)
		setMessage('')
		const result = await signIn(email)
		const isRateLimited = result.error?.toLowerCase().includes('rate limit')
		if (!result.error) setCodeRequested(true)
		setMessage(isRateLimited ? 'Trop de codes ont ete demandes. Attendez environ une heure avant de reessayer.' : result.error ?? 'Un code de connexion vient de vous etre envoye.')
		setSubmitting(false)
	}

	async function handleCodeSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setSubmitting(true)
		setMessage('')
		const result = await verifyCode(email, code.trim())
		setMessage(result.error ?? 'Connexion validee.')
		setSubmitting(false)
	}

	async function downloadBackup() {
		if (!user) return
		setExporting(true); setExportError('')
		try { const [settings, categories, transactions, commitments] = await Promise.all([getBudgetSettings(user.id), listCategories(user.id), listTransactions(user.id), listCommitments(user.id)]); const url = URL.createObjectURL(new Blob([createBudgetBackup({ settings, categories, transactions, commitments })], { type: 'application/json' })); const link = window.document.createElement('a'); link.href = url; link.download = `horizon-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url) } catch (requestError) { setExportError(requestError instanceof Error ? requestError.message : 'Impossible de creer la sauvegarde.') } finally { setExporting(false) }
	}

	if (!configured) {
		return <section className="page-placeholder"><p className="eyebrow">CONFIGURATION</p><h1>Connectez Neon.</h1><p className="description">Ajoutez l URL publique Neon dans votre fichier <code>.env.local</code> pour activer la connexion.</p><div className="placeholder-card"><span className="status-dot" aria-hidden="true" /><p>VITE_NEON_URL est necessaire.</p></div></section>
	}

	if (loading) return <section className="page-placeholder"><p className="eyebrow">ESPACE PERSONNEL</p><h1>Chargement...</h1></section>

	if (user) {
		return <section className="page-placeholder"><p className="eyebrow">ESPACE PERSONNEL</p><h1>Vous etes connecte.</h1><p className="description">{user.email}</p><div className="profile-actions"><button className="primary-button" type="button" onClick={() => void downloadBackup()} disabled={exporting}><Download size={18} />{exporting ? 'Preparation...' : 'Telecharger ma sauvegarde'}</button><button className="secondary-button" type="button" onClick={() => void signOut()}>Se deconnecter</button></div>{exportError && <p className="form-message" role="alert">{exportError}</p>}</section>
	}

	return <section className="page-placeholder"><p className="eyebrow">ESPACE PERSONNEL</p><h1>Bienvenue.</h1><p className="description">{codeRequested ? 'Saisissez le code recu par e-mail pour ouvrir votre espace.' : 'Entrez votre adresse e-mail pour recevoir un code de connexion securise.'}</p>{codeRequested ? <form className="auth-form" onSubmit={handleCodeSubmit}><label htmlFor="verification-code">Code de connexion</label><input id="verification-code" inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} required autoComplete="one-time-code" placeholder="000000" /><button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Verification...' : 'Se connecter'}</button><button className="secondary-button" type="button" onClick={() => { setCodeRequested(false); setCode(''); setMessage('') }} disabled={submitting}>Utiliser une autre adresse</button>{message && <p className="form-message" role="status">{message}</p>}</form> : <form className="auth-form" onSubmit={handleSubmit}><label htmlFor="email">Adresse e-mail</label><input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="vous@exemple.fr" /><button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Envoi...' : 'Recevoir un code'}</button>{message && <p className="form-message" role="status">{message}</p>}</form>}</section>
}