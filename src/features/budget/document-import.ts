import Papa from 'papaparse'
import { parseAmount } from './money'
import type { Category, NewTransaction } from './types'

export type ImportPreview = { valid: NewTransaction[]; errors: string[]; pdfText?: string }

const dateColumns = ['date', 'date operation', 'date opération', 'operation date']
const amountColumns = ['montant', 'amount']
const directionColumns = ['sens', 'direction']
const debitColumns = ['debit', 'débit', 'montant debit', 'montant débit', 'argent sortant']
const creditColumns = ['credit', 'crédit', 'montant credit', 'montant crédit', 'argent entrant']
const descriptionColumns = ['libelle', 'libellé', 'description', 'label', 'operation']

// Thousands groups must be exactly three digits so reference numbers before an amount are not absorbed into it.
const amountPattern = '[-−–+]?\\s?(?:\\d{1,3}(?:[\\s\\u00a0\\u202f.]\\d{3})+|\\d+)[,.]\\d{2}'

function parseSignedAmount(raw: string) {
  const text = raw.trim()
  const negative = /^[-−–]/.test(text)
  const digits = text.replace(/[-−–+\s\u00a0\u202f€$]|EUR|USD/gi, '')
  const normalised = digits.includes(',') ? digits.replace(/\./g, '').replace(',', '.') : digits
  const value = Number(normalised)
  const amount = Number.isFinite(value) ? parseAmount(String(Math.abs(value))) : null
  return amount === null ? null : { amount, negative }
}

// Statements that print signs mark the unsigned rows as credits; statements without any sign keep everything as spending.
function withDirections<T extends { negative: boolean }>(rows: T[]) {
  const usesSigns = rows.some((row) => row.negative)
  return rows.map((row) => ({ ...row, direction: usesSigns && !row.negative ? 'income' as const : undefined }))
}

export function transactionFingerprint(transaction: NewTransaction) {
  const description = transaction.description
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
  return `${transaction.occurred_at}|${Number(transaction.amount).toFixed(2)}|${description}`
}

function valueFor(row: Record<string, string>, candidates: string[]) {
  const key = Object.keys(row).find((column) => candidates.includes(column.trim().toLowerCase()))
  return key ? row[key]?.trim() : ''
}

function parseDate(value: string) {
  const french = value.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/)
  if (french) return `${french[3]}-${french[2]}-${french[1]}`
  const iso = value.match(/^\d{4}-\d{2}-\d{2}$/)
  return iso ? value : null
}

const frenchMonths: Record<string, string> = {
  janvier: '01', janv: '01', fevrier: '02', février: '02', fevr: '02', févr: '02', mars: '03', avril: '04', avr: '04', mai: '05', juin: '06', juillet: '07', juil: '07', aout: '08', août: '08', septembre: '09', sept: '09', octobre: '10', oct: '10', novembre: '11', nov: '11', decembre: '12', décembre: '12', dec: '12', déc: '12'
}

// A statement printed in January can list December operations, so a date far in the future belongs to the previous year.
function inferYear(month: number, day: number, now = new Date()) {
  const candidate = new Date(now.getFullYear(), month - 1, day)
  const limit = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 31)
  return candidate > limit ? now.getFullYear() - 1 : now.getFullYear()
}

function parsePdfDate(day: string, month: string) {
  const monthNumber = frenchMonths[month.toLowerCase().replace('.', '')]
  return monthNumber ? `${inferYear(Number(monthNumber), Number(day))}-${monthNumber}-${day.padStart(2, '0')}` : null
}

