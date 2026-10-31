import { BarChart3, CircleHelp, FolderCog, HandCoins, History, House, Settings2, Target, WalletCards } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import './AppLayout.css'

type AppLayoutProps = { children: ReactNode }

const navigation = [
  { to: '/', label: 'Accueil', icon: House },
  { to: '/transactions', label: 'Transactions', icon: WalletCards },
  { to: '/engagements', label: 'Engagements', icon: HandCoins },
  { to: '/analyse', label: 'Analyse', icon: BarChart3 },
  { to: '/historique', label: 'Historique', icon: History },
  { to: '/objectifs', label: 'Objectifs', icon: Target },
  { to: '/categories', label: 'Catégories', icon: FolderCog },
  { to: '/decouvrir', label: 'Découvrir', icon: CircleHelp },
  { to: '/profil', label: 'Profil', icon: Settings2 },
]

export function AppLayout({ children }: AppLayoutProps) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const mobileNavRef = useRef<HTMLElement>(null)

  useEffect(() => {
    mobileNavRef.current?.querySelector('.nav-link.active')?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [pathname])

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
        <p className="sidebar-note">{user?.email ?? 'Votre espace de décision, en toute clarté.'}</p>
      </aside>
      <main className="main-content">{children}</main>
      <nav ref={mobileNavRef} className="mobile-navigation" aria-label="Navigation principale">
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <Icon size={20} aria-hidden="true" /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}