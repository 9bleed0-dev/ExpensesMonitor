// Strumenti MCP: quello che Claude può fare sui dati dell'app.
// Gli importi passano in euro (numeri decimali) e sono salvati in centesimi, come nell'app.

const FREQ_MONTHS = { monthly: 1, bimonthly: 2, quarterly: 3, semiannual: 6, yearly: 12 }
const METHODS = { cash: 'Contanti', card: 'Carta', transfer: 'Bonifico' }

const pad = (n) => String(n).padStart(2, '0')
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const toCents = (eur) => {
  const n = typeof eur === 'string' ? Number(eur.replace(/\./g, '').replace(',', '.')) : Number(eur)
  if (!Number.isFinite(n)) throw new Error(`Importo non valido: ${eur}`)
  return Math.round(n * 100)
}
const eur = (cents) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100)
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s ?? '')
const isMonth = (s) => /^\d{4}-\d{2}$/.test(s ?? '')
const daysInMonth = (y, m) => new Date(y, m, 0).getDate() // m = 1..12

function dueDateIn(r, year, month1) {
  const [sy, sm, sd] = r.startDate.split('-').map(Number)
  const diff = (year - sy) * 12 + (month1 - sm)
  if (diff < 0 || diff % (FREQ_MONTHS[r.frequency] ?? 1) !== 0) return null
  return `${year}-${pad(month1)}-${pad(Math.min(sd, daysInMonth(year, month1)))}`
}

function dueItems(store, monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  const expenses = store.all('expenses').filter((e) => e.date.startsWith(monthKey))
  return store
    .all('recurring')
    .filter((r) => r.active)
    .map((r) => {
      const dueDate = dueDateIn(r, y, m)
      if (!dueDate) return null
      const paid = expenses.find((e) => e.recurringId === r.id)
      return { id: r.id, nome: r.name, scadenza: dueDate, importo_stimato: eur(r.amount), pagata: paid ? { importo: eur(paid.amount), data: paid.date, spesa_id: paid.id } : null }
    })
    .filter(Boolean)
    .sort((a, b) => a.scadenza.localeCompare(b.scadenza))
}

function resolveCategory(store, value) {
  const cats = store.all('categories')
  const v = String(value ?? '').trim().toLowerCase()
  const c = cats.find((c) => c.id.toLowerCase() === v) ?? cats.find((c) => c.name.toLowerCase() === v)
  if (!c) throw new Error(`Categoria "${value}" non trovata. Disponibili: ${cats.map((c) => c.name).join(', ')}`)
  return c.id
}

function balanceOf(store) {
  const base = store.get('meta', 'accountBalance')?.value
  if (!base) return null
  const after = store.all('expenses').filter((e) => e.date > base.date)
  const spent = after.reduce((s, e) => s + e.amount, 0)
  return { saldo_inserito: eur(base.amount), alla_data: base.date, spese_successive: eur(spent), saldo_stimato: eur(base.amount - spent) }
}

function showExpense(e, cats) {
  return {
    id: e.id,
    data: e.date,
    importo: eur(e.amount),
    descrizione: e.description,
    categoria: cats.get(e.categoryId)?.name ?? e.categoryId,
    ...(e.method && { metodo: METHODS[e.method] }),
    ...(e.note && { nota: e.note }),
    ...(e.recurringId != null && { bolletta_id: e.recurringId }),
  }
}

const str = (description) => ({ type: 'string', description })
const num = (description) => ({ type: 'number', description })

