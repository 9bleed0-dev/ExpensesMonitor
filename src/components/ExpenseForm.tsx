import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { db, type Expense } from '../db'
import { centsToInput, parseAmount, todayISO } from '../lib/format'
import { useCategories } from '../lib/hooks'
import { CategoryPicker } from './CategoryPicker'
import { Button, Field, Input } from './ui'

export function ExpenseForm({ initial, onDone }: { initial?: Partial<Expense>; onDone: () => void }) {
  const { list: categories } = useCategories()
  const [amount, setAmount] = useState(initial?.amount != null ? centsToInput(initial.amount) : '')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? 'bollette')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [date, setDate] = useState(initial?.date ?? todayISO())
  const cents = parseAmount(amount)
  const valid = Number.isFinite(cents) && cents > 0 && !!date

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    const data = { amount: cents, categoryId, description: description.trim(), date, recurringId: initial?.recurringId }
    if (initial?.id != null) await db.expenses.update(initial.id, data)
    else await db.expenses.add({ ...data, createdAt: Date.now() })
    navigator.vibrate?.(15)
    onDone()
  }

  async function remove() {
    if (initial?.id == null) return
    await db.expenses.delete(initial.id)
    onDone()
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-5 -translate-y-1/2 text-3xl font-bold text-slate-500">€</span>
        <input
          autoFocus={initial?.id == null}
          inputMode="decimal"
          placeholder="0,00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="tabular w-full rounded-3xl border border-white/10 bg-white/5 py-5 pr-5 pl-12 text-4xl font-extrabold outline-none focus:border-violet-400/60 focus:ring-4 focus:ring-violet-500/15"
        />
      </div>
      <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />
      <Field label="Descrizione">
        <Input placeholder="es. Bolletta luce Enel" value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field label="Data">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </Field>
      <div className="flex gap-3 pt-1">
        {initial?.id != null && (
          <Button type="button" variant="danger" onClick={remove} aria-label="Elimina">
            <Trash2 size={18} />
          </Button>
        )}
        <Button type="submit" disabled={!valid} className="flex-1">
          {initial?.id != null ? 'Salva modifiche' : 'Aggiungi spesa'}
        </Button>
      </div>
    </form>
  )
}
