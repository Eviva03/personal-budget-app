import { BarChart3, FolderCog, HandCoins, History, House, Settings2, WalletCards } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import './AppLayout.css'

type AppLayoutProps = { children: ReactNode }

const navigation = [
  { to: '/', label: 'Accueil', icon: House },
  { to: '/transactions', label: 'Transactions', icon: WalletCards },
  { to: '/engagements', label: 'Engagements', icon: HandCoins },
  { to: '/analyse', label: 'Analyse', icon: BarChart3 },
  { to: '/historique', label: 'Historique', icon: History },
  { to: '/categories', label: 'Categories', icon: FolderCog },
  { to: '/profil', label: 'Profil', icon: Settings2 },
]

export function AppLayout({ children }: AppLayoutProps) {
  const { user } = useAuth()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Horizon, accueil">
          <span className="brand-mark" aria-hidden="true"><i /></span><span>Horizon</span>
        </a>
        <nav className="main-navigation" aria-label="Navigation principale">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <Icon size={20} aria-hidden="true" /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <p className="sidebar-note">{user?.email ?? 'Votre espace de decision, en toute clarte.'}</p>
      </aside>
      <main className="main-content">{children}</main>
      <nav className="mobile-navigation" aria-label="Navigation principale">
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <Icon size={20} aria-hidden="true" /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}