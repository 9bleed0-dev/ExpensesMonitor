import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useSyncExternalStore } from 'react'
import { db, getMeta, type Category, type Expense } from '../db'
import { addDays, monthKey, monthRange, shiftMonth, todayISO } from './format'
import { dueItemsForMonth } from './recurring'
import { themed, useTheme, type Theme } from './theme'

/**
 * Categorie con il colore adattato al tema corrente (per la UI).
 * `raw` contiene i valori salvati: usarlo quando si modifica/salva una categoria.
 */
export function useCategories() {
  const raw = useLiveQuery(() => db.categories.orderBy('order').toArray(), [], [] as Category[])
  const { theme } = useTheme()
  const list = useMemo(() => raw.map((c) => ({ ...c, color: themed(c.color, theme) })), [raw, theme])
  const map = useMemo(() => new Map(list.map((c) => [c.id, c])), [list])
  return { list, map, raw }
}

export function useMonthExpenses(year: number, month: number) {
  return useLiveQuery(() => {
    const [start, end] = monthRange(year, month)
    return db.expenses.where('date').between(start, end, true, true).reverse().sortBy('date')
  }, [year, month])
}

export function useYearExpenses(year: number) {
  return useLiveQuery(() => db.expenses.where('date').between(`${year}-01-01`, `${year}-12-31`, true, true).toArray(), [year])
}

export function useRecurring() {
  return useLiveQuery(() => db.recurring.toArray(), [], [])
}

export function useBudget() {
  return useLiveQuery(() => getMeta<number>('monthlyBudget', 0), [], 0)
}

export const sumAmounts = (items: { amount: number }[] | undefined) => (items ?? []).reduce((s, e) => s + e.amount, 0)

export function byCategory(items: { amount: number; categoryId: string }[]) {
  const totals = new Map<string, number>()
  for (const e of items) totals.set(e.categoryId, (totals.get(e.categoryId) ?? 0) + e.amount)
  return [...totals.entries()].map(([categoryId, amount]) => ({ categoryId, amount })).sort((a, b) => b.amount - a.amount)
}

/** Prime N categorie per importo, le altre accorpate in "Altre" (mai colori generati oltre la palette) */
export function toSlices(totals: { categoryId: string; amount: number }[], map: Map<string, Category>, theme: Theme = 'dark', max = 6) {
  const head = totals.slice(0, max).map((t) => {
    const c = map.get(t.categoryId)
    return { key: t.categoryId, name: c?.name ?? 'Senza categoria', color: c?.color ?? '#8a8a85', amount: t.amount, category: c }
  })
  const rest = totals.slice(max).reduce((s, t) => s + t.amount, 0)
  if (rest > 0) head.push({ key: '__other', name: 'Altre', color: themed('#5c5c66', theme), amount: rest, category: undefined })
  return head
}

export interface Suggestion {
  description: string
  categoryId: string
  amount: number
  method?: Expense['method']
  count: number
  lastDate: string
}

/** Descrizioni usate in passato (ultime ~800 spese), con categoria e importo più recenti */
export function useSuggestions() {
  const recent = useLiveQuery(() => db.expenses.orderBy('date').reverse().limit(800).toArray(), [], [] as Expense[])
  return useMemo(() => {
    const map = new Map<string, Suggestion>()
    for (const e of recent) {
      const d = e.description.trim()
      if (!d) continue
      const k = d.toLowerCase()
      const s = map.get(k)
      if (s) s.count++
      else map.set(k, { description: d, categoryId: e.categoryId, amount: e.amount, method: e.method, count: 1, lastDate: e.date })
    }
    return [...map.values()].sort((a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate))
  }, [recent])
}

export function matchSuggestions(all: Suggestion[], query: string, max = 5) {
  const q = query.trim().toLowerCase()
  if (!q) return all.slice(0, max)
  const starts = all.filter((s) => s.description.toLowerCase().startsWith(q) && s.description.toLowerCase() !== q)
  const contains = all.filter((s) => !s.description.toLowerCase().startsWith(q) && s.description.toLowerCase().includes(q))
  return [...starts, ...contains].slice(0, max)
}

/** Bollette non pagate scadute nel mese corrente o in scadenza nei prossimi `days` giorni (rispetto a oggi) */
export function useUpcomingBills(days = 7) {
  const today = todayISO()
  const horizon = addDays(today, days)
  const data = useLiveQuery(async () => {
    const [recurring, expenses] = await Promise.all([
      db.recurring.toArray(),
      db.expenses.where('date').between(`${today.slice(0, 7)}-01`, `${horizon.slice(0, 7)}-31`, true, true).toArray(),
    ])
    return { recurring, expenses }
  }, [today, horizon])
  return useMemo(() => {
    if (!data) return []
    const now = new Date()
    const months = [{ year: now.getFullYear(), month: now.getMonth() }]
    if (horizon.slice(0, 7) !== today.slice(0, 7)) months.push(shiftMonth(months[0], 1))
    return months
      .flatMap(({ year, month }) => {
        const key = monthKey(year, month)
        return dueItemsForMonth(data.recurring, data.expenses.filter((e) => e.date.startsWith(key)), year, month)
      })
      .filter((d) => !d.paid && d.dueDate <= horizon)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  }, [data, today, horizon])
}

/** Ricerca testuale su tutte le spese (descrizione, nota, categoria) */
export function useSearchAll(query: string, map: Map<string, Category>) {
  const q = query.trim().toLowerCase()
  return useLiveQuery(async () => {
    if (!q) return [] as Expense[]
    const cats = new Set([...map.values()].filter((c) => c.name.toLowerCase().includes(q)).map((c) => c.id))
    const all = await db.expenses
      .filter((e) => e.description.toLowerCase().includes(q) || (e.note ?? '').toLowerCase().includes(q) || cats.has(e.categoryId))
      .toArray()
    return all.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  }, [q, map])
}

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
  )
}
