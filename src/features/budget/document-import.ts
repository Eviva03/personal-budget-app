import Papa from 'papaparse'
import { parseAmount } from './money'
import type { Category, NewTransaction } from './types'

export type ImportPreview = { valid: NewTransaction[]; errors: string[]; pdfText?: string }

const dateColumns = ['date', 'date operation', 'date opération', 'operation date']
const amountColumns = ['montant', 'amount', 'debit', 'débit']
const descriptionColumns = ['libelle', 'libellé', 'description', 'label', 'operation']

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

function parsePdfDate(day: string, month: string) {
  const monthNumber = frenchMonths[month.toLowerCase()]
  return monthNumber ? `${new Date().getFullYear()}-${monthNumber}-${day.padStart(2, '0')}` : null
}

function cleanPdfDescription(value: string) {
  return value
    .split(/\b(?:appara(?:i|î)tra|pending|account ending|solde|total)\b/i, 1)[0]
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
  return rows.flatMap((row) => {
    const match = row.trim().match(new RegExp(`^(${datePattern})\\s+(.+?)\\s+(-?\\s*(?:€\\s*)?[\\d\\s.,]+)\\s*(?:€|EUR)(?:\\s+.*)?$`, 'i'))
    if (!match) return []
    const occurredAt = parseRevolutDate(match[1])
    const description = cleanPdfDescription(match[2])
    const rawAmount = Number(match[3].replace(/[€\s]/g, '').replace(',', '.'))
    const amount = Number.isFinite(rawAmount) ? parseAmount(String(Math.abs(rawAmount))) : null
    return occurredAt && description && amount !== null ? [{ occurred_at: occurredAt, description, amount, category_id: null }] : []
  })
}

const englishMonths: Record<string, string> = {
  jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03', apr: '04', april: '04', may: '05', jun: '06', june: '06', jul: '07', july: '07', aug: '08', august: '08', sep: '09', sept: '09', september: '09', oct: '10', october: '10', nov: '11', november: '11', dec: '12', december: '12'
}

function parseRevolutScreenshotText(text: string): NewTransaction[] {
  const pattern = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),\s+\d{1,2}:\d{2}\s*(?:AM|PM)\s+Completed\s+([+-])\s*(?:€|e)\s*(\d+(?:[.,]\d{1,2})?)/gi
  const matches = [...text.matchAll(pattern)]
  const year = new Date().getFullYear()
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
      ? [{ occurred_at: `${year}-${month}-${match[2].padStart(2, '0')}`, description, amount, category_id: null }]
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
  const pattern = /(\d{1,2})\s+(janvier|fevrier|février|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre)\s+(.+?)\s+(-?[\d\s]+[,.]\d{2})\s*(?:€|\$|EUR|USD)(?=\s|$)/gi
  let match: RegExpExecArray | null

  while ((match = pattern.exec(table)) !== null) {
    const occurredAt = parsePdfDate(match[1], match[2])
    const description = cleanPdfDescription(match[3])
    const rawAmount = Number(match[4].replace(/\s/g, '').replace(',', '.'))
    const amount = Number.isFinite(rawAmount) ? parseAmount(String(Math.abs(rawAmount))) : null
    if (!occurredAt || !description || amount === null) {
      errors.push('Une opération PDF n’a pas pu être interprétée.')
      continue
    }
    valid.push({ occurred_at: occurredAt, description, amount, category_id: null })
  }

  if (valid.length === 0) errors.push('Aucune opération clairement identifiable dans ce document. Vérifiez le texte avant une saisie manuelle.')
  return { valid, errors }
}

export function parseTransactionsCsv(csv: string): ImportPreview {
  const header = csv.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = header.includes(';') ? ';' : header.includes('\t') ? '\t' : ','
  const result = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: 'greedy', delimiter, transformHeader: (column) => column.trim() })
  const valid: NewTransaction[] = []; const errors: string[] = []
  result.data.forEach((row, index) => {
    const description = valueFor(row, descriptionColumns); const date = parseDate(valueFor(row, dateColumns)); const rawAmount = Number(valueFor(row, amountColumns).replace(/\s/g, '').replace(',', '.')); const amount = Number.isFinite(rawAmount) ? parseAmount(String(Math.abs(rawAmount))) : null
    if (!description || !date || amount === null) { errors.push(`Ligne ${index + 2} : date, montant ou libellé invalide.`); return }
    valid.push({ description, occurred_at: date, amount, category_id: null })
  })
  if (result.errors.length > 0) errors.push('Le fichier CSV contient une structure invalide.')
  return { valid, errors }
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
    return { ...preview, errors: preview.valid.length > 0 ? ['Opérations détectées dans le PDF. Vérifiez-les avant l’import.'] : preview.errors, pdfText }
  }

  const pageCount = Math.min(document.numPages, 3)
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('fra', 1, { logger: (event) => { if (event.status === 'recognizing text') onProgress?.(Math.round(event.progress * 100)) } })
  try {
    const recognisedPages = await Promise.all(Array.from({ length: pageCount }, async (_, index) => {
      const page = await document.getPage(index + 1); const viewport = page.getViewport({ scale: 2 }); const canvas = window.document.createElement('canvas')
      canvas.width = viewport.width; canvas.height = viewport.height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Impossible de créer le rendu OCR.')
      await page.render({ canvas, canvasContext: context, viewport }).promise
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Impossible de préparer la page pour l’OCR.')), 'image/png'))
      return (await worker.recognize(blob)).data.text
    }))
    const ocrText = recognisedPages.join('\n').trim()
    if (!ocrText) return { valid: [], errors: ['L’OCR n’a pas pu lire ce document.'], pdfText: ocrText }
    const preview = parseTransactionsPdfText(ocrText)
    return { ...preview, errors: preview.valid.length > 0 ? ['Opérations détectées par OCR. Vérifiez-les avant l’import.'] : preview.errors, pdfText: ocrText }
  } finally { await worker.terminate() }
}

export async function readImageText(file: File, onProgress?: (progress: number) => void): Promise<ImportPreview> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('fra', 1, { logger: (event) => { if (event.status === 'recognizing text') onProgress?.(Math.round(event.progress * 100)) } })
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