export const TOOLS = [
  {
    name: 'riepilogo_mese',
    description: 'Riepilogo di un mese: totale speso, spesa per categoria, budget, bollette in scadenza e saldo del conto stimato.',
    inputSchema: { type: 'object', properties: { mese: str('Mese YYYY-MM (default: mese corrente)') } },
    run(store, { mese }) {
      const key = isMonth(mese) ? mese : today().slice(0, 7)
      const cats = new Map(store.all('categories').map((c) => [c.id, c]))
      const items = store.all('expenses').filter((e) => e.date.startsWith(key))
      const total = items.reduce((s, e) => s + e.amount, 0)
      const byCat = new Map()
      for (const e of items) byCat.set(e.categoryId, (byCat.get(e.categoryId) ?? 0) + e.amount)
      const budget = store.get('meta', 'monthlyBudget')?.value ?? 0
      return {
        mese: key,
        totale: eur(total),
        movimenti: items.length,
        ...(budget > 0 && { budget: eur(budget), residuo: eur(budget - total) }),
        per_categoria: [...byCat.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([id, amount]) => {
            const c = cats.get(id)
            return { categoria: c?.name ?? id, totale: eur(amount), ...(c?.budget && { budget: eur(c.budget) }) }
          }),
        bollette: dueItems(store, key),
        saldo_conto: balanceOf(store),
      }
    },
  },
  {
    name: 'elenca_spese',
    description: 'Elenca le spese, filtrabili per periodo, categoria e testo (descrizione o nota). Ordinate dalla più recente.',
    inputSchema: {
      type: 'object',
      properties: { da: str('Data iniziale YYYY-MM-DD'), a: str('Data finale YYYY-MM-DD'), categoria: str('Nome o id categoria'), testo: str('Testo da cercare'), limite: num('Massimo risultati (default 50)') },
    },
    run(store, { da, a, categoria, testo, limite }) {
      const cats = new Map(store.all('categories').map((c) => [c.id, c]))
      const catId = categoria ? resolveCategory(store, categoria) : null
      const t = testo?.toLowerCase()
      const list = store
        .all('expenses')
        .filter((e) => (!da || e.date >= da) && (!a || e.date <= a) && (!catId || e.categoryId === catId))
        .filter((e) => !t || e.description.toLowerCase().includes(t) || (e.note ?? '').toLowerCase().includes(t))
        .sort((x, y) => y.date.localeCompare(x.date) || (y.createdAt ?? 0) - (x.createdAt ?? 0))
      const shown = list.slice(0, Math.min(Number(limite) || 50, 500))
      return { trovate: list.length, totale: eur(list.reduce((s, e) => s + e.amount, 0)), spese: shown.map((e) => showExpense(e, cats)) }
    },
  },
  {
    name: 'aggiungi_spesa',
    description: 'Registra una nuova spesa.',
    inputSchema: {
      type: 'object',
      required: ['importo', 'categoria'],
      properties: {
        importo: num('Importo in euro, es. 12.5'),
        categoria: str('Nome o id della categoria (vedi elenca_categorie)'),
        descrizione: str('Descrizione'),
        data: str('YYYY-MM-DD (default oggi)'),
        metodo: { type: 'string', enum: Object.keys(METHODS), description: 'cash, card o transfer' },
        nota: str('Nota facoltativa'),
      },
    },
    run(store, args) {
      const e = {
        id: store.newId('expenses'),
        amount: toCents(args.importo),
        categoryId: resolveCategory(store, args.categoria),
        description: String(args.descrizione ?? '').trim(),
        date: isDate(args.data) ? args.data : today(),
        createdAt: Date.now(),
        ...(METHODS[args.metodo] && { method: args.metodo }),
        ...(args.nota && { note: String(args.nota) }),
      }
      store.put('expenses', e)
      return { aggiunta: showExpense(e, new Map(store.all('categories').map((c) => [c.id, c]))) }
    },
  },
  {
    name: 'modifica_spesa',
    description: 'Modifica una spesa esistente (solo i campi indicati).',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: num('Id della spesa'), importo: num('Euro'), categoria: str('Nome o id'), descrizione: str(''), data: str('YYYY-MM-DD'), metodo: { type: 'string', enum: Object.keys(METHODS) }, nota: str('') },
    },
    run(store, args) {
      const e = store.get('expenses', args.id)
      if (!e) throw new Error(`Spesa ${args.id} non trovata`)
      if (args.importo != null) e.amount = toCents(args.importo)
      if (args.categoria != null) e.categoryId = resolveCategory(store, args.categoria)
      if (args.descrizione != null) e.description = String(args.descrizione)
      if (isDate(args.data)) e.date = args.data
      if (METHODS[args.metodo]) e.method = args.metodo
      if (args.nota != null) e.note = String(args.nota) || undefined
      store.put('expenses', e)
      return { modificata: showExpense(e, new Map(store.all('categories').map((c) => [c.id, c]))) }
    },
  },
  {
    name: 'elimina_spesa',
    description: 'Elimina una spesa per id.',
    inputSchema: { type: 'object', required: ['id'], properties: { id: num('Id della spesa') } },
    run(store, { id }) {
      const e = store.get('expenses', id)
      if (!e) throw new Error(`Spesa ${id} non trovata`)
      store.remove('expenses', id)
      return { eliminata: { id, data: e.date, importo: eur(e.amount), descrizione: e.description } }
    },
  },
  {
    name: 'elenca_categorie',
    description: 'Elenca le categorie con id e budget mensile.',
    inputSchema: { type: 'object', properties: {} },
    run(store) {
      return store
        .all('categories')
        .sort((a, b) => a.order - b.order)
        .map((c) => ({ id: c.id, nome: c.name, ...(c.budget && { budget: eur(c.budget) }) }))
    },
  },
  {
    name: 'elenca_bollette',
    description: 'Bollette e spese ricorrenti di un mese, con scadenza e stato di pagamento. Senza mese: elenco di tutte le ricorrenze.',
    inputSchema: { type: 'object', properties: { mese: str('Mese YYYY-MM') } },
    run(store, { mese }) {
      if (isMonth(mese)) return dueItems(store, mese)
      return store.all('recurring').map((r) => ({ id: r.id, nome: r.name, importo_stimato: eur(r.amount), frequenza: r.frequency, prima_scadenza: r.startDate, attiva: r.active }))
    },
  },
  {
    name: 'segna_bolletta_pagata',
    description: 'Segna pagata una bolletta ricorrente registrando la spesa collegata.',
    inputSchema: {
      type: 'object',
      required: ['bolletta_id'],
      properties: { bolletta_id: num('Id della ricorrenza (vedi elenca_bollette)'), importo: num('Importo reale in euro (default: stimato)'), data: str('YYYY-MM-DD (default oggi)'), metodo: { type: 'string', enum: Object.keys(METHODS) } },
    },
    run(store, args) {
      const r = store.get('recurring', args.bolletta_id)
      if (!r) throw new Error(`Bolletta ${args.bolletta_id} non trovata`)
      const e = {
        id: store.newId('expenses'),
        amount: args.importo != null ? toCents(args.importo) : r.amount,
        categoryId: r.categoryId,
        description: r.name,
        date: isDate(args.data) ? args.data : today(),
        recurringId: r.id,
        createdAt: Date.now(),
        ...(METHODS[args.metodo] && { method: args.metodo }),
      }
      store.put('expenses', e)
      return { pagata: showExpense(e, new Map(store.all('categories').map((c) => [c.id, c]))) }
    },
  },
  {
    name: 'saldo_conto',
    description: 'Saldo del conto stimato: ultimo saldo inserito meno le spese registrate dopo quella data.',
    inputSchema: { type: 'object', properties: {} },
    run: (store) => balanceOf(store) ?? { messaggio: 'Saldo non impostato' },
  },
  {
    name: 'imposta_saldo',
    description: "Imposta il saldo del conto letto dall'home banking.",
    inputSchema: { type: 'object', required: ['importo'], properties: { importo: num('Saldo in euro (anche negativo)'), data: str('YYYY-MM-DD del saldo (default oggi)') } },
    run(store, { importo, data }) {
      store.put('meta', { key: 'accountBalance', value: { amount: toCents(importo), date: isDate(data) ? data : today() } })
      return balanceOf(store)
    },
  },
]

export function callTool(store, name, args) {
  const tool = TOOLS.find((t) => t.name === name)
  if (!tool) throw new Error(`Strumento sconosciuto: ${name}`)
  return store.tx(() => tool.run(store, args ?? {}))
}
