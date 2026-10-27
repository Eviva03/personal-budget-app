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
  janvier: '01', fevrier: '02', février: '02', mars: '03', avril: '04', mai: '05', juin: '06', juillet: '07', aout: '08', août: '08', septembre: '09', octobre: '10', novembre: '11', decembre: '12', décembre: '12'
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

export function parseTransactionsPdfText(text: string): ImportPreview {
  const valid: NewTransaction[] = []
  const errors: string[] = []
  const tableStart = text.search(/\bdate\s+description\s+montant\b/i)
  if (tableStart < 0) return { valid, errors: ['La table des operations est introuvable dans ce PDF. Verifiez le texte avant une saisie manuelle.'] }
  const table = text.slice(tableStart)
  const pattern = /(\d{1,2})\s+(janvier|fevrier|février|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre)\s+(.+?)\s+(-?[\d\s]+[,.]\d{2})\s*(?:€|\$|EUR|USD)(?=\s|$)/gi
  let match: RegExpExecArray | null

  while ((match = pattern.exec(table)) !== null) {
    const occurredAt = parsePdfDate(match[1], match[2])
    const description = cleanPdfDescription(match[3])
    const rawAmount = Number(match[4].replace(/\s/g, '').replace(',', '.'))
    const amount = Number.isFinite(rawAmount) ? parseAmount(String(Math.abs(rawAmount))) : null
    if (!occurredAt || !description || amount === null) {
      errors.push('Une operation PDF n a pas pu etre interpretee.')
      continue
    }
    valid.push({ occurred_at: occurredAt, description, amount, category_id: null })
  }

  if (valid.length === 0) errors.push('Aucune operation clairement identifiable dans le PDF. Verifiez le texte avant une saisie manuelle.')
  return { valid, errors }
}

export function parseTransactionsCsv(csv: string): ImportPreview {
  const header = csv.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = header.includes(';') ? ';' : header.includes('\t') ? '\t' : ','
  const result = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: 'greedy', delimiter, transformHeader: (column) => column.trim() })
  const valid: NewTransaction[] = []; const errors: string[] = []
  result.data.forEach((row, index) => {
    const description = valueFor(row, descriptionColumns); const date = parseDate(valueFor(row, dateColumns)); const rawAmount = Number(valueFor(row, amountColumns).replace(/\s/g, '').replace(',', '.')); const amount = Number.isFinite(rawAmount) ? parseAmount(String(Math.abs(rawAmount))) : null
    if (!description || !date || amount === null) { errors.push(`Ligne ${index + 2}: date, montant ou libelle invalide.`); return }
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
    return { ...preview, errors: preview.valid.length > 0 ? ['Operations detectees dans le PDF. Verifiez-les avant import.'] : preview.errors, pdfText }
  }

  const pageCount = Math.min(document.numPages, 3)
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('fra', 1, { logger: (event) => { if (event.status === 'recognizing text') onProgress?.(Math.round(event.progress * 100)) } })
  try {
    const recognisedPages = await Promise.all(Array.from({ length: pageCount }, async (_, index) => {
      const page = await document.getPage(index + 1); const viewport = page.getViewport({ scale: 2 }); const canvas = window.document.createElement('canvas')
      canvas.width = viewport.width; canvas.height = viewport.height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Impossible de creer le rendu OCR.')
      await page.render({ canvas, canvasContext: context, viewport }).promise
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Impossible de preparer la page pour l OCR.')), 'image/png'))
      return (await worker.recognize(blob)).data.text
    }))
    const ocrText = recognisedPages.join('\n').trim()
    if (!ocrText) return { valid: [], errors: ['L OCR n a pas pu lire ce document.'], pdfText: ocrText }
    const preview = parseTransactionsPdfText(ocrText)
    return { ...preview, errors: preview.valid.length > 0 ? ['Operations detectees par OCR. Verifiez-les avant import.'] : preview.errors, pdfText: ocrText }
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