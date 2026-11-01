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

    if (summary.projectedRemainder < 0) {
      recommendations.push({ level: 'alert', title: 'Budget dépassé', message: `Vos dépenses, engagements et affectations dépassent vos revenus de ${formatCurrency(Math.abs(summary.projectedRemainder))}, avant même la réserve.` })
    } else if (summary.freeRemainder < 0) {
      recommendations.push({ level: 'warning', title: 'Réserve exposée', message: `Votre reste projeté ne couvre pas entièrement la réserve de ${formatCurrency(summary.reserve)} : il manque ${formatCurrency(Math.abs(summary.freeRemainder))}.` })
  } else {
    recommendations.push({ level: 'good', title: 'Marge disponible', message: `Vous conservez votre réserve et disposez de ${formatCurrency(summary.freeRemainder)} de reste libre projeté.` })
  }

  if (upcoming.length > 0) {
    const total = upcoming.reduce((sum, commitment) => sum + commitment.amount, 0)
    recommendations.push({ level: 'warning', title: 'Échéances avant la paie', message: `${upcoming.length} échéance${upcoming.length > 1 ? 's' : ''} représentent ${formatCurrency(total)} avant votre prochaine paie.` })
  }

  return recommendations
}