// Rows such as "Nouveau solde" or "Total des opérations" are statement totals, not operations; merchants like TOTAL ACCESS stay.
function isBalanceRow(description: string) {
  return /^(?:(?:ancien|nouveau|dernier)\s+)?solde(?:\s+(?:pr[ée]c[ée]dent|initial|final|disponible|en\s+fin\s+de\s+page|d['’]ouverture|de\s+cl[oô]ture|au\b.*))?$/i.test(description)
    || /^total\s+(?:des\s+|g[ée]n[ée]ral)/i.test(description)
}

function cleanPdfDescription(value: string) {
  return value
    // Only cut at "solde"/"total" when an amount follows, so merchants such as TOTAL ACCESS keep their name.
    .split(/\b(?:appara(?:i|î)tra|pending|account ending)\b|\b(?:solde|total)\b(?=\s*:?\s*[-−–]?\d[\d\s.]*[,.]\d{2})/i, 1)[0]
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
}

function parseRevolutDate(value: string) {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return value
  const european = value.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/)
  if (european) return `${european[3]}-${european[2]}-${european[1]}`
  const french = value.match(/^(\d{2})\s+(janv\.?|fevr?\.?|févr\.?|mars|avr\.?|mai|juin|juil\.?|aout|août|sept\.?|oct\.?|nov\.?|dec\.?|déc\.?)\s+(\d{4})$/i)
  if (!french) return null
  const month = frenchMonths[french[2].replace('.', '').toLowerCase()]
  return month ? `${french[3]}-${month}-${french[1].padStart(2, '0')}` : null
}

function parseRevolutPdfText(text: string): NewTransaction[] {
  const datePattern = '(?:\\d{4}-\\d{2}-\\d{2}|\\d{2}[./-]\\d{2}[./-]\\d{4}|\\d{2}\\s+(?:janv\\.?|fevr?\\.?|févr\\.?|mars|avr\\.?|mai|juin|juil\\.?|aout|août|sept\\.?|oct\\.?|nov\\.?|dec\\.?|déc\\.?)\\s+\\d{4})'
  const rows = text.split(new RegExp(`(?=${datePattern}\\s)`, 'i'))
  const parsed = rows.flatMap((row) => {
    const match = row.trim().match(new RegExp(`^(${datePattern})\\s+(.+?)\\s+(${amountPattern})\\s*(?:€|EUR)(?:\\s+.*)?$`, 'i'))
    if (!match) return []
    const occurredAt = parseRevolutDate(match[1])
    const description = cleanPdfDescription(match[2])
    const value = parseSignedAmount(match[3])
    return occurredAt && description && value && !isBalanceRow(description) ? [{ occurred_at: occurredAt, description, amount: value.amount, category_id: null, negative: value.negative }] : []
  })
  return withDirections(parsed).map(({ negative: _negative, direction, ...transaction }) => direction ? { ...transaction, direction } : transaction)
}

const englishMonths: Record<string, string> = {
  jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03', apr: '04', april: '04', may: '05', jun: '06', june: '06', jul: '07', july: '07', aug: '08', august: '08', sep: '09', sept: '09', september: '09', oct: '10', october: '10', nov: '11', november: '11', dec: '12', december: '12'
}

function parseRevolutScreenshotText(text: string): NewTransaction[] {
  const pattern = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),\s+\d{1,2}:\d{2}\s*(?:AM|PM)\s+Completed\s+([+-])\s*(?:€|e)\s*(\d+(?:[.,]\d{1,2})?)/gi
  const matches = [...text.matchAll(pattern)]
  let previousEnd = 0

  return matches.flatMap((match) => {
    const description = text
      .slice(previousEnd, match.index)
      .replace(/^[^\p{L}\p{N}]+/u, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200)
    previousEnd = (match.index ?? 0) + match[0].length
    const month = englishMonths[match[1].toLowerCase()]
    const amount = parseAmount(match[4].replace(',', '.'))
    return month && description && amount !== null
      ? [{ occurred_at: `${inferYear(Number(month), Number(match[2]))}-${month}-${match[2].padStart(2, '0')}`, description, amount, category_id: null }]
      : []
  })
}

export function parseTransactionsPdfText(text: string): ImportPreview {
  const valid: NewTransaction[] = []
  const errors: string[] = []
  const tableStart = text.search(/\bdate\s+description\s+montant\b/i)
  if (tableStart < 0) {
    const screenshotTransactions = parseRevolutScreenshotText(text)
    if (screenshotTransactions.length > 0) return { valid: screenshotTransactions, errors }
    const revolutTransactions = parseRevolutPdfText(text)
    return revolutTransactions.length > 0
      ? { valid: revolutTransactions, errors }
      : { valid, errors: ['La table des opérations est introuvable dans ce document. Vérifiez le texte avant une saisie manuelle.'] }
  }
  const table = text.slice(tableStart)
  const monthNames = 'janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre|janv\\.?|févr\\.?|fevr\\.?|avr\\.?|juil\\.?|sept\\.?|oct\\.?|nov\\.?|déc\\.?|dec\\.?'
  const pattern = new RegExp(`(\\d{1,2})\\s+(${monthNames})\\s+(.+?)\\s+(${amountPattern})\\s*(?:€|\\$|EUR|USD)(?=\\s|$)`, 'gi')
  let match: RegExpExecArray | null
  let skipped = 0
  const rows: Array<NewTransaction & { negative: boolean }> = []

  while ((match = pattern.exec(table)) !== null) {
    const occurredAt = parsePdfDate(match[1], match[2])
    const description = cleanPdfDescription(match[3])
    const value = parseSignedAmount(match[4])
    if (isBalanceRow(description)) continue
    if (!occurredAt || !description || !value) {
      skipped += 1
      continue
    }
    rows.push({ occurred_at: occurredAt, description, amount: value.amount, category_id: null, negative: value.negative })
  }

  withDirections(rows).forEach(({ negative: _negative, direction, ...transaction }) => valid.push(direction ? { ...transaction, direction } : transaction))
  if (skipped > 0) errors.push(`${skipped} opération(s) n’ont pas pu être interprétées. Vérifiez le texte extrait.`)
  if (valid.length === 0) errors.push('Aucune opération clairement identifiable dans ce document. Vérifiez le texte avant une saisie manuelle.')
  return { valid, errors }
}

export function parseTransactionsCsv(csv: string): ImportPreview {
  const header = csv.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = header.includes(';') ? ';' : header.includes('\t') ? '\t' : ','
  const result = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: 'greedy', delimiter, transformHeader: (column) => column.trim() })
  const rows: Array<NewTransaction & { negative: boolean; fromSignedColumn: boolean }> = []; const errors: string[] = []
  result.data.forEach((row, index) => {
    const description = valueFor(row, descriptionColumns); const date = parseDate(valueFor(row, dateColumns))
    const signed = valueFor(row, amountColumns); const debit = valueFor(row, debitColumns); const credit = valueFor(row, creditColumns)
    const value = parseSignedAmount(signed || debit || credit)
    if (!description || !date || !value) { errors.push(`Ligne ${index + 2} : date, montant ou libellé invalide.`); return }
    // Separate debit/credit columns state the direction explicitly; a single signed column is read like a statement.
    // An explicit "Sens" column (written by Horizon's own CSV export) wins over any sign.
    const sens = valueFor(row, directionColumns).toLowerCase()
    const explicit = /^(revenu|entr|income|cr[eé]dit)/.test(sens) ? 'income' : /^(d[eé]pense|sortie|expense|d[eé]bit)/.test(sens) ? 'expense' : null
    const isCredit = !signed && !debit && Boolean(credit)
    rows.push({ description, occurred_at: date, amount: value.amount, category_id: null, negative: value.negative, fromSignedColumn: Boolean(signed) && !isCredit && !explicit })
    if (explicit === 'income' || (!explicit && isCredit)) rows[rows.length - 1].direction = 'income'
  })
  const usesSigns = rows.some((row) => row.fromSignedColumn && row.negative)
  const valid = rows.map(({ negative: _negative, fromSignedColumn, direction, ...transaction }, index) => {
    const income = direction === 'income' || (usesSigns && fromSignedColumn && !rows[index].negative)
    return income ? { ...transaction, direction: 'income' as const } : transaction
  })
  if (result.errors.length > 0) errors.push('Le fichier CSV contient une structure invalide.')
  return { valid, errors }
}

