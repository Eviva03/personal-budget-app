import { X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import {
  createCommitment,
  createTransaction,
  listCategories,
} from "./budget-repository";
import { convertAmount, parseAmount } from "./money";
import type { Category } from "./types";
import { useCurrency } from "./CurrencyProvider";

type AddBudgetModalProps = {
  userId: string;
  onClose: () => void;
  onCreated: () => void;
};
type EntryType = "transaction" | "income" | "commitment";
type DatabaseError = {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
};

const today = new Date().toISOString().slice(0, 10);

export function AddBudgetModal({
  userId,
  onClose,
  onCreated,
}: AddBudgetModalProps) {
  const { budgetCurrency, displayCurrency } = useCurrency();
  const [entryType, setEntryType] = useState<EntryType>("transaction");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [frequency, setFrequency] = useState("once");
  const [installmentCount, setInstallmentCount] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void listCategories(userId)
      .then(setCategories)
      .catch(() => undefined);
  }, [userId]);

  function chooseEntryType(nextType: EntryType) {
    setEntryType(nextType);
    const categoryType = nextType === "income" ? "income" : "expense";
    const selectedCategory = categories.find(
      (category) => category.type === categoryType,
    );
    setCategoryId(selectedCategory?.id ?? "");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const displayedAmount = parseAmount(amount);
    const parsedAmount = displayedAmount === null ? null : convertAmount(displayedAmount, displayCurrency, budgetCurrency);
    if (!parsedAmount) {
      setError("Saisissez un montant supérieur à zéro.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (entryType === "transaction" || entryType === "income") {
        if (entryType === "income" && !categoryId) {
          setError("Choisissez une catégorie de revenu.");
          return;
        }
        await createTransaction(userId, {
          amount: parsedAmount,
          description,
          occurred_at: date,
          category_id: categoryId || null,
          direction: entryType === "income" ? "income" : "expense",
          source: "manual",
        });
      } else
        await createCommitment(userId, {
          amount: parsedAmount,
          description,
          due_date: date,
          frequency: frequency as "once" | "weekly" | "monthly" | "yearly",
          installment_count:
            frequency === "monthly" && installmentCount
              ? Number(installmentCount)
              : null,
          category_id: categoryId || null,
        });
      onCreated();
      onClose();
    } catch (requestError) {
      const databaseError = requestError as DatabaseError;
      const detail = [
        databaseError.message,
        databaseError.details,
        databaseError.hint,
      ]
        .filter(
          (value): value is string =>
            typeof value === "string" && value.length > 0,
        )
        .join(" ");
      setError(detail || "Impossible d’enregistrer cette donnée.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section
        className="entry-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-title"
      >
        <button
          className="icon-button"
          type="button"
          onClick={onClose}
          aria-label="Fermer"
        >
          <X size={20} />
        </button>
        <p className="eyebrow">NOUVELLE DONNÉE</p>
        <h2 id="entry-title">Ajouter</h2>
        <form className="entry-form" onSubmit={submit}>
          <div className="entry-type">
            <button
              type="button"
              className={entryType === "transaction" ? "selected" : ""}
              onClick={() => chooseEntryType("transaction")}
            >
              Dépense
            </button>
            <button
              type="button"
              className={entryType === "income" ? "selected" : ""}
              onClick={() => chooseEntryType("income")}
            >
              Revenu ponctuel
            </button>
            <button
              type="button"
              className={entryType === "commitment" ? "selected" : ""}
              onClick={() => chooseEntryType("commitment")}
            >
              Engagement
            </button>
          </div>
          <label htmlFor="entry-description">Description</label>
          <input
            id="entry-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
            maxLength={200}
            placeholder={entryType === "income" ? "Ex. Prime, don, remboursement" : "Ex. Courses"}
          />
          <label htmlFor="entry-amount">{entryType === "income" ? `Montant reçu (${displayCurrency})` : `Montant par échéance (${displayCurrency})`}</label>
          <input
            id="entry-amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
            placeholder="0,00"
          />
          <label htmlFor="entry-date">
            {entryType === "commitment" ? "Première échéance" : "Date de réception"}
          </label>
          <input
            id="entry-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
          {entryType === "commitment" && (
            <>
              <label htmlFor="entry-frequency">Fréquence</label>
              <select
                id="entry-frequency"
                value={frequency}
                onChange={(event) => setFrequency(event.target.value)}
              >
                <option value="once">Unique</option>
                <option value="weekly">Hebdomadaire</option>
                <option value="monthly">Mensuelle</option>
                <option value="yearly">Annuelle</option>
              </select>
              {frequency === "monthly" && (
                <>
                  <label htmlFor="entry-installments">
                    Nombre de mensualités{" "}
                    <small>(laisser vide pour sans fin)</small>
                  </label>
                  <input
                    id="entry-installments"
                    type="number"
                    min="2"
                    step="1"
                    value={installmentCount}
                    onChange={(event) =>
                      setInstallmentCount(event.target.value)
                    }
                    placeholder="Ex. 3"
                  />
                </>
              )}
            </>
          )}
          <label htmlFor="entry-category">Catégorie</label>
          <select
            id="entry-category"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            {entryType !== "income" && <option value="">Sans catégorie</option>}
            {categories.filter((category) => entryType === "income" ? category.type === "income" : category.type === "expense").map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {error && (
            <p className="form-message" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </form>
      </section>
    </div>
  );
}
