import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db, getMeta, type Category } from '../db'
import { monthRange } from './format'

export function useCategories() {
  const list = useLiveQuery(() => db.categories.orderBy('order').toArray(), [], [] as Category[])
  const map = useMemo(() => new Map(list.map((c) => [c.id, c])), [list])
  return { list, map }
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
export function toSlices(totals: { categoryId: string; amount: number }[], map: Map<string, Category>, max = 6) {
  const head = totals.slice(0, max).map((t) => {
    const c = map.get(t.categoryId)
    return { key: t.categoryId, name: c?.name ?? 'Senza categoria', color: c?.color ?? '#8a8a85', amount: t.amount, category: c }
  })
  const rest = totals.slice(max).reduce((s, t) => s + t.amount, 0)
  if (rest > 0) head.push({ key: '__other', name: 'Altre', color: '#5c5c66', amount: rest, category: undefined })
  return head
}
