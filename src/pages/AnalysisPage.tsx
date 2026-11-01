import {
  CalendarDays,
  CircleDollarSign,
  Sparkles,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../features/auth/useAuth";
import { categoryBreakdown, isExpense } from "../features/budget/analysis";
import { calculateBudget } from "../features/budget/budget-engine";
import {
  aiDailyLimit,
  getAiUsageToday,
  getBudgetSettings,
  listCategories,
  listCommitments,
  listGoalAllocations,
  listTransactions,
} from "../features/budget/budget-repository";
import { useCurrency } from "../features/budget/CurrencyProvider";
import { todayIso } from "../features/budget/dates";
import { confirmGeminiConsent } from "../features/budget/gemini-consent";
import { forecastUntilPayday, spendingByDay } from "../features/budget/projection";
import type { BudgetSettings, Category, Commitment, GoalAllocation, Transaction } from "../features/budget/types";
import { neon } from "../lib/neon";
import "./pages.css";

type AnalysisInsight = {
  summary: string;
  risks: string[];
  anomalies: string[];
  recommendations: string[];
  tone?: "good" | "watch" | "alert";
};
type SavedInsight = { insight: AnalysisInsight; at: string };

const toneLabels = { good: "Situation saine", watch: "À surveiller", alert: "Alerte" } as const;

function savedInsightKey(userId: string) {
  return `horizon-analysis-insight:${userId}`;
}

function readSavedInsight(userId: string): SavedInsight | null {
  try {
    const raw = window.sessionStorage.getItem(savedInsightKey(userId));
    return raw ? (JSON.parse(raw) as SavedInsight) : null;
  } catch {
    return null;
  }
}

export function AnalysisPage() {
  const { user } = useAuth();
  const { formatAmount, displayCurrency } = useCurrency();
  const [settings, setSettings] = useState<BudgetSettings | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allocations, setAllocations] = useState<GoalAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<SavedInsight | null>(() => (user ? readSavedInsight(user.id) : null));
  const [startOfToday] = useState(() => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    return day;
  });
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantMessage, setAssistantMessage] = useState("");
  const [usage, setUsage] = useState<number | null>(null);
  const userId = user?.id;

  const loadUsage = useCallback(async () => {
    if (!userId) return;
    try { setUsage(await getAiUsageToday(userId)); } catch { setUsage(null); }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void loadUsage();
    const load = async () => {
      try {
        const [nextSettings, nextCommitments, nextTransactions, nextCategories, nextAllocations] = await Promise.all([
          getBudgetSettings(userId),
          listCommitments(userId),
          listTransactions(userId),
          listCategories(userId),
          listGoalAllocations(userId),
        ]);
        if (!nextSettings) {
          setError("Configurez votre budget depuis l’accueil pour voir votre projection.");
          return;
        }
        setError("");
        setSettings(nextSettings);
        setCommitments(nextCommitments);
        setTransactions(nextTransactions);
        setCategories(nextCategories);
        setAllocations(nextAllocations);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger votre analyse.");
      } finally {
        setLoading(false);
      }
    };
    void load();
    window.addEventListener("budget-data-changed", load);
    return () => window.removeEventListener("budget-data-changed", load);
  }, [userId, loadUsage]);

  // Same engine as the home page, so both pages always show the same remaining amount.
  const analysis = useMemo(() => {
    if (!settings) return null;
    const summary = calculateBudget({ monthlyIncome: settings.monthly_income, reserve: settings.reserve_amount, transactions, commitments, categories, allocations });
    const forecast = forecastUntilPayday(summary.freeRemainder, commitments, settings.payday_day);
    const byId = new Map(categories.map((category) => [category.id, category]));
    const spending = spendingByDay(transactions.filter((transaction) => isExpense(transaction, byId)));
    const daysUntilPayday = Math.max(0, Math.round((forecast.payday.getTime() - startOfToday.getTime()) / 86_400_000));
    return {
      summary,
      forecast,
      spending,
      daysUntilPayday,
      upcomingTotal: forecast.upcomingCommitments.reduce((total, item) => total + item.amount, 0),
      breakdown: categoryBreakdown(transactions, categories),
    };
  }, [settings, transactions, commitments, categories, allocations, startOfToday]);

  async function runAnalysisAssistant() {
    if (!userId || !confirmGeminiConsent()) return;
    if (!neon) {
      setAssistantMessage("L’assistant nécessite une session Neon configurée.");
      return;
    }
    const { data: sessionData } = await neon.auth.getSession();
    if (!sessionData.session) {
      setAssistantMessage("Connectez-vous avant d’utiliser l’assistant.");
      return;
    }
    setAssistantLoading(true);
    setAssistantMessage("");
    try {
      const response = await fetch("/api/analysis-assistant", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${sessionData.session.access_token}` },
        body: JSON.stringify({ today: todayIso(), displayCurrency }),
      });
      const body = (await response.json()) as {
        error?: string;
        insight?: AnalysisInsight;
        costWarning?: boolean;
      };
      if (!response.ok || !body.insight) {
        setAssistantMessage(body.error || "L’assistant est indisponible.");
        return;
      }
      const next: SavedInsight = { insight: body.insight, at: new Date().toISOString() };
      setSaved(next);
      // Kept for the browser session so leaving the page does not spend another daily analysis.
      try { window.sessionStorage.setItem(savedInsightKey(userId), JSON.stringify(next)); } catch { /* storage unavailable */ }
      setAssistantMessage(body.costWarning ? "Analyse reçue. La limite quotidienne de l’assistant approche." : "");
    } catch {
      setAssistantMessage("Impossible de joindre l’assistant. Réessayez dans un instant.");
    } finally {
      setAssistantLoading(false);
      void loadUsage();
    }
  }

  const limitReached = usage !== null && usage >= aiDailyLimit;
  const insight = saved?.insight ?? null;
  const maxAmount = Math.max(...(analysis?.spending.map((point) => point.amount) ?? []), 1);

  return (
    <section className="analysis-page">
      <p className="eyebrow">COMPRENDRE</p>
      <h1>Projection.</h1>
      <p className="description">
        Cette page examine la période avant votre prochaine paie : les échéances à couvrir, vos dépenses du mois par catégorie et le montant qu’il vous reste. Gemini peut ensuite proposer une lecture, mais ne modifie jamais votre budget.
      </p>
      {loading ? (
        <p className="app-loading app-loading-inline" role="status"><span className="spinner" aria-hidden="true" />Chargement...</p>
      ) : error || !analysis || !settings ? (
        <div className="placeholder-card">
          <span className="status-dot" />
          <p>{error || "Impossible de charger votre analyse."}</p>
        </div>
      ) : (
        <>
          <div className="analysis-overview">
            <article className="analysis-metric">
              <CalendarDays size={19} />
              <span>Prochaine paie</span>
              <strong>
                {analysis.daysUntilPayday === 0
                  ? "Aujourd’hui"
                  : `${analysis.daysUntilPayday} jour${analysis.daysUntilPayday > 1 ? "s" : ""}`}
              </strong>
            </article>
            <article className="analysis-metric expense-metric">
              <TrendingDown size={19} />
              <span>Dépenses ce mois-ci</span>
              <strong>{formatAmount(analysis.summary.realisedExpenses)}</strong>
            </article>
            <article className={`analysis-metric${analysis.summary.freeRemainder < 0 ? " expense-metric" : ""}`}>
              <CircleDollarSign size={19} />
              <span>Reste libre</span>
              <strong>{formatAmount(analysis.summary.freeRemainder)}</strong>
            </article>
            <article className={`analysis-metric${analysis.forecast.dailyAllowance < 0 ? " expense-metric" : ""}`} title="Montant disponible par jour jusqu’à la prochaine paie">
              <Wallet size={19} />
              <span>Par jour</span>
              <strong>{formatAmount(analysis.forecast.dailyAllowance)}</strong>
            </article>
          </div>
          <section className="analysis-assistant" aria-live="polite">
            <div className="analysis-assistant-heading">
              <div>
                <p className="panel-label">RESTE LIBRE</p>
                <h2>
                  {analysis.summary.freeRemainder >= 0
                    ? `${formatAmount(analysis.summary.freeRemainder)} disponible.`
                    : `${formatAmount(Math.abs(analysis.summary.freeRemainder))} de dépassement.`}
                </h2>
                <p className="analysis-assistant-message">
                  Revenus du mois {formatAmount(analysis.summary.totalIncome)}, moins {formatAmount(analysis.summary.realisedExpenses)} déjà dépensés, {formatAmount(analysis.summary.projectedCommitments)} d’engagements et {formatAmount(analysis.summary.reserve)} de réserve.
                </p>
              </div>
              <div className="analysis-assistant-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void runAnalysisAssistant()}
                  disabled={assistantLoading || limitReached}
                >
                  <Sparkles size={17} aria-hidden="true" />
                  {assistantLoading ? "Analyse en cours..." : insight ? "Actualiser l’analyse" : "Enrichir avec Gemini"}
                </button>
                {usage !== null && (
                  <small className="analysis-usage">
                    {limitReached ? "Limite quotidienne atteinte, retour demain." : `Analyses du jour : ${usage}/${aiDailyLimit}`}
                  </small>
                )}
              </div>
            </div>
            {assistantMessage && (
              <p className="analysis-assistant-message">{assistantMessage}</p>
            )}
            {insight && (
              <div className="analysis-insight">
                <div className="analysis-insight-meta">
                  {insight.tone && <span className={`analysis-tone analysis-tone-${insight.tone}`}>{toneLabels[insight.tone]}</span>}
                  {saved && <time dateTime={saved.at}>Analyse de {new Date(saved.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</time>}
                </div>
                <p className="analysis-insight-summary">{insight.summary}</p>
                <div className="analysis-insight-groups">
                  <section>
                    <h3>Risques</h3>
                    {insight.risks.length > 0 ? (
                      <ul>{insight.risks.map((risk, index) => <li key={index}>{risk}</li>)}</ul>
                    ) : (
                      <p>Aucun risque particulier signalé.</p>
                    )}
                  </section>
                  <section>
                    <h3>Dépenses inhabituelles</h3>
                    {insight.anomalies.length > 0 ? (
                      <ul>{insight.anomalies.map((anomaly, index) => <li key={index}>{anomaly}</li>)}</ul>
                    ) : (
                      <p>Aucune anomalie identifiée.</p>
                    )}
                  </section>
                  <section>
                    <h3>Pistes</h3>
                    <ul>{insight.recommendations.map((recommendation, index) => <li key={index}>{recommendation}</li>)}</ul>
                  </section>
                </div>
              </div>
            )}
          </section>
          <div className="analysis-grid">
            <article className="analysis-panel">
              <div className="analysis-panel-heading">
                <div>
                  <p className="panel-label">PROCHAINE PAIE</p>
                  <strong className="payday-date">
                    {analysis.forecast.payday.toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                    })}
                  </strong>
                </div>
                <span className="analysis-total">
                  {formatAmount(analysis.upcomingTotal)}
                </span>
              </div>
              <p className="panel-subtitle">
                {analysis.forecast.upcomingCommitments.length} échéance{analysis.forecast.upcomingCommitments.length > 1 ? "s" : ""} à
                couvrir avant cette date
              </p>
              <ol className="timeline">
                {analysis.forecast.upcomingCommitments.length === 0 ? (
                  <li className="timeline-empty">
                    Aucune échéance avant la prochaine paie.
                  </li>
                ) : (
                  analysis.forecast.upcomingCommitments.map((item) => (
                    <li key={item.id}>
                      <time>
                        {new Date(
                          `${item.nextDueDate}T00:00:00`,
                        ).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                        })}
                      </time>
                      <div>
                        <strong>{item.description}</strong>
                        <span>
                          {item.frequency === "once"
                            ? "Ponctuel"
                            : item.installment_count
                              ? `Mensualité sur ${item.installment_count}`
                              : "Engagement récurrent"}
                        </span>
                      </div>
                      <b>{formatAmount(item.amount)}</b>
                    </li>
                  ))
                )}
              </ol>
            </article>
            <article className="analysis-panel">
              <div className="analysis-panel-heading">
                <div>
                  <p className="panel-label">DÉPENSES DU MOIS</p>
                  <strong className="chart-title">Par jour</strong>
                </div>
                <span className="analysis-total expense-total">
                  {formatAmount(analysis.summary.realisedExpenses)}
                </span>
              </div>
              <div className="spending-chart-scroll">
                <div
                  className="spending-chart"
                  role="img"
                  aria-label={`Dépenses par jour : ${analysis.spending.map((point) => `${point.label} ${formatAmount(point.amount)}`).join(", ") || "aucune"}`}
                >
                  {analysis.spending.length === 0 ? (
                    <p>Aucune dépense enregistrée ce mois-ci.</p>
                  ) : (
                    analysis.spending.map((point) => (
                      <div className="chart-column" key={point.label} title={`${point.label} : ${formatAmount(point.amount)}`}>
                        <span>{formatAmount(point.amount)}</span>
                        <i
                          style={{
                            height: `${Math.max(8, (point.amount / maxAmount) * 150)}px`,
                          }}
                        />
                        <small>{point.label}</small>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </article>
          </div>
          <article className="analysis-panel analysis-categories">
            <div className="analysis-panel-heading">
              <div>
                <p className="panel-label">PAR CATÉGORIE</p>
                <strong className="chart-title">Où part l’argent ce mois-ci</strong>
              </div>
              <span className="analysis-total expense-total">
                {formatAmount(analysis.summary.realisedExpenses)}
              </span>
            </div>
            {analysis.breakdown.length === 0 ? (
              <p className="panel-subtitle">Aucune dépense enregistrée ce mois-ci : le détail par catégorie apparaîtra dès la première.</p>
            ) : (
              <ul className="category-spend">
                {analysis.breakdown.map((row) => {
                  const difference = row.current - row.previous;
                  const delta = row.previous === 0
                    ? "Nouveau ce mois-ci"
                    : difference === 0
                      ? "Stable vs mois dernier"
                      : `${difference > 0 ? "+" : "−"}${formatAmount(Math.abs(difference))} vs mois dernier`;
                  return (
                    <li key={row.id ?? "none"}>
                      <span className="category-spend-dot" style={{ background: row.color }} aria-hidden="true" />
                      <div className="category-spend-main">
                        <strong>{row.name} <small>{Math.round(row.share * 100)} %</small></strong>
                        <div className="category-spend-bar" role="img" aria-label={`${Math.round(row.share * 100)} % des dépenses`}>
                          <i style={{ width: `${Math.max(2, row.share * 100)}%`, background: row.color }} />
                        </div>
                      </div>
                      <div className="category-spend-figures">
                        <b>{formatAmount(row.current)}</b>
                        <small className={row.previous === 0 || difference === 0 ? "" : difference > 0 ? "category-spend-up" : "category-spend-down"}>{delta}</small>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>
        </>
      )}
    </section>
  );
}