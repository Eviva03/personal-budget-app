import { Check, Download, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../features/auth/useAuth";
import { CategoryIcon } from "../features/budget/category-icon";
import {
  deleteTransaction,
  listCategories,
  listTransactions,
  updateTransaction,
} from "../features/budget/budget-repository";
import { useCurrency } from "../features/budget/CurrencyProvider";
import { TransactionImport } from "../features/budget/TransactionImport";
import { transactionsToCsv } from "../features/budget/transaction-export";
import type {
  Category,
  NewTransaction,
  Transaction,
} from "../features/budget/types";
import "./pages.css";

function CategoryBadge({ category }: { category?: Category }) {
  return category ? (
    <span
      className="category-chip"
      style={{ "--category-color": category.color } as React.CSSProperties}
    >
      <CategoryIcon name={category.icon} size={14} />
      {category.name}
    </span>
  ) : (
    <>Sans catégorie</>
  );
}

export function TransactionsPage() {
  const { user } = useAuth();
  const { budgetCurrency, formatAmount } = useCurrency();
  const [items, setItems] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [direction, setDirection] = useState("");
  const [reviewStatus, setReviewFilter] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = () => {
      setLoading(true);
      void Promise.all([listTransactions(user.id), listCategories(user.id)])
        .then(([transactions, availableCategories]) => {
          setItems(transactions);
          setCategories(availableCategories);
        })
        .catch((loadError: unknown) =>
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossible de charger les transactions.",
          ),
        )
        .finally(() => setLoading(false));
    };
    load();
    window.addEventListener("budget-data-changed", load);
    return () => window.removeEventListener("budget-data-changed", load);
  }, [user]);

  const filtered = items
    .filter(
      (item) =>
        (!query ||
          item.description.toLowerCase().includes(query.toLowerCase())) &&
        (!from || item.occurred_at >= from) &&
        (!to || item.occurred_at <= to) &&
        (!categoryId || item.category_id === categoryId) &&
        (!direction || (item.direction ?? categories.find((category) => category.id === item.category_id)?.type ?? "expense") === direction) &&
        (!reviewStatus || (item.review_status ?? "confirmed") === reviewStatus),
    )
    .sort((left, right) =>
      sortBy === "amount"
        ? right.amount - left.amount
        : sortBy === "name"
          ? left.description.localeCompare(right.description, "fr")
          : right.occurred_at.localeCompare(left.occurred_at),
    );

  function exportCsv() {
    const content = transactionsToCsv(filtered, categories);
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8" }),
    );
    const link = window.document.createElement("a");
    link.href = url;
    link.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function saveEdit() {
    if (!user || !editing || !editing.description.trim() || editing.amount <= 0)
      return;
    setSaving(true);
    try {
      const changes: NewTransaction = {
        description: editing.description.trim(),
        amount: editing.amount,
        occurred_at: editing.occurred_at,
        category_id: editing.category_id,
        direction: editing.direction ?? "expense",
      };
      await updateTransaction(user.id, editing.id, changes);
      setItems((current) =>
        current.map((item) =>
          item.id === editing.id ? { ...item, ...changes } : item,
        ),
      );
      setEditing(null);
      window.dispatchEvent(new Event("budget-data-changed"));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Impossible de modifier la transaction.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: Transaction) {
    if (!user || !window.confirm(`Supprimer « ${item.description} » ?`)) return;
    try {
      await deleteTransaction(user.id, item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      window.dispatchEvent(new Event("budget-data-changed"));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Impossible de supprimer la transaction.",
      );
    }
  }

  async function setReviewStatus(item: Transaction, status: "confirmed" | "ignored") {
    if (!user) return;
    try {
      await updateTransaction(user.id, item.id, { review_status: status });
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, review_status: status } : entry));
      window.dispatchEvent(new Event("budget-data-changed"));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Impossible de mettre à jour le rapprochement.");
    }
  }

  return (
    <section className="page-placeholder">
      <p className="eyebrow">SUIVI</p>
      <h1>Transactions</h1>
      <p className="description">
        Chaque entrée et sortie apparaît ici. Après un import, vérifiez les lignes marquées « À vérifier », puis confirmez-les ou ignorez-les avant de vous y fier.
      </p>
      {user && (
        <TransactionImport
          userId={user.id}
          onImported={() =>
            window.dispatchEvent(new Event("budget-data-changed"))
          }
        />
      )}
      {loading ? (
        <p>Chargement...</p>
      ) : error ? (
        <p className="form-message">{error}</p>
      ) : items.length === 0 ? (
        <div className="placeholder-card">
          <span className="status-dot" />
          <p>
            Aucune transaction pour le moment. Utilisez le bouton + pour en
            ajouter une.
          </p>
        </div>
      ) : (
        <>
          <div className="list-toolbar transaction-toolbar">
            <input
              aria-label="Rechercher une transaction"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher"
            />
            <input
              aria-label="Date de début"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
            <input
              aria-label="Date de fin"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
            <select
              aria-label="Filtrer par catégorie"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">Toutes les catégories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrer par sens"
              value={direction}
              onChange={(event) => setDirection(event.target.value)}
            >
              <option value="">Toutes les entrées et sorties</option>
              <option value="income">Entrées</option>
              <option value="expense">Sorties</option>
            </select>
            <select
              aria-label="Filtrer par statut de rapprochement"
              value={reviewStatus}
              onChange={(event) => setReviewFilter(event.target.value)}
            >
              <option value="">Tous les statuts</option>
              <option value="needs_review">À vérifier</option>
              <option value="confirmed">Confirmées</option>
              <option value="ignored">Ignorées</option>
            </select>
            <select
              aria-label="Trier les transactions"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              <option value="date">Trier par date</option>
              <option value="amount">Trier par montant</option>
              <option value="name">Trier par nom</option>
            </select>
            <button
              className="icon-button filter-action"
              type="button"
              title="Exporter le résultat CSV"
              aria-label="Exporter le résultat CSV"
              onClick={exportCsv}
            >
              <Download size={18} />
            </button>
          </div>
          <p className="filter-count">
            {filtered.length} transaction(s) affichée(s)
          </p>
          {filtered.length === 0 ? (
            <div className="placeholder-card">
              <span className="status-dot" />
              <p>Aucune transaction ne correspond aux filtres.</p>
            </div>
          ) : (
            <ul className="data-list transaction-list">
              {filtered.map((item) => {
                const category = categories.find(
                  (entry) => entry.id === item.category_id,
                );
                const itemDirection = item.direction ?? category?.type ?? "expense";

                return (
                <li
                  key={item.id}
                  className={
                    itemDirection === "income"
                      ? "transaction-income"
                      : "transaction-expense"
                  }
                >
                  <div>
                    <strong>{item.description}</strong>
                    <span>
                      {new Date(
                        `${item.occurred_at}T00:00:00`,
                      ).toLocaleDateString("fr-FR")}{" "}
                      ·{" "}
                      <CategoryBadge category={category} />
                      {(item.review_status ?? "confirmed") === "needs_review" && " · À vérifier"}
                    </span>
                  </div>
                  <strong>{itemDirection === "income" ? "+" : "-"}{formatAmount(item.amount)}</strong>
                  <div className="row-actions">
                    {item.review_status === "needs_review" && <>
                      <button
                        className="icon-button"
                        type="button"
                        title="Confirmer le mouvement"
                        aria-label={`Confirmer ${item.description}`}
                        onClick={() => void setReviewStatus(item, "confirmed")}
                      >
                        <Check size={16} />
                      </button>
                      <button
                        className="icon-button"
                        type="button"
                        title="Ignorer le mouvement"
                        aria-label={`Ignorer ${item.description}`}
                        onClick={() => void setReviewStatus(item, "ignored")}
                      >
                        <X size={16} />
                      </button>
                    </>}
                    <button
                      className="icon-button"
                      type="button"
                      title="Modifier"
                      aria-label={`Modifier ${item.description}`}
                      onClick={() => setEditing({ ...item })}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="icon-button danger-button"
                      type="button"
                      title="Supprimer"
                      aria-label={`Supprimer ${item.description}`}
                      onClick={() => void remove(item)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
                );
              })}
            </ul>
          )}
        </>
      )}
      {editing && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(event) => { if (event.target === event.currentTarget) setEditing(null) }}
        >
          <section
            className="entry-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-transaction-title"
          >
            <button
              className="icon-button"
              type="button"
              onClick={() => setEditing(null)}
              aria-label="Fermer"
            >
              <X size={20} />
            </button>
            <p className="eyebrow">TRANSACTION</p>
            <h2 id="edit-transaction-title">Modifier</h2>
            <div className="entry-form">
              <label htmlFor="edit-description">Description</label>
              <input
                id="edit-description"
                value={editing.description}
                onChange={(event) =>
                  setEditing({ ...editing, description: event.target.value })
                }
                maxLength={200}
              />
              <label htmlFor="edit-amount">Montant ({budgetCurrency})</label>
              <input
                id="edit-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={editing.amount}
                onChange={(event) =>
                  setEditing({ ...editing, amount: Number(event.target.value) })
                }
              />
              <label htmlFor="edit-date">Date</label>
              <input
                id="edit-date"
                type="date"
                value={editing.occurred_at}
                onChange={(event) =>
                  setEditing({ ...editing, occurred_at: event.target.value })
                }
              />
              <label htmlFor="edit-category">Categorie</label>
              <select
                id="edit-category"
                value={editing.category_id ?? ""}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    category_id: event.target.value || null,
                  })
                }
              >
                <option value="">Sans categorie</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <label htmlFor="edit-direction">Sens du mouvement</label>
              <select
                id="edit-direction"
                value={editing.direction ?? "expense"}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    direction: event.target.value as "income" | "expense",
                  })
                }
              >
                <option value="expense">Sortie</option>
                <option value="income">Entree</option>
              </select>
              <button
                className="primary-button"
                type="button"
                onClick={() => void saveEdit()}
                disabled={saving}
              >
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
