import Dexie, { type EntityTable } from 'dexie'

export type PaymentMethod = 'cash' | 'card' | 'transfer'

export const PAYMENT_METHODS: Record<PaymentMethod, string> = {
  cash: 'Contanti',
  card: 'Carta',
  transfer: 'Bonifico',
}

export type Frequency = 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual' | 'yearly'

export interface Category {
  id: string
  name: string
  color: string
  icon: string
  order: number
  /** Budget mensile opzionale della categoria, in centesimi */
  budget?: number
}

export interface Expense {
  id?: number
  /** Importo in centesimi, per evitare errori di arrotondamento */
  amount: number
  categoryId: string
  description: string
  /** Data in formato YYYY-MM-DD */
  date: string
  recurringId?: number
  /** Metodo di pagamento (opzionale) */
  method?: PaymentMethod
  note?: string
  createdAt: number
}

export interface Recurring {
  id?: number
  name: string
  /** Importo stimato in centesimi */
  amount: number
  categoryId: string
  frequency: Frequency
  /** Prima scadenza (YYYY-MM-DD): definisce giorno e mese di partenza */
  startDate: string
  active: boolean
}

export interface Meta {
  key: string
  value: unknown
}

export const db = new Dexie('expenses-monitor') as Dexie & {
  expenses: EntityTable<Expense, 'id'>
  recurring: EntityTable<Recurring, 'id'>
  categories: EntityTable<Category, 'id'>
  meta: EntityTable<Meta, 'key'>
}

// Nota: note, method e budget di categoria sono campi non indicizzati, quindi non serve una nuova versione dello schema.
db.version(1).stores({
  expenses: '++id, date, categoryId, recurringId',
  recurring: '++id, categoryId',
  categories: 'id, order',
  meta: 'key',
})

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'bollette', name: 'Bollette', color: '#c98500', icon: 'Zap', order: 0 },
  { id: 'casa', name: 'Casa', color: '#9085e9', icon: 'House', order: 1 },
  { id: 'spesa', name: 'Spesa', color: '#199e70', icon: 'ShoppingCart', order: 2 },
  { id: 'trasporti', name: 'Trasporti', color: '#3987e5', icon: 'Car', order: 3 },
  { id: 'ristoranti', name: 'Ristoranti', color: '#d95926', icon: 'Utensils', order: 4 },
  { id: 'abbonamenti', name: 'Abbonamenti', color: '#d55181', icon: 'Tv', order: 5 },
  { id: 'salute', name: 'Salute', color: '#e66767', icon: 'HeartPulse', order: 6 },
  { id: 'assicurazioni', name: 'Assicurazioni', color: '#008300', icon: 'Shield', order: 7 },
  { id: 'svago', name: 'Svago', color: '#b07cf0', icon: 'Sparkles', order: 8 },
  { id: 'tasse', name: 'Tasse', color: '#a87b4f', icon: 'Landmark', order: 9 },
  { id: 'altro', name: 'Altro', color: '#8a8a85', icon: 'Ellipsis', order: 10 },
]

db.on('populate', (tx) => {
  tx.table('categories').bulkAdd(DEFAULT_CATEGORIES)
  tx.table('meta').put({ key: 'monthlyBudget', value: 150000 })
})

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key)
  return (row?.value as T) ?? fallback
}

export function setMeta(key: string, value: unknown) {
  return db.meta.put({ key, value })
}

/** Backup completo del database in JSON */
export async function exportData() {
  const [expenses, recurring, categories, meta] = await Promise.all([
    db.expenses.toArray(),
    db.recurring.toArray(),
    db.categories.toArray(),
    db.meta.toArray(),
  ])
  return { app: 'expenses-monitor', version: 1, exportedAt: new Date().toISOString(), expenses, recurring, categories, meta }
}

export async function importData(data: Awaited<ReturnType<typeof exportData>>) {
  if (data?.app !== 'expenses-monitor') throw new Error('File di backup non valido')
  await db.transaction('rw', [db.expenses, db.recurring, db.categories, db.meta], async () => {
    await Promise.all([db.expenses.clear(), db.recurring.clear(), db.categories.clear(), db.meta.clear()])
    await db.categories.bulkAdd(data.categories)
    await db.recurring.bulkAdd(data.recurring)
    await db.expenses.bulkAdd(data.expenses)
    await db.meta.bulkAdd(data.meta)
  })
}

export async function resetData() {
  await db.delete()
  await db.open()
}
