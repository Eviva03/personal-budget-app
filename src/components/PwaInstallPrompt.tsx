import { Download, Share, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import './PwaInstallPrompt.css'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type InstallMode = 'browser' | 'ios' | null

function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isIosSafari() {
  return isIos() && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent)
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [mode, setMode] = useState<InstallMode>(() => {
    if (isInstalled() || sessionStorage.getItem('horizon-install-prompt-dismissed')) return null
    return isIosSafari() ? 'ios' : null
  })

  useEffect(() => {
    if (isInstalled() || sessionStorage.getItem('horizon-install-prompt-dismissed')) return

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
      setMode('browser')
    }
    window.addEventListener('beforeinstallprompt', handleInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
  }, [])

  function dismiss() {
    sessionStorage.setItem('horizon-install-prompt-dismissed', 'true')
    setMode(null)
  }

  async function install() {
    if (!installEvent) return
    await installEvent.prompt()
    await installEvent.userChoice
    setInstallEvent(null)
    setMode(null)
  }

  if (!mode) return null

  return (
    <aside className="pwa-install-prompt" aria-label="Installer Horizon">
      <div className="pwa-install-icon" aria-hidden="true">H</div>
      <div className="pwa-install-copy">
        <strong>Installer Horizon</strong>
        {mode === 'ios'
          ? <span>Dans Safari, touchez <Share size={15} aria-hidden="true" /> puis « Sur l’ecran d’accueil ».</span>
          : <span>Accedez a votre budget plus rapidement, meme hors ligne.</span>}
      </div>
      {mode === 'browser' && <button className="pwa-install-action" type="button" onClick={() => void install()}><Download size={17} aria-hidden="true" /> Installer</button>}
      <button className="pwa-install-close" type="button" onClick={dismiss} aria-label="Fermer la proposition d installation"><X size={18} aria-hidden="true" /></button>
    </aside>
  )
}