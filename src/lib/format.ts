const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
const eurShort = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

export const formatEur = (cents: number) => eur.format(cents / 100)
export const formatEurShort = (cents: number) => eurShort.format(cents / 100)

/** "12,50" | "12.50" | "1.234,56" -> centesimi */
export function parseAmount(input: string): number {
  let s = input.trim().replace(/[€\s]/g, '')
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n * 100) : NaN
}

export const centsToInput = (cents: number) => (cents / 100).toFixed(2).replace('.', ',')

export const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3))

const pad = (n: number) => String(n).padStart(2, '0')

export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayISO = () => toISODate(new Date())

/** Chiave mese "YYYY-MM" */
export const monthKey = (year: number, month: number) => `${year}-${pad(month + 1)}`
export const monthRange = (year: number, month: number) => {
  const start = `${monthKey(year, month)}-01`
  const end = `${monthKey(year, month)}-${pad(daysInMonth(year, month))}`
  return [start, end] as const
}
export const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate()

export function formatDayLabel(iso: string) {
  const today = todayISO()
  const y = new Date()
  y.setDate(y.getDate() - 1)
  if (iso === today) return 'Oggi'
  if (iso === toISODate(y)) return 'Ieri'
  const [yy, mm, dd] = iso.split('-').map(Number)
  return new Date(yy, mm - 1, dd).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
}

export const formatShortDate = (iso: string) => {
  const [yy, mm, dd] = iso.split('-').map(Number)
  return new Date(yy, mm - 1, dd).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}
