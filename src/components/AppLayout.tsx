import { BarChart3, CircleHelp, FolderCog, HandCoins, History, House, Settings2, Target, WalletCards } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
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
  const [hiddenTabs, setHiddenTabs] = useState({ left: false, right: false })

  const updateHiddenTabs = useCallback(() => {
    const nav = mobileNavRef.current
    if (!nav) return
    const left = nav.scrollLeft > 4
    const right = nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 4
    setHiddenTabs((current) => current.left === left && current.right === right ? current : { left, right })
  }, [])

  useEffect(() => {
    const nav = mobileNavRef.current
    const active = nav?.querySelector('.nav-link.active')
    if (nav && active) {
      const tab = active.getBoundingClientRect()
      const bar = nav.getBoundingClientRect()
      if (tab.left < bar.left + 12 || tab.right > bar.right - 12) {
        nav.scrollTo({ left: nav.scrollLeft + (tab.left + tab.width / 2) - (bar.left + bar.width / 2) })
      }
    }
    updateHiddenTabs()
  }, [pathname, updateHiddenTabs])

  useEffect(() => {
    window.addEventListener('resize', updateHiddenTabs)
    return () => window.removeEventListener('resize', updateHiddenTabs)
  }, [updateHiddenTabs])

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
      <nav ref={mobileNavRef} onScroll={updateHiddenTabs} className={`mobile-navigation${hiddenTabs.left ? ' has-left' : ''}${hiddenTabs.right ? ' has-right' : ''}`} aria-label="Navigation principale">
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <Icon size={20} aria-hidden="true" /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}