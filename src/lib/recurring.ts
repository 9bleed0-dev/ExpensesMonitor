import type { Expense, Frequency, Recurring } from '../db'
import { daysInMonth, monthKey } from './format'

export const FREQUENCIES: Record<Frequency, { label: string; months: number }> = {
  monthly: { label: 'Mensile', months: 1 },
  bimonthly: { label: 'Bimestrale', months: 2 },
  quarterly: { label: 'Trimestrale', months: 3 },
  semiannual: { label: 'Semestrale', months: 6 },
  yearly: { label: 'Annuale', months: 12 },
}

/** Data di scadenza di una ricorrenza nel mese indicato, o null se non scade quel mese */
export function dueDateIn(r: Recurring, year: number, month: number): string | null {
  const [sy, sm, sd] = r.startDate.split('-').map(Number)
  const diff = (year - sy) * 12 + (month - (sm - 1))
  if (diff < 0 || diff % FREQUENCIES[r.frequency].months !== 0) return null
  const day = Math.min(sd, daysInMonth(year, month))
  return `${monthKey(year, month)}-${String(day).padStart(2, '0')}`
}

/** Costo medio mensile di una ricorrenza */
export const monthlyEquivalent = (r: Recurring) => Math.round(r.amount / FREQUENCIES[r.frequency].months)

export interface DueItem {
  recurring: Recurring
  dueDate: string
  paid: Expense | undefined
}

export function dueItemsForMonth(recurring: Recurring[], expenses: Expense[], year: number, month: number): DueItem[] {
  return recurring
    .filter((r) => r.active)
    .map((r) => {
      const dueDate = dueDateIn(r, year, month)
      if (!dueDate) return null
      const paid = expenses.find((e) => e.recurringId === r.id)
      return { recurring: r, dueDate, paid }
    })
    .filter((x): x is DueItem => x !== null)
    .sort((a, b) => Number(!!a.paid) - Number(!!b.paid) || a.dueDate.localeCompare(b.dueDate))
}

/** Data da proporre quando si segna pagata: oggi se siamo nel mese della scadenza, altrimenti la scadenza stessa */
export function payDate(dueDate: string, today: string) {
  return today.slice(0, 7) === dueDate.slice(0, 7) ? today : dueDate
}
