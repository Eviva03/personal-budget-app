import { Banknote, Bus, CreditCard, Dumbbell, House, ShoppingBag, Smartphone, Tag, Utensils } from 'lucide-react'
import type { CategoryIconName } from './types'

const categoryIconOptions: { name: CategoryIconName; label: string }[] = [
  { name: 'tag', label: 'Etiquette' }, { name: 'credit-card', label: 'Carte' }, { name: 'smartphone', label: 'Telephone' },
  { name: 'house', label: 'Logement' }, { name: 'bus', label: 'Transport' }, { name: 'shopping-bag', label: 'Achats' },
  { name: 'dumbbell', label: 'Sport' }, { name: 'utensils', label: 'Alimentation' }, { name: 'banknote', label: 'Revenu' },
]

const icons = { banknote: Banknote, bus: Bus, 'credit-card': CreditCard, dumbbell: Dumbbell, house: House, 'shopping-bag': ShoppingBag, smartphone: Smartphone, tag: Tag, utensils: Utensils }

export function CategoryIconOptions() {
  return <>{categoryIconOptions.map((option) => <option key={option.name} value={option.name}>{option.label}</option>)}</>
}

export function CategoryIcon({ name, size = 16 }: { name?: CategoryIconName | null; size?: number }) {
  const Icon = icons[name ?? 'tag']
  return <Icon size={size} aria-hidden="true" />
}