const maxOcrPages = 12

async function createOcrWorker(onProgress?: (progress: number) => void) {
  const { createWorker } = await import('tesseract.js')
  // Absolute URLs: the OCR worker runs from a blob: URL, so relative paths would not resolve.
  const base = `${window.location.origin}/ocr`
  return createWorker('fra', 1, {
    workerPath: `${base}/worker.min.js`,
    corePath: base,
    langPath: `${base}/lang`,
    logger: (event) => { if (event.status === 'recognizing text') onProgress?.(Math.round(event.progress * 100)) },
  })
}

export async function readPdfText(file: File, onProgress?: (progress: number) => void): Promise<ImportPreview> {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
  GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  const document = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const pages = await Promise.all(Array.from({ length: document.numPages }, async (_, index) => {
    const content = await (await document.getPage(index + 1)).getTextContent()
    return content.items.map((item) => 'str' in item ? item.str : '').join(' ')
  }))
  const pdfText = pages.join('\n').trim()
  if (pdfText) {
    const preview = parseTransactionsPdfText(pdfText)
    return { ...preview, errors: preview.valid.length > 0 ? ['Opérations détectées dans le PDF. Vérifiez-les avant l’import.', ...preview.errors] : preview.errors, pdfText }
  }

  const pageCount = Math.min(document.numPages, maxOcrPages)
  let currentPage = 0
  const worker = await createOcrWorker((pageProgress) => onProgress?.(Math.round(((currentPage + pageProgress / 100) / pageCount) * 100)))
  try {
    const recognisedPages: string[] = []
    // One page at a time: rendering every page of a long statement at once would exhaust phone memory.
    for (currentPage = 0; currentPage < pageCount; currentPage++) {
      const page = await document.getPage(currentPage + 1); const viewport = page.getViewport({ scale: 2 }); const canvas = window.document.createElement('canvas')
      canvas.width = viewport.width; canvas.height = viewport.height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Impossible de créer le rendu OCR.')
      await page.render({ canvas, canvasContext: context, viewport }).promise
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Impossible de préparer la page pour l’OCR.')), 'image/png'))
      recognisedPages.push((await worker.recognize(blob)).data.text)
      canvas.width = 0; canvas.height = 0
    }
    const truncation = document.numPages > pageCount ? [`Seules les ${pageCount} premières pages sur ${document.numPages} ont été lues. Importez le reste séparément.`] : []
    const ocrText = recognisedPages.join('\n').trim()
    if (!ocrText) return { valid: [], errors: ['L’OCR n’a pas pu lire ce document.'], pdfText: ocrText }
    const preview = parseTransactionsPdfText(ocrText)
    return { ...preview, errors: preview.valid.length > 0 ? ['Opérations détectées par OCR. Vérifiez-les avant l’import.', ...preview.errors, ...truncation] : [...preview.errors, ...truncation], pdfText: ocrText }
  } finally { await worker.terminate() }
}

