import type { Category, Expense, Recurring } from '../db'
import { daysInMonth } from './format'
import { byCategory } from './hooks'
import { dueItemsForMonth } from './recurring'

export interface MonthStats {
  /** Giorni trascorsi nel mese (tutti se il mese è passato) */
  elapsed: number
  days: number
  isCurrent: boolean
  isFuture: boolean
  dailyAvg: number
  /** Stima a fine mese: spese variabili al ritmo attuale + bollette del mese (pagate o attese). Solo mese corrente. */
  projection: number | null
  topDay: { date: string; amount: number } | null
}

export function monthStats(expenses: Expense[], recurring: Recurring[], year: number, month: number, now = new Date()): MonthStats {
  const days = daysInMonth(year, month)
  const ord = year * 12 + month
  const nowOrd = now.getFullYear() * 12 + now.getMonth()
  const isCurrent = ord === nowOrd
  const isFuture = ord > nowOrd
  const elapsed = isCurrent ? now.getDate() : isFuture ? 0 : days
  const total = expenses.reduce((s, e) => s + e.amount, 0)

  let projection: number | null = null
  if (isCurrent) {
    const variable = expenses.filter((e) => e.recurringId == null).reduce((s, e) => s + e.amount, 0)
    const bills = dueItemsForMonth(recurring, expenses, year, month).reduce((s, d) => s + (d.paid ? d.paid.amount : d.recurring.amount), 0)
    // Le bollette pagate senza ricorrenza collegata restano nelle variabili; quelle collegate entrano una sola volta
    projection = Math.max(total, Math.round((variable / Math.max(elapsed, 1)) * days) + bills)
  }

  const perDay = new Map<string, number>()
  for (const e of expenses) perDay.set(e.date, (perDay.get(e.date) ?? 0) + e.amount)
  let topDay: MonthStats['topDay'] = null
  for (const [date, amount] of perDay) if (!topDay || amount > topDay.amount) topDay = { date, amount }

  return { elapsed, days, isCurrent, isFuture, dailyAvg: elapsed ? Math.round(total / elapsed) : 0, projection, topDay }
}

export interface CategoryChange {
  category?: Category
  categoryId: string
  current: number
  previous: number
  diff: number
}

/** Variazioni per categoria rispetto al mese precedente, ordinate per differenza */
export function categoryChanges(current: Expense[], previous: Expense[], map: Map<string, Category>): CategoryChange[] {
  const cur = new Map(byCategory(current).map((c) => [c.categoryId, c.amount]))
  const prev = new Map(byCategory(previous).map((c) => [c.categoryId, c.amount]))
  const ids = new Set([...cur.keys(), ...prev.keys()])
  return [...ids]
    .map((id) => {
      const c = cur.get(id) ?? 0
      const p = prev.get(id) ?? 0
      return { categoryId: id, category: map.get(id), current: c, previous: p, diff: c - p }
    })
    .sort((a, b) => b.diff - a.diff)
}

/** Categorie con budget mensile e relativa percentuale di utilizzo, dalla più critica */
export function categoryBudgets(expenses: Expense[], categories: Category[]) {
  const totals = new Map(byCategory(expenses).map((c) => [c.categoryId, c.amount]))
  return categories
    .filter((c) => (c.budget ?? 0) > 0)
    .map((c) => ({ category: c, spent: totals.get(c.id) ?? 0, budget: c.budget!, pct: (totals.get(c.id) ?? 0) / c.budget! }))
    .sort((a, b) => b.pct - a.pct)
}
