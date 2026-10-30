import type { BudgetSummary } from './budget-engine'
import { formatAmount } from './money'
import type { UpcomingCommitment } from './projection'

export type Recommendation = {
  level: 'alert' | 'warning' | 'good'
  title: string
  message: string
}

export function getRecommendations(summary: BudgetSummary, upcoming: UpcomingCommitment[], formatCurrency = formatAmount): Recommendation[] {
  const recommendations: Recommendation[] = []

  if (summary.freeRemainder < 0) {
    recommendations.push({ level: 'alert', title: 'Reste libre negatif', message: `Votre projection depasse votre budget disponible de ${formatCurrency(Math.abs(summary.freeRemainder))} apres reserve.` })
  } else if (summary.projectedRemainder < summary.reserve) {
    recommendations.push({ level: 'warning', title: 'Reserve exposee', message: `Votre reste projete ne couvre pas entierement la reserve de ${formatCurrency(summary.reserve)}.` })
  } else {
    recommendations.push({ level: 'good', title: 'Marge disponible', message: `Vous conservez votre reserve et disposez de ${formatCurrency(summary.freeRemainder)} de reste libre projete.` })
  }

  if (upcoming.length > 0) {
    const total = upcoming.reduce((sum, commitment) => sum + commitment.amount, 0)
    recommendations.push({ level: 'warning', title: 'Echeances avant la paie', message: `${upcoming.length} echeance${upcoming.length > 1 ? 's' : ''} representent ${formatCurrency(total)} avant votre prochaine paie.` })
  }

  return recommendations
}