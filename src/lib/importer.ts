/**
 * Import degli estratti conto (banca, PayPal) da CSV: lettura del file, riconoscimento delle colonne,
 * conversione delle righe in spese, regole di categoria e riconoscimento delle spese ricorrenti.
 *
 * Logica pura senza dipendenze a runtime (solo `import type`), così si prova con `npm test`.
 */
import type { Frequency } from '../db'

export type ImportSource = 'banca' | 'paypal' | 'carta' | 'altro'

export const IMPORT_SOURCES: Record<ImportSource, string> = {
  banca: 'Estratto conto della banca',
  paypal: 'Attività PayPal',
  carta: 'Carta di credito / prepagata',
  altro: 'Altro',
}

// ---------- Date e importi ----------

const pad = (n: number) => String(n).padStart(2, '0')
const daysIn = (y: number, m: number) => new Date(y, m, 0).getDate() // m da 1

/** 31/12/2026, 31-12-26, 31.12.2026, 2026-12-31, 2026-12-31T10:00 -> "2026-12-31" (null se non valida) */
export function parseDate(raw: string | undefined): string | null {
  if (!raw) return null
  const s = raw.trim()
  const valid = (y: number, m: number, d: number) => (m < 1 || m > 12 || d < 1 || d > daysIn(y, m) ? null : `${y}-${pad(m)}-${pad(d)}`)
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) return valid(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (!m) return null
  let y = +m[3]
  if (y < 100) y += 2000
  let d = +m[1]
  let mo = +m[2]
  if (mo > 12 && d <= 12) [d, mo] = [mo, d] // formato americano
  return valid(y, mo, d)
}

/**
 * Importo di un estratto conto -> centesimi con segno (null se illeggibile).
 * "1.234,56" "-1,234.56" "€ 12,50" "12,50-" "(12,50)" "+3.000"
 */
export function parseStatementAmount(raw: string | undefined): number | null {
  if (raw == null) return null
  let s = raw.trim()
  if (!s) return null
  let neg = false
  if (/^\(.*\)$/.test(s)) {
    neg = true
    s = s.slice(1, -1)
  }
  if (/-\s*$/.test(s)) {
    neg = true
    s = s.replace(/-\s*$/, '')
  }
  s = s.replace(/[^\d.,+-]/g, '')
  if (s.startsWith('-')) {
    neg = !neg
    s = s.slice(1)
  }
  s = s.replace(/^\+/, '')
  if (!/\d/.test(s)) return null
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  let dec: ',' | '.' | null = null
  if (lastComma >= 0 && lastDot >= 0) dec = lastComma > lastDot ? ',' : '.'
  // Un solo separatore: "12,5" e "12.50" sono decimali, "1.234" e "1,234" sono migliaia
  else if (lastComma >= 0) dec = s.split(',').length === 2 && s.length - lastComma - 1 !== 3 ? ',' : null
  else if (lastDot >= 0) dec = s.split('.').length === 2 && s.length - lastDot - 1 !== 3 ? '.' : null
  let intPart = s
  let frac = ''
  if (dec) {
    const i = s.lastIndexOf(dec)
    intPart = s.slice(0, i)
    frac = s.slice(i + 1)
  }
  const cents = parseInt(intPart.replace(/[.,]/g, '') || '0', 10) * 100 + parseInt((frac + '00').slice(0, 2), 10)
  if (!Number.isFinite(cents)) return null
  return neg ? -cents : cents
}

// ---------- Descrizioni ----------

const STOP = new Set(
  (
    'pagamento pag pos carta cart addebito addebiti sdd sepa direct debit bonifico bonif a favore di del della dello dei degli delle ' +
    'da per presso il lo la le gli un una e ed su con op operazione rif riferimento data valuta ora cro trn id n nr num mandato cid ' +
    'acquisto debito credito contactless online web internet eur euro commissioni ordinante beneficiario causale ' +
    'gennaio febbraio marzo aprile maggio giugno luglio agosto settembre ottobre novembre dicembre ' +
    'it ita italy italia www com spa srl s r l b v ltd inc sarl gmbh'
  ).split(' '),
)

/**
 * Chiave stabile di una descrizione bancaria: minuscole, senza numeri, date e parole di servizio, prime 3 parole.
 * "PAGAMENTO POS 12/03 NETFLIX.COM AMSTERDAM CARTA 1234" -> "netflix amsterdam".
 * Attenzione: è salvata nelle ricorrenze (`matchKey`) e nelle regole; cambiarla rompe il riconoscimento dei dati salvati.
 */
export function normalizeDesc(desc: string): string {
  return desc
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .slice(0, 3)
    .join(' ')
}

export const titleCase = (s: string) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase())

