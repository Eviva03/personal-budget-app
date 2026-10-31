const consentKey = 'horizon-gemini-consent'

export function confirmGeminiConsent() {
  if (window.localStorage.getItem(consentKey) === 'accepted') return true
  const accepted = window.confirm('Pour utiliser Gemini, Horizon enverra les informations sélectionnées à Google afin de produire une proposition. Aucune donnée ne sera modifiée automatiquement. Souhaitez-vous continuer ?')
  if (accepted) window.localStorage.setItem(consentKey, 'accepted')
  return accepted
}