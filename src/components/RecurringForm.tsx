import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { db, type Frequency, type Recurring } from '../db'
import { centsToInput, parseAmount, todayISO } from '../lib/format'
import { useCategories } from '../lib/hooks'
import { FREQUENCIES } from '../lib/recurring'
import { CategoryPicker } from './CategoryPicker'
import { Button, Field, Input, Select } from './ui'

export function RecurringForm({ initial, onDone }: { initial?: Partial<Recurring>; onDone: () => void }) {
  const { list: categories } = useCategories()
  const [name, setName] = useState(initial?.name ?? '')
  const [amount, setAmount] = useState(initial?.amount != null ? centsToInput(initial.amount) : '')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? 'bollette')
  const [frequency, setFrequency] = useState<Frequency>(initial?.frequency ?? 'monthly')
  const [startDate, setStartDate] = useState(initial?.startDate ?? todayISO())
  const [active, setActive] = useState(initial?.active ?? true)
  const cents = parseAmount(amount)
  const valid = name.trim() && Number.isFinite(cents) && cents > 0 && startDate

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    const data = { name: name.trim(), amount: cents, categoryId, frequency, startDate, active }
    if (initial?.id != null) await db.recurring.update(initial.id, data)
    else await db.recurring.add(data)
    onDone()
  }

  async function remove() {
    if (initial?.id == null) return
    await db.transaction('rw', db.recurring, db.expenses, async () => {
      await db.expenses.where('recurringId').equals(initial.id!).modify({ recurringId: undefined })
      await db.recurring.delete(initial.id!)
    })
    onDone()
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <Field label="Nome">
        <Input autoFocus={initial?.id == null} placeholder="es. Luce, Gas, Netflix, Affitto" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Importo stimato €">
          <Input inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} className="tabular" />
        </Field>
        <Field label="Frequenza">
          <Select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
            {Object.entries(FREQUENCIES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Prima scadenza">
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </Field>
      <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />
      <label className="flex cursor-pointer items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
        <span className="font-medium">Attiva</span>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-5 w-5 accent-violet-500" />
      </label>
      <div className="flex gap-3 pt-1">
        {initial?.id != null && (
          <Button type="button" variant="danger" onClick={remove} aria-label="Elimina">
            <Trash2 size={18} />
          </Button>
        )}
        <Button type="submit" disabled={!valid} className="flex-1">
          {initial?.id != null ? 'Salva' : 'Aggiungi ricorrenza'}
        </Button>
      </div>
    </form>
  )
}