/** Descrizione leggibile per una spesa importata: la parte utile, con le maiuscole giuste */
export function prettyDesc(desc: string): string {
  const key = normalizeDesc(desc)
  return key ? titleCase(key) : desc.trim()
}

// ---------- CSV ----------

export function parseCSV(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += c
    } else if (c === '"' && cell === '') quoted = true
    else if (c === delimiter) {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      cell = ''
      if (row.some((x) => x.trim() !== '')) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some((x) => x.trim() !== '')) rows.push(row)
  return rows.map((r) => r.map((x) => x.trim()))
}

function modeOf(arr: number[]) {
  const counts = new Map<number, number>()
  let best = 0
  let bestN = 0
  for (const v of arr) {
    const n = (counts.get(v) ?? 0) + 1
    counts.set(v, n)
    if (n > bestN || (n === bestN && v > best)) [best, bestN] = [v, n]
  }
  return best
}

export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 30)
  let best = ','
  let bestScore = -1
  for (const d of [';', ',', '\t', '|']) {
    const counts = lines.map((l) => (parseCSV(l, d)[0] ?? []).length)
    const mode = modeOf(counts)
    const score = mode > 1 ? counts.filter((c) => c === mode).length * mode : 0
    if (score > bestScore) [best, bestScore] = [d, score]
  }
  return best
}

/** Le banche mettono righe di intestazione prima della tabella: cerca la riga dei titoli (quella con "Data") */
export function findHeaderRow(rows: string[][]): number {
  const width = modeOf(rows.map((r) => r.length))
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    if (rows[i].length >= Math.min(width, 3) && rows[i].some((c) => /^(data|date|giorno)/i.test(c))) return i
  }
  return Math.max(0, rows.findIndex((r) => r.length === width))
}

export interface ColumnMapping {
  date: number
  desc: number
  /** Importo con segno; -1 se l'estratto usa due colonne Dare/Avere */
  amount: number
  debit: number
  credit: number
  status: number
  type: number
}

export function guessMapping(headers: string[]): ColumnMapping {
  const find = (...res: RegExp[]) => {
    for (const re of res) {
      const i = headers.findIndex((h) => re.test(h))
      if (i >= 0) return i
    }
    return -1
  }
  const map: ColumnMapping = {
    date: find(/^data\s*(contabile|operazione|registrazione)?$/i, /^data contabile/i, /^data op/i, /^date$/i, /data/i, /date/i),
    desc: find(/^nome$/i, /descrizione\s*(estesa|completa|operazione)?/i, /causale/i, /beneficiario|controparte|esercente/i, /description|details|merchant|name/i, /dettagli/i),
    amount: find(/^netto$/i, /^importo$/i, /^importo\s*\(?(eur|€)?\)?$/i, /importo/i, /^net$/i, /amount/i, /^lordo$/i, /gross/i),
    debit: find(/^dare$/i, /^uscite$/i, /addebit/i, /^debit/i),
    credit: find(/^avere$/i, /^entrate$/i, /accredit/i, /^credit/i),
    status: find(/^stato$/i, /^status$/i),
    type: find(/^tipo$/i, /^type$/i, /^tipologia$/i),
  }
  // "Data valuta" non è la data dell'operazione, se c'è un'altra data
  if (map.date >= 0 && /valuta/i.test(headers[map.date])) {
    const alt = headers.findIndex((h, i) => i !== map.date && /^data/i.test(h) && !/valuta/i.test(h))
    if (alt >= 0) map.date = alt
  }
  if (map.amount >= 0 && (map.debit >= 0 || map.credit >= 0) && !/importo|netto|amount/i.test(headers[map.amount])) map.amount = -1
  return map
}

/** Firma delle intestazioni, per ricordare la mappatura delle colonne di ogni banca */
export const headerSignature = (headers: string[]) => headers.map((h) => h.toLowerCase()).join('|')

/** Il file sembra un'esportazione PayPal (colonne Lordo e Netto) */
export const looksLikePaypal = (headers: string[]) => headers.some((h) => /^(lordo|gross)$/i.test(h)) && headers.some((h) => /^(netto|net)$/i.test(h))

// Righe PayPal che non sono acquisti: ricariche dalla banca, conversioni, blocchi
const PAYPAL_SKIP = /trasferimento|bonifico generico|conversione|blocco|autorizzazione|ritiro|prelievo|general card deposit|bank deposit|currency conversion|hold|authorization|withdrawal/i

export interface ImportRow {
  row: number
  date: string | null
  /** Centesimi con segno: negativo = uscita */
  amount: number | null
  desc: string
  key?: string
  /** Entrata (stipendio, rimborso): va nelle entrate, non nelle spese */
  income?: boolean
  /** Motivo per cui la riga non viene importata */
  skip?: string
}

