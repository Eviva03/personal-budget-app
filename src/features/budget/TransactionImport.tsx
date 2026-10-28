import { FileText, Upload, X } from "lucide-react";
import { useState, type ChangeEvent } from "react";
import {
  createCommitment,
  createTransaction,
  createTransactions,
  listCategories,
  listTransactions,
} from "./budget-repository";
import {
  parseTransactionsCsv,
  readImageText,
  readPdfText,
  transactionFingerprint,
  type ImportPreview,
} from "./document-import";
import {
  analyzeDocumentText,
  type DocumentAnalysis,
} from "./document-intelligence";
import { suggestImport } from "./import-suggestions";
import type {
  Category,
  CommitmentFrequency,
  NewCommitment,
  NewTransaction,
  Transaction,
} from "./types";
import { supabase } from "../../lib/supabase";

type TransactionImportProps = { userId: string; onImported: () => void };
type AssistantSuggestion = {
  id: string;
  categoryId: string | null;
  confidence: "low" | "medium" | "high";
  explanation: string;
};
type DocumentAssistantProposal = {
  kind: "bank_statement" | "invoice" | "receipt" | "unknown";
  description: string;
  amount: number | null;
  dueDate: string | null;
  categoryId: string | null;
  confidence: "low" | "medium" | "high";
  explanation: string;
};
const today = new Date().toISOString().slice(0, 10);

