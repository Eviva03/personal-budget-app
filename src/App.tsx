import { Plus } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { DeletionUndo } from './components/DeletionUndo'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { useAuth } from './features/auth/useAuth'
import { AddBudgetModal } from './features/budget/AddBudgetModal'
import { PwaInstallPrompt } from './components/PwaInstallPrompt'
import { HomePage } from './pages/HomePage'
import { ProfilePage } from './pages/ProfilePage'
import { CurrencySetupModal } from './features/budget/CurrencySetupModal'
import { getBudgetSettings } from './features/budget/budget-repository'

const AnalysisPage = lazy(() => import('./pages/AnalysisPage').then((module) => ({ default: module.AnalysisPage })))
const CommitmentsPage = lazy(() => import('./pages/CommitmentsPage').then((module) => ({ default: module.CommitmentsPage })))
const HistoryPage = lazy(() => import('./pages/HistoryPage').then((module) => ({ default: module.HistoryPage })))
const TransactionsPage = lazy(() => import('./pages/TransactionsPage').then((module) => ({ default: module.TransactionsPage })))
const CategoriesPage = lazy(() => import('./pages/CategoriesPage').then((module) => ({ default: module.CategoriesPage })))
const DiscoverPage = lazy(() => import('./pages/DiscoverPage').then((module) => ({ default: module.DiscoverPage })))
const GoalsPage = lazy(() => import('./pages/GoalsPage').then((module) => ({ default: module.GoalsPage })))

function App() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [isAdding, setIsAdding] = useState(false)
  const [currencySetup, setCurrencySetup] = useState<'checking' | 'required' | 'complete'>('checking')

  useEffect(() => {
    let active = true
    if (!user) {
      setCurrencySetup('complete')
      return () => { active = false }
    }
    setCurrencySetup('checking')
    void getBudgetSettings(user.id).then((settings) => {
      if (active) setCurrencySetup(settings ? 'complete' : 'required')
    }).catch(() => {
      // A failed read is not proof of a new account; the setup form would overwrite existing settings.
      if (active) setCurrencySetup('complete')
    })
    return () => { active = false }
  }, [user])

  if (user && currencySetup === 'checking') return <div className="app-loading" role="status"><span className="spinner" aria-hidden="true" />Chargement...</div>

  return (
    <AppLayout>
      <Suspense fallback={<div className="app-loading app-loading-inline" role="status"><span className="spinner" aria-hidden="true" />Chargement...</div>}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/engagements" element={<CommitmentsPage />} />
          <Route path="/analyse" element={<AnalysisPage />} />
          <Route path="/historique" element={<HistoryPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/objectifs" element={<GoalsPage />} />
        </Route>
        <Route path="/profil" element={<ProfilePage />} />
        <Route path="/decouvrir" element={<DiscoverPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      {user && <button className="global-add" type="button" aria-label="Ajouter une donnee budget" onClick={() => setIsAdding(true)}>
        <Plus size={24} strokeWidth={2.5} aria-hidden="true" />
      </button>}
      {user && isAdding && <AddBudgetModal userId={user.id} onClose={() => setIsAdding(false)} onCreated={() => window.dispatchEvent(new Event('budget-data-changed'))} />}
      {user && currencySetup === 'required' && <CurrencySetupModal userId={user.id} onComplete={() => {
        setCurrencySetup('complete')
        navigate('/', { replace: true })
      }} />}
      <PwaInstallPrompt />
      <DeletionUndo />
    </AppLayout>
  )
}

export default App