export const importKey = (date: string, amount: number, desc: string) => `${date}|${amount}|${desc.toLowerCase().replace(/\s+/g, ' ').trim()}`

export function rowsToImport(
  rows: string[][],
  headerIndex: number,
  opts: { mapping: ColumnMapping; source: ImportSource; skipPaypalInBank?: boolean; existingKeys?: Set<string> },
): ImportRow[] {
  const m = opts.mapping
  const out: ImportRow[] = []
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const r = rows[i]
    const date = parseDate(r[m.date])
    let amount = m.amount >= 0 ? parseStatementAmount(r[m.amount]) : null
    if (!amount && (m.debit >= 0 || m.credit >= 0)) {
      const d = m.debit >= 0 ? parseStatementAmount(r[m.debit]) : null
      const c = m.credit >= 0 ? parseStatementAmount(r[m.credit]) : null
      if (d) amount = -Math.abs(d)
      else if (c) amount = Math.abs(c)
    }
    const item: ImportRow = { row: i, date, amount, desc: (r[m.desc] ?? '').replace(/\s+/g, ' ').trim() }
    if (!date || amount == null) item.skip = 'riga non leggibile'
    else if (amount === 0) item.skip = 'importo zero'
    else if (opts.source === 'paypal') {
      const status = m.status >= 0 ? r[m.status] : ''
      const type = m.type >= 0 ? r[m.type] : ''
      if (status && !/complet/i.test(status)) item.skip = `stato: ${status}`
      else if (type && PAYPAL_SKIP.test(type)) item.skip = 'ricarica PayPal'
      if (!item.desc && type) item.desc = type
    } else if (opts.skipPaypalInBank && /paypal/i.test(item.desc)) item.skip = 'pagamento PayPal (dal file PayPal)'
    if (!item.skip && amount! > 0) item.income = true
    if (!item.skip) {
      item.key = importKey(date!, amount!, item.desc)
      if (opts.existingKeys?.has(item.key)) item.skip = 'già importata'
    }
    out.push(item)
  }
  return out
}

// ---------- Categorie ----------

export interface CategoryRule {
  keyword: string
  categoryId: string
}

export const DEFAULT_RULES: CategoryRule[] = [
  ...['netflix', 'spotify', 'amazon prime', 'disney', 'dazn', 'youtube premium', 'apple.com', 'icloud'].map((k) => ({ keyword: k, categoryId: 'abbonamenti' })),
  ...['esselunga', 'coop', 'conad', 'lidl', 'carrefour', 'eurospin', 'pam ', 'despar', 'md spa', 'penny', 'aldi'].map((k) => ({ keyword: k, categoryId: 'spesa' })),
  ...['enel', 'hera', 'a2a', 'iren', 'acea', 'edison', 'tim ', 'vodafone', 'iliad', 'fastweb', 'windtre', 'ho mobile', 'sorgenia', 'eni plenitude'].map((k) => ({ keyword: k, categoryId: 'bollette' })),
  ...['trenitalia', 'italotreno', 'autostrade', 'telepass', 'q8', 'tamoil', 'ip carburanti', 'atac', 'atm milano', 'uber', 'freenow'].map((k) => ({ keyword: k, categoryId: 'trasporti' })),
  ...['farmacia', 'ospedale', 'asl ', 'dentist'].map((k) => ({ keyword: k, categoryId: 'salute' })),
  ...['ristorante', 'pizzeria', 'trattoria', 'osteria', 'bar ', 'mcdonald', 'burger king', 'just eat', 'deliveroo', 'glovo'].map((k) => ({ keyword: k, categoryId: 'ristoranti' })),
  ...['assicurazion', 'unipol', 'generali', 'allianz', 'axa ', 'zurich'].map((k) => ({ keyword: k, categoryId: 'assicurazioni' })),
  ...['f24', 'agenzia entrate', 'imposta di bollo', 'commissioni', 'canone'].map((k) => ({ keyword: k, categoryId: 'tasse' })),
  ...['affitto', 'condominio', 'ikea', 'leroy merlin', 'brico'].map((k) => ({ keyword: k, categoryId: 'casa' })),
]

/**
 * Categoria proposta per una descrizione: prima quella che hai già dato a spese con la stessa chiave
 * (lo storico vince), poi le regole per parola contenuta (la più lunga vince).
 */
