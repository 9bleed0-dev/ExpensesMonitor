// Prove della logica di import: npm test (Node 23.6+ esegue TypeScript direttamente)
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  categoryHistory,
  DEFAULT_RULES,
  detectDelimiter,
  detectRecurring,
  findHeaderRow,
  guessMapping,
  matchesDue,
  normalizeDesc,
  parseCSV,
  parseDate,
  parseStatementAmount,
  rowsToImport,
  suggestCategory,
} from '../src/lib/importer.ts'

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')

function load(name: string) {
  const text = fixture(name)
  const rows = parseCSV(text, detectDelimiter(text))
  const h = findHeaderRow(rows)
  return { rows, h, mapping: guessMapping(rows[h]) }
}

test('importi degli estratti conto', () => {
  const cases: Record<string, number | null> = {
    '1.234,56': 123456, '-1.234,56': -123456, '1,234.56': 123456, '€ 12,50': 1250, '12,50-': -1250,
    '(12,50)': -1250, '+3.000': 300000, '1234': 123400, '12,5': 1250, '12.50': 1250, '-0,99': -99, '': null, abc: null,
  }
  for (const [s, v] of Object.entries(cases)) assert.equal(parseStatementAmount(s), v, s)
})

test('date', () => {
  assert.equal(parseDate('31/12/2026'), '2026-12-31')
  assert.equal(parseDate('01-02-26'), '2026-02-01')
  assert.equal(parseDate('2026-03-05T10:00:00'), '2026-03-05')
  assert.equal(parseDate('31/02/2026'), null)
})

test('descrizioni normalizzate', () => {
  assert.equal(normalizeDesc('PAGAMENTO POS 12/03 NETFLIX.COM AMSTERDAM CARTA 1234'), 'netflix amsterdam')
  assert.equal(normalizeDesc('Addebito SDD Enel Energia S.p.A. mandato 998'), 'enel energia')
})

test('CSV della banca con righe prima della tabella e Dare/Avere', () => {
  const { rows, h, mapping } = load('banca-esempio.csv')
  assert.equal(rows[h][0], 'Data contabile')
  assert.equal(rows[h][mapping.desc], 'Descrizione')
  assert.equal(mapping.amount, -1)
  const items = rowsToImport(rows, h, { mapping, source: 'banca', skipPaypalInBank: true })
  const ok = items.filter((i) => !i.skip)
  assert.ok(ok.length >= 20, `righe valide: ${ok.length}`)
  assert.ok(ok.every((i) => i.amount! < 0), 'solo uscite')
  assert.equal(items.filter((i) => i.skip === 'entrata').length, 3, 'stipendi saltati')
  assert.ok(items.some((i) => i.skip?.includes('PayPal')), 'pagamenti PayPal saltati')
})

test('CSV PayPal: solo acquisti completati, niente doppioni al secondo import', () => {
  const { rows, h, mapping } = load('paypal-esempio.csv')
  assert.equal(rows[h][mapping.amount], 'Netto')
  assert.equal(rows[h][mapping.desc], 'Nome')
  const items = rowsToImport(rows, h, { mapping, source: 'paypal' })
  const ok = items.filter((i) => !i.skip)
  assert.equal(ok.length, 4)
  assert.ok(items.some((i) => i.skip === 'ricarica PayPal'))
  assert.ok(items.some((i) => i.skip?.startsWith('stato')))
  const again = rowsToImport(rows, h, { mapping, source: 'paypal', existingKeys: new Set(ok.map((i) => i.key!)) })
  assert.equal(again.filter((i) => !i.skip).length, 0)
})

test('riconosce abbonamenti e bollette, non la spesa al supermercato', () => {
  const { rows, h, mapping } = load('banca-esempio.csv')
  const expenses = rowsToImport(rows, h, { mapping, source: 'banca', skipPaypalInBank: true })
    .filter((i) => !i.skip)
    .map((i, n) => ({ id: n, amount: -i.amount!, description: i.desc, date: i.date!, categoryId: 'altro' }))
  const found = detectRecurring(expenses, new Set())
  const byKey = new Map(found.map((f) => [f.key, f]))
  assert.equal(byKey.get('netflix amsterdam')?.frequency, 'monthly')
  assert.equal(byKey.get('netflix amsterdam')?.amount, 1399, 'vale il prezzo più recente')
  assert.ok(byKey.get('enel energia')?.variable)
  assert.ok(![...byKey.keys()].some((k) => k.includes('esselunga')))
  assert.ok(!detectRecurring(expenses, new Set(['netflix amsterdam'])).some((f) => f.key === 'netflix amsterdam'), 'chiavi note escluse')
})

test('categoria: lo storico vince sulle regole', () => {
  const ids = new Set(['spesa', 'casa', 'abbonamenti'])
  const history = categoryHistory([{ description: 'POS ESSELUNGA MILANO', categoryId: 'casa', date: '2026-01-01' }])
  assert.equal(suggestCategory('PAGAMENTO POS ESSELUNGA MILANO', history, DEFAULT_RULES, ids), 'casa')
  assert.equal(suggestCategory('PAGAMENTO POS ESSELUNGA ROMA', new Map(), DEFAULT_RULES, ids), 'spesa')
  assert.equal(suggestCategory('Qualcosa di ignoto', new Map(), DEFAULT_RULES, ids), null)
})

test('una spesa importata paga la bolletta in scadenza', () => {
  const r = { name: 'Enel Energia' }
  assert.ok(matchesDue('ADDEBITO SDD ENEL ENERGIA S.P.A.', '2026-10-10', r, '2026-10-05'))
  assert.ok(!matchesDue('ADDEBITO SDD ENEL ENERGIA S.P.A.', '2026-10-30', r, '2026-10-05'), 'troppo lontana dalla scadenza')
  assert.ok(!matchesDue('NETFLIX', '2026-10-05', r, '2026-10-05'))
})
