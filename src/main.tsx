import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthProvider'
import { CurrencyProvider } from './features/budget/CurrencyProvider'
import './index.css'
import './modern-components.css'
import App from './App.tsx'

const preloadRetryKey = 'horizon-vite-preload-retry'

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  if (sessionStorage.getItem(preloadRetryKey)) return
  sessionStorage.setItem(preloadRetryKey, 'true')
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CurrencyProvider>
          <App />
        </CurrencyProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