export function suggestCategory(desc: string, history: Map<string, string>, rules: CategoryRule[], validIds: Set<string>): string | null {
  const fromHistory = history.get(normalizeDesc(desc))
  if (fromHistory && validIds.has(fromHistory)) return fromHistory
  const d = ` ${desc.toLowerCase()} `
  let best: CategoryRule | null = null
  for (const r of rules) {
    const k = r.keyword.toLowerCase()
    if (k.trim() && d.includes(k) && validIds.has(r.categoryId) && (!best || k.length > best.keyword.length)) best = r
  }
  return best?.categoryId ?? null
}

/** Mappa chiave descrizione -> categoria più recente, dalle spese già salvate */
export function categoryHistory(expenses: { description: string; categoryId: string; date: string }[]) {
  const map = new Map<string, { categoryId: string; date: string }>()
  for (const e of expenses) {
    const k = normalizeDesc(e.description)
    if (!k) continue
    const prev = map.get(k)
    if (!prev || e.date >= prev.date) map.set(k, { categoryId: e.categoryId, date: e.date })
  }
  return new Map([...map].map(([k, v]) => [k, v.categoryId]))
}

// ---------- Ricorrenze ----------

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y)
  const n = s.length
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2
}

function daysBetween(a: string, b: string) {
  const t = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((t(b) - t(a)) / 86_400_000)
}

export function classifyGap(days: number): Frequency | null {
  if (days >= 26 && days <= 35) return 'monthly'
  if (days >= 56 && days <= 66) return 'bimonthly'
  if (days >= 85 && days <= 97) return 'quarterly'
  if (days >= 175 && days <= 190) return 'semiannual'
  if (days >= 350 && days <= 380) return 'yearly'
  return null
}

export interface RecurringCandidate {
  key: string
  name: string
  frequency: Frequency
  count: number
  /** Importo proposto in centesimi (positivo) */
  amount: number
  /** Gli importi cambiano da una volta all'altra (bollette) */
  variable: boolean
  firstDate: string
  lastDate: string
  categoryId: string
  expenseIds: number[]
}

/**
 * Spese che tornano a intervalli regolari con importi simili (±25%): abbonamenti, bollette, affitto.
 * Servono almeno 3 addebiti, o 2 mensili con lo stesso importo.
 */
export function detectRecurring(
  expenses: { id?: number; amount: number; description: string; date: string; categoryId: string; recurringId?: number }[],
  knownKeys: Set<string>,
): RecurringCandidate[] {
  const groups = new Map<string, typeof expenses>()
  for (const e of expenses) {
    if (e.recurringId != null || e.amount <= 0) continue
    const k = normalizeDesc(e.description)
    if (!k || knownKeys.has(k)) continue
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(e)
  }
  const found: RecurringCandidate[] = []
  for (const [key, list] of groups) {
    list.sort((a, b) => a.date.localeCompare(b.date))
    const dates = [...new Set(list.map((e) => e.date))]
    if (dates.length < 2 || dates.length !== list.length) continue // due addebiti nello stesso giorno: non è un abbonamento
    const gaps = dates.slice(1).map((d, i) => daysBetween(dates[i], d))
    const frequency = classifyGap(median(gaps))
    if (!frequency || gaps.filter((g) => classifyGap(g) === frequency).length / gaps.length < 0.7) continue
    const last = list[list.length - 1]
    const prev = list[list.length - 2]
    if (list.length < 3 && last.amount !== prev.amount) continue
    const amounts = list.map((e) => e.amount)
    const med = median(amounts)
    if (!amounts.every((a) => Math.abs(a - med) <= med * 0.25)) continue
    found.push({
      key,
      name: titleCase(key),
      frequency,
      count: list.length,
      // prezzo stabile (anche se aumentato di recente): vale l'ultimo; importo variabile: la mediana
      amount: last.amount === prev.amount ? last.amount : Math.round(med),
      variable: amounts.some((a) => a !== amounts[0]),
      firstDate: list[0].date,
      lastDate: last.date,
      categoryId: last.categoryId,
      expenseIds: list.map((e) => e.id!).filter((id) => id != null),
    })
  }
  return found.sort((a, b) => b.count - a.count || b.amount - a.amount)
}

/** Chiave con cui una ricorrenza riconosce le spese importate */
export const recurringKey = (r: { name: string; matchKey?: string }) => r.matchKey || normalizeDesc(r.name)

/**
 * Una spesa importata paga una ricorrenza se la descrizione ha la sua chiave
 * e la data cade entro 12 giorni dalla scadenza del mese.
 */
export function matchesDue(desc: string, date: string, r: { name: string; matchKey?: string }, dueDate: string) {
  const key = recurringKey(r)
  if (!key) return false
  const k = normalizeDesc(desc)
  return (k === key || k.startsWith(key + ' ') || key.startsWith(k + ' ')) && Math.abs(daysBetween(dueDate, date)) <= 12
}
