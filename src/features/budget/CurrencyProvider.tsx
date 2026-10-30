import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import { useAuth } from '../auth/useAuth'
import { getBudgetSettings } from './budget-repository'
import { convertAmount, formatAmount as formatCurrencyAmount, type BudgetCurrency } from './money'

type CurrencyContextValue = {
  budgetCurrency: BudgetCurrency
  displayCurrency: BudgetCurrency
  formatAmount: (amount: number) => string
}

const CurrencyContext = createContext<CurrencyContextValue>({
  budgetCurrency: 'EUR',
  displayCurrency: 'EUR',
  formatAmount: (amount) => formatCurrencyAmount(amount),
})

export function CurrencyProvider({ children }: PropsWithChildren) {
  const { user } = useAuth()
  const [budgetCurrency, setBudgetCurrency] = useState<BudgetCurrency>('EUR')
  const [displayCurrency, setDisplayCurrency] = useState<BudgetCurrency>('EUR')

  useEffect(() => {
    let active = true
    async function loadCurrency() {
      if (!user) {
        setBudgetCurrency('EUR')
        setDisplayCurrency('EUR')
        return
      }
      try {
        const settings = await getBudgetSettings(user.id)
        if (active) {
          setBudgetCurrency(settings?.budget_currency ?? 'EUR')
          setDisplayCurrency(settings?.display_currency ?? settings?.budget_currency ?? 'EUR')
        }
      } catch {
        if (active) {
          setBudgetCurrency('EUR')
          setDisplayCurrency('EUR')
        }
      }
    }
    void loadCurrency()
    window.addEventListener('currency-settings-changed', loadCurrency)
    return () => {
      active = false
      window.removeEventListener('currency-settings-changed', loadCurrency)
    }
  }, [user])

  return <CurrencyContext.Provider value={{
    budgetCurrency,
    displayCurrency,
    formatAmount: (amount) => formatCurrencyAmount(convertAmount(amount, budgetCurrency, displayCurrency), displayCurrency),
  }}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  return useContext(CurrencyContext)
}