import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { useAuth } from './features/auth/useAuth'
import { AddBudgetModal } from './features/budget/AddBudgetModal'
import { PwaInstallPrompt } from './components/PwaInstallPrompt'
import { AnalysisPage } from './pages/AnalysisPage'
import { CommitmentsPage } from './pages/CommitmentsPage'
import { HomePage } from './pages/HomePage'
import { HistoryPage } from './pages/HistoryPage'
import { ProfilePage } from './pages/ProfilePage'
import { TransactionsPage } from './pages/TransactionsPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { DiscoverPage } from './pages/DiscoverPage'
import { GoalsPage } from './pages/GoalsPage'
import { CurrencySetupModal } from './features/budget/CurrencySetupModal'
import { getBudgetSettings } from './features/budget/budget-repository'

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
      if (active) setCurrencySetup('required')
    })
    return () => { active = false }
  }, [user])

  if (user && currencySetup === 'checking') return null

  return (
    <AppLayout>
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
      {user && <button className="global-add" type="button" aria-label="Ajouter une donnee budget" onClick={() => setIsAdding(true)}>
        <Plus size={24} strokeWidth={2.5} aria-hidden="true" />
      </button>}
      {user && isAdding && <AddBudgetModal userId={user.id} onClose={() => setIsAdding(false)} onCreated={() => window.dispatchEvent(new Event('budget-data-changed'))} />}
      {user && currencySetup === 'required' && <CurrencySetupModal userId={user.id} onComplete={() => {
        setCurrencySetup('complete')
        navigate('/', { replace: true })
      }} />}
      <PwaInstallPrompt />
    </AppLayout>
  )
}

export default App
