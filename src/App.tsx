import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { useAuth } from './features/auth/useAuth'
import { AddBudgetModal } from './features/budget/AddBudgetModal'
import { AnalysisPage } from './pages/AnalysisPage'
import { CommitmentsPage } from './pages/CommitmentsPage'
import { HomePage } from './pages/HomePage'
import { HistoryPage } from './pages/HistoryPage'
import { ProfilePage } from './pages/ProfilePage'
import { TransactionsPage } from './pages/TransactionsPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { DiscoverPage } from './pages/DiscoverPage'

function App() {
  const { user } = useAuth()
  const [isAdding, setIsAdding] = useState(false)

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
        </Route>
        <Route path="/profil" element={<ProfilePage />} />
        <Route path="/decouvrir" element={<DiscoverPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {user && <button className="global-add" type="button" aria-label="Ajouter une donnee budget" onClick={() => setIsAdding(true)}>
        <Plus size={24} strokeWidth={2.5} aria-hidden="true" />
      </button>}
      {user && isAdding && <AddBudgetModal userId={user.id} onClose={() => setIsAdding(false)} onCreated={() => window.dispatchEvent(new Event('budget-data-changed'))} />}
    </AppLayout>
  )
}

export default App