export function TransactionImport({
  userId,
  onImported,
}: TransactionImportProps) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [documentAnalysis, setDocumentAnalysis] =
    useState<DocumentAnalysis | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assistantSuggestions, setAssistantSuggestions] = useState<
    AssistantSuggestion[]
  >([]);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [documentProposal, setDocumentProposal] =
    useState<DocumentAssistantProposal | null>(null);
  const [documentAssistantLoading, setDocumentAssistantLoading] =
    useState(false);
  const [commitmentDraft, setCommitmentDraft] =
    useState<NewCommitment | null>(null);
  const [commitmentSaving, setCommitmentSaving] = useState(false);
  const [transactionDraft, setTransactionDraft] =
    useState<NewTransaction | null>(null);
  const [transactionSaving, setTransactionSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const fileName = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf" || fileName.endsWith(".pdf");
    const isImage =
      file.type === "image/jpeg" ||
      file.type === "image/png" ||
      /\.(jpe?g|png)$/.test(fileName);
    setMessage("");
    setPreview(null);
    setDocumentAnalysis(null);
    setDocumentProposal(null);
    setCommitmentDraft(null);
    setTransactionDraft(null);
    setAssistantSuggestions([]);
    setOcrProgress(null);
    try {
      const [nextPreview, availableCategories, transactions] = await Promise.all([
        isPdf
          ? readPdfText(file, setOcrProgress)
          : isImage
            ? readImageText(file, setOcrProgress)
            : file.text().then(parseTransactionsCsv),
        listCategories(userId),
        listTransactions(userId),
      ]);
      setCategories(availableCategories);
      setHistory(transactions);
      const analysis =
        nextPreview.pdfText
          ? analyzeDocumentText(nextPreview.pdfText, nextPreview.valid)
          : null;
      setDocumentAnalysis(analysis);
      const receipt = analysis?.kind === "receipt" ? analysis.invoice : null;
      if (receipt?.amount && receipt.amount > 0) {
        const draft: NewTransaction = {
          description: receipt.description,
          amount: receipt.amount,
          occurred_at: today,
          category_id: null,
        };
        setTransactionDraft({
          ...draft,
          category_id: suggestImport(
            draft,
            availableCategories,
            transactions,
          ).categoryId,
        });
      }
      setPreview({
        ...nextPreview,
        valid: nextPreview.valid.map((transaction) => ({
          ...transaction,
          category_id: suggestImport(
            transaction,
            availableCategories,
            transactions,
          ).categoryId,
        })),
      });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Impossible de lire ce document.",
      );
    } finally {
      setOcrProgress(null);
    }
  }
  function updateTransaction(
    index: number,
    field: keyof NewTransaction,
    value: string,
  ) {
    setPreview((current) =>
      current
        ? {
            ...current,
            valid: current.valid.map((transaction, currentIndex) =>
              currentIndex === index
                ? {
                    ...transaction,
                    [field]:
                      field === "amount"
                        ? Number(value)
                        : field === "category_id"
                          ? value || null
                          : value,
                  }
                : transaction,
            ),
          }
        : null,
    );
  }
  function formatRecurrence(recurrence: "weekly" | "monthly" | "yearly") {
    return recurrence === "weekly"
      ? "hebdomadaire"
      : recurrence === "monthly"
        ? "mensuelle"
        : "annuelle";
  }
  function documentKindLabel(kind: DocumentAnalysis["kind"]) {
    if (kind === "bank_statement") return "Releve bancaire";
    if (kind === "invoice") return "Facture";
    if (kind === "receipt") return "Ticket ou recu";
    return "Document a verifier";
  }
  async function improveWithAssistant() {
    if (!preview || !supabase) {
      setMessage("L assistant demande une session Supabase configuree.");
      return;
    }
    const lines = preview.valid
      .map((transaction, index) => ({
        transaction,
        index,
        suggestion: suggestImport(transaction, categories, history),
      }))
      .filter(({ suggestion }) => suggestion.confidence !== "high")
      .slice(0, 10);
    if (lines.length === 0) {
      setMessage("Les lignes importees ont deja des suggestions locales fiables.");
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setMessage("Connectez-vous avant d utiliser l assistant.");
      return;
    }
    setAssistantLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/import-assistant", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          lines: lines.map(({ transaction, index }) => ({
            id: String(index),
            description: transaction.description,
            amount: transaction.amount,
            occurredAt: transaction.occurred_at,
          })),
          categories: categories.map(({ id, name, type }) => ({ id, name, type })),
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        suggestions?: AssistantSuggestion[];
        costWarning?: boolean;
      };
      if (!response.ok) {
        setMessage(body.error || "L assistant est indisponible.");
        return;
      }
      setAssistantSuggestions(body.suggestions ?? []);
      setMessage(
        body.costWarning
          ? "Propositions recues. Le budget assistant mensuel approche 3 EUR."
          : "Propositions recues. Choisissez celles a appliquer.",
      );
    } catch {
      setMessage("Impossible de joindre l assistant.");
    } finally {
      setAssistantLoading(false);
    }
  }
  async function analyzeDocumentWithAssistant() {
    if (!preview?.pdfText || !supabase) {
      setMessage("Choisissez un document lisible et connectez-vous avant cette analyse.");
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setMessage("Connectez-vous avant d utiliser l assistant.");
      return;
    }
    setDocumentAssistantLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/document-assistant", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          text: preview.pdfText.slice(0, 12_000),
          categories: categories.map(({ id, name, type }) => ({ id, name, type })),
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        proposal?: DocumentAssistantProposal;
        costWarning?: boolean;
      };
      if (!response.ok || !body.proposal) {
        setMessage(body.error || "L assistant est indisponible.");
        return;
      }
      setDocumentProposal(body.proposal);
      setCommitmentDraft(
        body.proposal.kind === "invoice" &&
          body.proposal.amount !== null &&
          body.proposal.amount > 0 &&
          body.proposal.dueDate
          ? {
              description: body.proposal.description,
              amount: body.proposal.amount,
              due_date: body.proposal.dueDate,
              frequency: "once",
              installment_count: null,
              category_id: body.proposal.categoryId,
            }
          : null,
      );
      setTransactionDraft(
        body.proposal.kind === "receipt" &&
          body.proposal.amount !== null &&
          body.proposal.amount > 0
          ? {
              description: body.proposal.description,
              amount: body.proposal.amount,
              occurred_at: today,
              category_id: body.proposal.categoryId,
            }
          : null,
      );
      setMessage(
        body.costWarning
          ? "Analyse recue. Le budget assistant mensuel approche 3 EUR."
          : "Analyse recue. Verifiez la proposition avant toute saisie.",
      );
    } catch {
      setMessage("Impossible de joindre l assistant.");
    } finally {
      setDocumentAssistantLoading(false);
    }
  }
  function updateCommitmentDraft(
    field: keyof NewCommitment,
    value: string,
  ) {
    setCommitmentDraft((current) =>
      current
        ? {
            ...current,
            [field]:
              field === "amount"
                ? Number(value)
                : field === "category_id"
                  ? value || null
                  : value,
          }
        : null,
    );
  }
  async function createDocumentCommitment() {
    if (
      !commitmentDraft ||
      !commitmentDraft.description.trim() ||
      !commitmentDraft.due_date ||
      !Number.isFinite(commitmentDraft.amount) ||
      commitmentDraft.amount <= 0
    ) {
      setMessage("Corrigez le libelle, le montant et l echeance avant creation.");
      return;
    }
    if (!window.confirm("Creer cet engagement dans votre budget ?")) return;
    setCommitmentSaving(true);
    try {
      await createCommitment(userId, commitmentDraft);
      onImported();
      setCommitmentDraft(null);
      setMessage("Engagement cree a partir de la facture validee.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Impossible de creer cet engagement.",
      );
    } finally {
      setCommitmentSaving(false);
    }
  }
  function updateTransactionDraft(
    field: keyof NewTransaction,
    value: string,
  ) {
    setTransactionDraft((current) =>
      current
        ? {
            ...current,
            [field]:
              field === "amount"
                ? Number(value)
                : field === "category_id"
                  ? value || null
                  : value,
          }
        : null,
    );
  }
  async function createDocumentTransaction() {
    if (
      !transactionDraft ||
      !transactionDraft.description.trim() ||
      !transactionDraft.occurred_at ||
      !Number.isFinite(transactionDraft.amount) ||
      transactionDraft.amount <= 0
    ) {
      setMessage("Corrigez le libelle, le montant et la date avant creation.");
      return;
    }
    if (!window.confirm("Creer cette transaction dans votre budget ?")) return;
    setTransactionSaving(true);
    try {
      const existing = await listTransactions(userId);
      if (
        existing.some(
          (transaction) =>
            transactionFingerprint(transaction) ===
            transactionFingerprint(transactionDraft),
        )
      ) {
        setMessage("Cette transaction existe deja et n a pas ete creee.");
        return;
      }
      await createTransaction(userId, transactionDraft);
      onImported();
      setTransactionDraft(null);
      setMessage("Transaction creee a partir du ticket valide.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Impossible de creer cette transaction.",
      );
    } finally {
      setTransactionSaving(false);
    }
  }
  async function importValid() {
    if (!preview?.valid.length) return;
    if (
      preview.valid.some(
        (transaction) =>
          !transaction.description.trim() ||
          !transaction.occurred_at ||
          !Number.isFinite(transaction.amount) ||
          transaction.amount <= 0,
      )
    ) {
      setMessage(
        "Corrigez les lignes incompletes ou les montants invalides avant import.",
      );
      return;
    }
    setSaving(true);
    try {
      const existing = await listTransactions(userId);
      const fingerprints = new Set(existing.map(transactionFingerprint));
      const transactions = preview.valid.filter((transaction) => {
        const fingerprint = transactionFingerprint(transaction);
        if (fingerprints.has(fingerprint)) return false;
        fingerprints.add(fingerprint);
        return true;
      });
      if (transactions.length === 0) {
        setMessage(
          "Toutes les lignes existent deja et n ont pas ete importees.",
        );
        return;
      }
      await createTransactions(userId, transactions);
      onImported();
      setMessage(
        `${transactions.length} transaction(s) importee(s)${transactions.length < preview.valid.length ? `, ${preview.valid.length - transactions.length} doublon(s) ignore(s).` : "."}`,
      );
      setPreview(null);
    } catch (error) {
      const details =
        error instanceof Error
          ? [
              error.message,
              "details" in error && typeof error.details === "string"
                ? error.details
                : "",
              "hint" in error && typeof error.hint === "string"
                ? error.hint
                : "",
            ]
              .filter(Boolean)
              .join(" ")
          : "";
      setMessage(details || "Impossible d importer les transactions.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="transaction-import">
      <button
        className="import-trigger"
        type="button"
        onClick={() => setOpen(!open)}
      >
        <Upload size={18} />
        Importer un document
      </button>
      {open && (
        <div className="import-panel">
          <label className="file-picker">
            <FileText size={19} />
            <span>Choisir un CSV, PDF, JPG ou PNG</span>
            <input
              type="file"
              accept=".csv,text/csv,application/pdf,image/jpeg,image/png,.jpg,.jpeg,.png"
              onChange={(event) => void selectFile(event)}
            />
          </label>
          {ocrProgress !== null && (
            <p className="import-result">
              Lecture OCR en cours: {ocrProgress}%
            </p>
          )}
          {preview && (
            <>
              <p className="import-result">
                {preview.valid.length} ligne(s) valide(s) detectee(s).
              </p>
              {preview.errors.map((error) => (
                <p className="form-message" key={error}>
                  {error}
                </p>
              ))}
              {preview.pdfText && (
                <details>
                  <summary>Texte extrait du document</summary>
                  <p className="pdf-text">{preview.pdfText.slice(0, 1500)}</p>
                </details>
              )}
              {documentAnalysis && (
                <section className="document-analysis">
                  <p>
                    <strong>{documentKindLabel(documentAnalysis.kind)}</strong>
                    {" - "}
                    {documentAnalysis.explanation}
                  </p>
                  {documentAnalysis.invoice && (
                    <p>
                      Proposition: {documentAnalysis.invoice.description}
                      {documentAnalysis.invoice.amount !== null &&
                        `, ${documentAnalysis.invoice.amount.toFixed(2)} EUR`}
                      {documentAnalysis.invoice.dueDate &&
                        `, echeance le ${documentAnalysis.invoice.dueDate}`}
                    </p>
                  )}
                </section>
              )}
              {transactionDraft && (
                <section className="document-transaction-proposal">
                  <p>
                    <strong>Transaction proposee</strong>
                    {" - "}
                    verifiez les informations du ticket avant creation.
                  </p>
                  <div className="document-transaction-draft">
                    <input
                      aria-label="Libelle de la transaction proposee"
                      value={transactionDraft.description}
                      onChange={(event) =>
                        updateTransactionDraft("description", event.target.value)
                      }
                      maxLength={200}
                    />
                    <input
                      aria-label="Montant de la transaction proposee"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={transactionDraft.amount}
                      onChange={(event) =>
                        updateTransactionDraft("amount", event.target.value)
                      }
                    />
                    <input
                      aria-label="Date de la transaction proposee"
                      type="date"
                      value={transactionDraft.occurred_at}
                      onChange={(event) =>
                        updateTransactionDraft(
                          "occurred_at",
                          event.target.value,
                        )
                      }
                    />
                    <select
                      aria-label="Categorie de la transaction proposee"
                      value={transactionDraft.category_id ?? ""}
                      onChange={(event) =>
                        updateTransactionDraft(
                          "category_id",
                          event.target.value,
                        )
                      }
                    >
                      <option value="">Sans categorie</option>
                      {categories
                        .filter((category) => category.type === "expense")
                        .map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                    </select>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => void createDocumentTransaction()}
                      disabled={transactionSaving}
                    >
                      {transactionSaving
                        ? "Creation..."
                        : "Creer la transaction"}
                    </button>
                  </div>
                </section>
              )}
              {preview.pdfText && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void analyzeDocumentWithAssistant()}
                  disabled={documentAssistantLoading}
                >
                  {documentAssistantLoading
                    ? "Analyse du document..."
                    : "Analyser ce document avec l assistant"}
                </button>
              )}
              {documentProposal && (
                <section className="assistant-document-proposal">
                  <p>
                    <strong>Assistant: {documentKindLabel(documentProposal.kind)}</strong>
                    {" - "}
                    {documentProposal.explanation}
                  </p>
                  <p>
                    {documentProposal.description}
                    {documentProposal.amount !== null &&
                      `, ${documentProposal.amount.toFixed(2)} EUR`}
                    {documentProposal.dueDate &&
                      `, echeance le ${documentProposal.dueDate}`}
                  </p>
                  {commitmentDraft && (
                    <div className="document-commitment-draft">
                      <input
                        aria-label="Libelle de l engagement propose"
                        value={commitmentDraft.description}
                        onChange={(event) =>
                          updateCommitmentDraft(
                            "description",
                            event.target.value,
                          )
                        }
                        maxLength={200}
                      />
                      <input
                        aria-label="Montant de l engagement propose"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={commitmentDraft.amount}
                        onChange={(event) =>
                          updateCommitmentDraft("amount", event.target.value)
                        }
                      />
                      <input
                        aria-label="Echeance de l engagement propose"
                        type="date"
                        value={commitmentDraft.due_date}
                        onChange={(event) =>
                          updateCommitmentDraft(
                            "due_date",
                            event.target.value,
                          )
                        }
                      />
                      <select
                        aria-label="Frequence de l engagement propose"
                        value={commitmentDraft.frequency}
                        onChange={(event) =>
                          updateCommitmentDraft(
                            "frequency",
                            event.target.value as CommitmentFrequency,
                          )
                        }
                      >
                        <option value="once">Unique</option>
                        <option value="weekly">Hebdomadaire</option>
                        <option value="monthly">Mensuelle</option>
                        <option value="yearly">Annuelle</option>
                      </select>
                      <select
                        aria-label="Categorie de l engagement propose"
                        value={commitmentDraft.category_id ?? ""}
                        onChange={(event) =>
                          updateCommitmentDraft(
                            "category_id",
                            event.target.value,
                          )
                        }
                      >
                        <option value="">Sans categorie</option>
                        {categories
                          .filter((category) => category.type === "expense")
                          .map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                      </select>
                      <button
                        className="primary-button"
                        type="button"
                        onClick={() => void createDocumentCommitment()}
                        disabled={commitmentSaving}
                      >
                        {commitmentSaving
                          ? "Creation..."
                          : "Creer l engagement"}
                      </button>
                    </div>
                  )}
                </section>
              )}
              {preview.valid.length > 0 && (
                <>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void improveWithAssistant()}
                    disabled={assistantLoading}
                  >
                    {assistantLoading
                      ? "Analyse en cours..."
                      : "Ameliorer avec l assistant"}
                  </button>
                  <div className="import-preview">
                    {preview.valid.map((transaction, index) => {
                      const suggestion = suggestImport(
                        transaction,
                        categories,
                        history,
                      );
                      const assistantSuggestion = assistantSuggestions.find(
                        (item) => item.id === String(index),
                      );
                      const assistantCategory = categories.find(
                        (category) =>
                          category.id === assistantSuggestion?.categoryId,
                      );
                      return <div
                        className="import-row"
                        key={`${index}-${transactionFingerprint(transaction)}`}
                      >
                        <input
                          aria-label={`Date de la ligne ${index + 1}`}
                          type="date"
                          value={transaction.occurred_at}
                          onChange={(event) =>
                            updateTransaction(
                              index,
                              "occurred_at",
                              event.target.value,
                            )
                          }
                        />
                        <input
                          aria-label={`Libelle de la ligne ${index + 1}`}
                          value={transaction.description}
                          onChange={(event) =>
                            updateTransaction(
                              index,
                              "description",
                              event.target.value,
                            )
                          }
                          maxLength={200}
                        />
                        <input
                          aria-label={`Montant de la ligne ${index + 1}`}
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={transaction.amount}
                          onChange={(event) =>
                            updateTransaction(
                              index,
                              "amount",
                              event.target.value,
                            )
                          }
                        />
                        <select
                          aria-label={`Categorie de la ligne ${index + 1}`}
                          value={transaction.category_id ?? ""}
                          onChange={(event) =>
                            updateTransaction(
                              index,
                              "category_id",
                              event.target.value,
                            )
                          }
                        >
                          <option value="">Sans categorie</option>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                        {(suggestion.reason || suggestion.recurrence || suggestion.installmentCount) && (
                          <p className={`import-suggestion${suggestion.confidence ? ` import-suggestion-${suggestion.confidence}` : ""}`}>
                            {suggestion.reason}
                            {suggestion.recurrence && ` Frequence probable: ${formatRecurrence(suggestion.recurrence)}.`}
                            {suggestion.installmentCount && ` Plan de ${suggestion.installmentCount} mensualites detecte.`}
                          </p>
                        )}
                        {assistantSuggestion && (
                          <div className="assistant-suggestion">
                            <span>
                              Assistant: {assistantCategory?.name ?? "Sans categorie"}. {assistantSuggestion.explanation}
                            </span>
                            {assistantCategory && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateTransaction(
                                    index,
                                    "category_id",
                                    assistantCategory.id,
                                  )
                                }
                              >
                                Appliquer
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    })}
                  </div>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => void importValid()}
                    disabled={saving}
                  >
                    {saving
                      ? "Import..."
                      : `Importer ${preview.valid.length} ligne(s)`}
                  </button>
                </>
              )}
            </>
          )}{" "}
          {message && <p className="form-message">{message}</p>}
          <button
            className="close-import"
            type="button"
            onClick={() => {
              setOpen(false);
              setPreview(null);
            }}
            aria-label="Fermer l import"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </section>
  );
}
