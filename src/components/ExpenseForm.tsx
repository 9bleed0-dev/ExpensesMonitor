import { CalendarDays, Copy, StickyNote, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { db, PAYMENT_METHODS, type Expense, type Income, type PaymentMethod } from '../db'
import { useExpenseActions } from '../lib/actions'
import { addDays, centsToInput, evaluateAmount, formatEur, formatShortDate, hasOperator, todayISO } from '../lib/format'
import { haptic } from '../lib/haptics'
import { matchSuggestions, useCategories, useCategoriesByUse, useMediaQuery, useSuggestions, type Suggestion } from '../lib/hooks'
import { CategoryIcon } from './CategoryIcon'
import { CategoryPicker } from './CategoryPicker'
import { METHOD_ICONS } from './ExpenseRow'
import { Keypad } from './Keypad'
import { useToast } from './Toast'
import { Button, Input } from './ui'

export type EntryKind = 'expense' | 'income'

export function ExpenseForm({ initial, initialIncome, onDone }: { initial?: Partial<Expense>; initialIncome?: Partial<Income>; onDone: () => void }) {
  const { map } = useCategories()
  const categories = useCategoriesByUse()
  const toast = useToast()
  const [kind, setKind] = useState<EntryKind>(initialIncome ? 'income' : 'expense')
  const isIncome = kind === 'income'
  const suggestions = useSuggestions()
  const { remove, duplicate } = useExpenseActions()
  // Su touch: tastierino calcolatrice; con mouse/tastiera: campo di testo (accetta comunque "12+3")
  const coarse = useMediaQuery('(pointer: coarse)')
  const narrow = useMediaQuery('(max-width: 640px)')
  const touch = coarse || (narrow && navigator.maxTouchPoints > 0)
  const editing = initial?.id != null || initialIncome?.id != null

  const startAmount = initialIncome?.amount ?? initial?.amount
  const [amount, setAmount] = useState(startAmount != null ? centsToInput(startAmount).replace(/,00$/, '') : '')
  // Nuova spesa: la categoria più usata di recente
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '')
  const category = categoryId || categories[0]?.id || 'altro'
  const [description, setDescription] = useState(initialIncome?.description ?? initial?.description ?? '')
  const [date, setDate] = useState(initialIncome?.date ?? initial?.date ?? todayISO())
  const [method, setMethod] = useState<PaymentMethod | undefined>(initial?.method)
  const [note, setNote] = useState(initialIncome?.note ?? initial?.note ?? '')
  const [showNote, setShowNote] = useState(!!(initialIncome?.note ?? initial?.note))
  const [picked, setPicked] = useState(editing || initial?.recurringId != null)

  const cents = evaluateAmount(amount.replace(/[+−,]$/, ''))
  const valid = Number.isFinite(cents) && cents > 0 && !!date
  const shown = useMemo(() => (picked || isIncome ? [] : matchSuggestions(suggestions, description, 6)), [picked, isIncome, suggestions, description])

  const submitLabel = editing ? 'Salva modifiche' : isIncome ? 'Aggiungi entrata' : 'Aggiungi spesa'
  const today = todayISO()
  const yesterday = addDays(today, -1)

  function applySuggestion(s: Suggestion) {
    haptic('select')
    setDescription(s.description)
    setCategoryId(s.categoryId)
    if (!amount) setAmount(centsToInput(s.amount).replace(/,00$/, ''))
    if (!method && s.method) setMethod(s.method)
    setPicked(true)
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault()
    if (!valid) return
    if (isIncome) return saveIncome()
    const data = {
      amount: cents,
      categoryId: category,
      description: description.trim(),
      date,
      recurringId: initial?.recurringId,
      method,
      note: note.trim() || undefined,
    }
    if (editing) await db.expenses.update(initial!.id!, data)
    else {
      const id = await db.expenses.add({ ...data, createdAt: Date.now() })
      toast({ text: `Spesa aggiunta · ${formatEur(cents)}`, action: { label: 'Annulla', onClick: () => void db.expenses.delete(id) } })
    }
    haptic('success')
    onDone()
  }

  async function saveIncome() {
    const data = { amount: cents, description: description.trim(), date, note: note.trim() || undefined }
    if (initialIncome?.id != null) await db.incomes.update(initialIncome.id, data)
    else {
      const id = await db.incomes.add({ ...data, createdAt: Date.now() })
      toast({ text: `Entrata aggiunta · ${formatEur(cents)}`, action: { label: 'Annulla', onClick: () => void db.incomes.delete(id) } })
    }
    haptic('success')
    onDone()
  }

  async function removeIncome() {
    if (initialIncome?.id == null) return
    const saved = await db.incomes.get(initialIncome.id)
    await db.incomes.delete(initialIncome.id)
    haptic('warning')
    if (saved) toast({ text: 'Entrata eliminata', action: { label: 'Annulla', onClick: () => void db.incomes.add(saved) } })
    onDone()
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {!editing && (
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-fg/5 p-1" role="radiogroup" aria-label="Tipo">
          {(['expense', 'income'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => {
                haptic('select')
                setKind(k)
              }}
              className={`relative rounded-xl py-2 text-sm font-semibold transition-colors ${kind === k ? 'text-ink' : 'text-muted'}`}
            >
              {kind === k && <motion.span layoutId="kind-pill" className="absolute inset-0 rounded-xl bg-surface shadow-md ring-1 ring-fg/10" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
              <span className="relative">{k === 'expense' ? 'Spesa' : 'Entrata'}</span>
            </button>
          ))}
        </div>
      )}
      {/* Importo */}
      <div className="relative">
        {touch ? (
          <div className="flex min-h-[5.5rem] flex-col justify-center rounded-3xl border border-fg/10 bg-fg/5 px-5 py-3" aria-live="polite">
            <AnimatePresence initial={false}>
              {hasOperator(amount) && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="tabular truncate text-sm font-semibold text-muted">
                  {amount.replace(/([+−])/g, ' $1 ')}
                </motion.div>
              )}
            </AnimatePresence>
            <div className="tabular flex items-baseline gap-2 text-4xl font-extrabold">
              <span className="text-3xl text-faint">€</span>
              <span className={amount ? '' : 'text-faint'}>{hasOperator(amount) ? (Number.isFinite(cents) ? centsToInput(cents) : '…') : amount || '0'}</span>
              <motion.span className="-ml-1 inline-block h-8 w-0.5 self-center rounded bg-accent" animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1.1, repeat: Infinity }} />
            </div>
          </div>
        ) : (
          <>
            <span className="pointer-events-none absolute top-1/2 left-5 -translate-y-1/2 text-3xl font-bold text-faint">€</span>
            <input
              autoFocus={!editing}
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/-/g, '−').replace(/[^0-9,.+−]/g, ''))}
              aria-label="Importo"
              className="tabular w-full rounded-3xl border border-fg/10 bg-fg/5 py-5 pr-5 pl-12 text-4xl font-extrabold outline-none placeholder:text-faint focus:border-accent/60 focus:ring-4 focus:ring-accent/15"
            />
            <AnimatePresence>
              {hasOperator(amount) && Number.isFinite(cents) && (
                <motion.span initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="tabular absolute top-1/2 right-5 -translate-y-1/2 text-lg font-bold text-muted">
                  = {formatEur(cents)}
                </motion.span>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Descrizione + suggerimenti dallo storico */}
      <div>
        <Input
          placeholder={isIncome ? 'Descrizione (es. Stipendio)' : 'Descrizione (es. Spesa Esselunga)'}
          value={description}
          onChange={(e) => {
            setDescription(e.target.value)
            setPicked(false)
          }}
          aria-label="Descrizione"
          enterKeyHint="done"
        />
        <AnimatePresence initial={false}>
          {shown.length > 0 && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="-mx-6 overflow-hidden">
              <div className="no-scrollbar flex gap-2 overflow-x-auto px-6 pt-2" data-noswipe>
                <AnimatePresence mode="popLayout" initial={false}>
                  {shown.map((s) => (
                    <motion.button
                      layout
                      key={s.description}
                      type="button"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => applySuggestion(s)}
                      className="flex shrink-0 items-center gap-2 rounded-full border border-fg/10 bg-fg/5 py-1 pr-3 pl-1 text-sm hover:bg-fg/10"
                    >
                      <CategoryIcon category={map.get(s.categoryId)} size={24} />
                      <span className="max-w-40 truncate font-semibold">{s.description}</span>
                      <span className="tabular text-xs text-muted">{formatEur(s.amount)}</span>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!isIncome && <CategoryPicker categories={categories} value={category} onChange={setCategoryId} compact />}

      {/* Data rapida */}
      <div className="flex items-center gap-2">
        {[
          { iso: today, label: 'Oggi' },
          { iso: yesterday, label: 'Ieri' },
        ].map((d) => (
          <Pill key={d.label} active={date === d.iso} onClick={() => setDate(d.iso)}>
            {d.label}
          </Pill>
        ))}
        <label className={`relative flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold ${date !== today && date !== yesterday ? 'border-accent/50 bg-accent/10 text-accent' : 'border-fg/10 bg-fg/5 text-muted'}`}>
          <CalendarDays size={16} className="shrink-0" />
          <span className="truncate">{date !== today && date !== yesterday ? formatShortDate(date) : 'Altra data'}</span>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Data" />
        </label>
      </div>

      {/* Metodo di pagamento (opzionale) + nota */}
      <div className="no-scrollbar -mx-6 flex items-center gap-2 overflow-x-auto px-6" data-noswipe>
        {!isIncome && (Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((m) => {
          const Icon = METHOD_ICONS[m]
          return (
            <Pill key={m} active={method === m} onClick={() => setMethod(method === m ? undefined : m)}>
              <Icon size={15} /> {PAYMENT_METHODS[m]}
            </Pill>
          )
        })}
        <Pill active={showNote} onClick={() => setShowNote(!showNote)}>
          <StickyNote size={15} /> Nota
        </Pill>
      </div>
      <AnimatePresence initial={false}>
        {showNote && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="-m-1 overflow-hidden p-1">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nota (facoltativa)"
              rows={2}
              aria-label="Nota"
              className="w-full resize-none rounded-2xl border border-fg/10 bg-fg/5 px-4 py-3 outline-none placeholder:text-faint focus:border-accent/60 focus:ring-4 focus:ring-accent/15"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {editing && isIncome && (
        <Button type="button" variant="danger" className="w-full" onClick={removeIncome}>
          <Trash2 size={17} /> Elimina entrata
        </Button>
      )}
      {editing && !isIncome && (
        <div className="flex gap-2">
          <Button type="button" variant="danger" className="flex-1" onClick={() => (remove(initial as Expense), onDone())}>
            <Trash2 size={17} /> Elimina
          </Button>
          <Button type="button" variant="ghost" className="flex-1" onClick={() => (duplicate(initial as Expense), onDone())}>
            <Copy size={17} /> Duplica oggi
          </Button>
        </div>
      )}

      {touch ? (
        <Keypad value={amount} onChange={setAmount} onSubmit={() => save()} canSubmit={valid} submitLabel={submitLabel} />
      ) : (
        <Button type="submit" disabled={!valid} className="w-full">
          {submitLabel}
        </Button>
      )}
    </form>
  )
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      onClick={() => {
        haptic('select')
        onClick()
      }}
      aria-pressed={active}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${active ? 'border-accent/50 bg-accent/10 text-accent' : 'border-fg/10 bg-fg/5 text-muted hover:text-ink'}`}
    >
      {children}
    </motion.button>
  )
}
