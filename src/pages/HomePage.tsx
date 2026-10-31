import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/useAuth";
import {
  calculateBudget,
  type BudgetSummary,
} from "../features/budget/budget-engine";
import {
  getBudgetSettings,
  listCategories,
  listCommitments,
  listTransactions,
  saveBudgetSettings,
} from "../features/budget/budget-repository";
import { useCurrency } from "../features/budget/CurrencyProvider";
import { convertAmount } from "../features/budget/money";
import { commitmentsUntilPayday, forecastUntilPayday, type PaydayForecast } from "../features/budget/projection";
import {
  getRecommendations,
  type Recommendation,
} from "../features/budget/recommendations";
import "./pages.css";

function parseNonNegative(value: string) {
  const amount = Number(value.replace(",", "."));
  return Number.isFinite(amount) && amount >= 0
    ? Math.round(amount * 100) / 100
    : null;
}

export function HomePage() {
  const { user } = useAuth();
  const { budgetCurrency, displayCurrency, formatAmount } = useCurrency();
  const [income, setIncome] = useState("");
  const [reserve, setReserve] = useState("");
  const [paydayDay, setPaydayDay] = useState("1");
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [forecast, setForecast] = useState<PaydayForecast | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [settings, transactions, commitments, categories] = await Promise.all([
          getBudgetSettings(userId),
          listTransactions(userId),
          listCommitments(userId),
          listCategories(userId),
        ]);
        if (settings) {
          const nextSummary = calculateBudget({
            monthlyIncome: settings.monthly_income,
            reserve: settings.reserve_amount,
            transactions,
            commitments,
            categories,
          });
          setIncome(String(convertAmount(settings.monthly_income, settings.budget_currency, settings.display_currency)));
          setReserve(String(convertAmount(settings.reserve_amount, settings.budget_currency, settings.display_currency)));
          setPaydayDay(String(settings.payday_day));
          setSummary(nextSummary);
          setForecast(forecastUntilPayday(nextSummary.freeRemainder, commitments, settings.payday_day));
          setRecommendations(
            getRecommendations(
              nextSummary,
              commitmentsUntilPayday(commitments, settings.payday_day),
              formatAmount,
            ),
          );
        }
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger votre budget.",
        );
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [user, budgetCurrency, displayCurrency]);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const displayedIncome = parseNonNegative(income);
    const displayedReserve = parseNonNegative(reserve);
    const monthlyIncome = displayedIncome === null ? null : convertAmount(displayedIncome, displayCurrency, budgetCurrency);
    const reserveAmount = displayedReserve === null ? null : convertAmount(displayedReserve, displayCurrency, budgetCurrency);
    const payday = Number(paydayDay);
    if (
      monthlyIncome === null ||
      reserveAmount === null ||
      !user ||
      !Number.isInteger(payday) ||
      payday < 1 ||
      payday > 28
    ) {
      setError(
        "Saisissez des montants valides et un jour de paie entre 1 et 28.",
      );
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveBudgetSettings(user.id, {
        monthly_income: monthlyIncome,
        reserve_amount: reserveAmount,
        payday_day: payday,
      });
      const [transactions, commitments, categories] = await Promise.all([
        listTransactions(user.id),
        listCommitments(user.id),
        listCategories(user.id),
      ]);
      const nextSummary = calculateBudget({
        monthlyIncome,
        reserve: reserveAmount,
        transactions,
        commitments,
        categories,
      });
      setSummary(nextSummary);
      setForecast(forecastUntilPayday(nextSummary.freeRemainder, commitments, payday));
      setRecommendations(
        getRecommendations(
          nextSummary,
          commitmentsUntilPayday(commitments, payday),
          formatAmount,
        ),
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Impossible d’enregistrer les réglages.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="budget-dashboard">
      <p className="eyebrow">VUE D'ENSEMBLE</p>
      <h1>Ce mois-ci.</h1>
      <p className="description">
        Renseignez votre revenu, votre réserve et votre jour de paie. Horizon en déduit ce que vous pouvez utiliser ce mois-ci après vos dépenses et vos engagements.
      </p>
      <p className="home-trust">
        Votre budget, plus clair. Vos décisions, toujours les vôtres. {" "}
        <Link to="/decouvrir">Découvrir Horizon</Link>
      </p>
      {loading ? (
        <p>Chargement...</p>
      ) : (
        <>
          <form className="budget-settings" onSubmit={saveSettings}>
            <div>
              <label htmlFor="monthly-income">Revenu mensuel net ({displayCurrency})</label>
              <input
                id="monthly-income"
                inputMode="decimal"
                value={income}
                onChange={(event) => setIncome(event.target.value)}
                placeholder="Ex. 2500"
                required
              />
            </div>
            <div>
              <label htmlFor="reserve-amount">Réserve à conserver ({displayCurrency})</label>
              <input
                id="reserve-amount"
                inputMode="decimal"
                value={reserve}
                onChange={(event) => setReserve(event.target.value)}
                placeholder="Ex. 300"
                required
              />
            </div>
            <div>
              <label htmlFor="payday-day">Jour de paie</label>
              <input
                id="payday-day"
                type="number"
                min="1"
                max="28"
                value={paydayDay}
                onChange={(event) => setPaydayDay(event.target.value)}
                required
              />
            </div>
            <button className="primary-button" type="submit" disabled={saving}>
              {saving
                ? "Enregistrement..."
                : summary
                  ? "Mettre à jour"
                  : "Configurer mon budget"}
            </button>
          </form>
          {error && (
            <p className="form-message" role="alert">
              {error}
            </p>
          )}
          {summary ? (
            <>
              <div className="summary-grid">
                <article className="summary-card">
                  <span>Revenu mensuel</span>
                  <strong>{formatAmount(summary.monthlyIncome)}</strong>
                  <small>Récurrent</small>
                </article>
                <article className="summary-card emphasis">
                  <span>Revenus ponctuels</span>
                  <strong>{formatAmount(summary.additionalIncome)}</strong>
                  <small>Prime, don, remboursement</small>
                </article>
                <article className="summary-card">
                  <span>Dépenses réalisées</span>
                  <strong>{formatAmount(summary.realisedExpenses)}</strong>
                  <small>Ce mois</small>
                </article>
                <article className="summary-card">
                  <span>Engagements projetés</span>
                  <strong>{formatAmount(summary.projectedCommitments)}</strong>
                  <small>Mensualises</small>
                </article>
                <article className="summary-card emphasis">
                  <span>Reste projeté</span>
                  <strong>{formatAmount(summary.projectedRemainder)}</strong>
                  <small>Avant reserve</small>
                </article>
                <article className="summary-card">
                  <span>Réserve</span>
                  <strong>{formatAmount(summary.reserve)}</strong>
                  <small>À conserver</small>
                </article>
                <article
                  className={`summary-card ${summary.freeRemainder < 0 ? "negative" : "free"}`}
                >
                  <span>Reste libre</span>
                  <strong>{formatAmount(summary.freeRemainder)}</strong>
                  <small>Disponible après réserve</small>
                </article>
              </div>
              {forecast && <section className="payday-forecast" aria-label="Prévision jusqu’à la paie">
                <div><p className="eyebrow">JUSQU’À LA PAIE</p><h2>{formatAmount(forecast.dailyAllowance)} par jour</h2><p>Sur {forecast.daysRemaining} jour(s), jusqu’au {forecast.payday.toLocaleDateString("fr-FR")}. Ce montant respecte votre réserve et les engagements projetés.</p></div>
                <div className="forecast-commitments"><strong>{forecast.upcomingCommitments.length} échéance(s) avant la paie</strong>{forecast.upcomingCommitments.slice(0, 3).map((commitment) => <span key={commitment.id}>{commitment.description} · {formatAmount(commitment.amount)} le {new Date(`${commitment.nextDueDate}T00:00:00`).toLocaleDateString("fr-FR")}</span>)}</div>
              </section>}
              <section
                className="recommendations"
                aria-label="Recommandations budgetaires"
              >
                <p className="eyebrow">A RETENIR</p>
                {recommendations.map((recommendation) => (
                  <article
                    className={`recommendation ${recommendation.level}`}
                    key={recommendation.title}
                  >
                    <strong>{recommendation.title}</strong>
                    <p>{recommendation.message}</p>
                  </article>
                ))}
              </section>
            </>
          ) : (
            <div className="placeholder-card">
              <span className="status-dot" />
              <p>
                Configurez votre revenu mensuel, votre reserve et votre jour de
                paie pour obtenir votre projection.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