export async function readImageText(file: File, onProgress?: (progress: number) => void): Promise<ImportPreview> {
  const worker = await createOcrWorker(onProgress)
  try {
    const imageText = (await worker.recognize(file)).data.text.trim()
    if (!imageText) return { valid: [], errors: ['L’OCR n’a pas pu lire cette image.'], pdfText: imageText }
    const preview = parseTransactionsPdfText(imageText)
    return { ...preview, errors: preview.valid.length > 0 ? ['Opérations détectées dans l’image. Vérifiez-les avant l’import.'] : preview.errors, pdfText: imageText }
  } finally { await worker.terminate() }
}

const categoryKeywords: Record<string, string[]> = {
  alimentation: ['carrefour', 'auchan', 'monoprix', 'lidl', 'aldi', 'courses', 'supermarch'],
  transport: ['sncf', 'ratp', 'uber', 'bolt', 'total', 'shell', 'essence', 'parking'],
  logement: ['loyer', 'edf', 'engie', 'eau', 'internet', 'orange', 'sfr', 'free'],
  loisirs: ['cinema', 'netflix', 'spotify', 'steam', 'restaurant', 'bar'],
  sante: ['pharmacie', 'doctolib', 'medecin', 'mutuelle'],
  sport: ['fitness', 'basic fit', 'decathlon']
}

function normalized(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export function suggestCategoryId(description: string, categories: Category[]) {
  const merchant = normalized(description)
  const category = categories.find((candidate) => {
    const name = normalized(candidate.name)
    const keywords = categoryKeywords[name] ?? [name]
    return keywords.some((keyword) => merchant.includes(keyword))
  })
  return category?.id ?? null
}