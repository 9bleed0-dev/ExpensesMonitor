import { Globe, ReceiptText, Search, SearchX, X } from 'lucide-react'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import type { AppActions } from '../App'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { ExpenseRow } from '../components/ExpenseRow'
import { PeriodNav, SwipePeriod } from '../components/MonthNav'
import { EmptyState, Skeleton } from '../components/ui'
import type { Expense } from '../db'
import { formatDayLabel, formatEur, MONTHS, shiftMonth } from '../lib/format'
import { haptic } from '../lib/haptics'
import { sumAmounts, useCategories, useMonthExpenses, useSearchAll } from '../lib/hooks'

export function Expenses({ period, setPeriod, openExpense }: AppActions) {
  const { year, month } = period
  const expenses = useMonthExpenses(year, month)
  const { list: categories, map } = useCategories()
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<string | null>(null)
  const [everywhere, setEverywhere] = useState(false)
  const global = everywhere && query.trim().length > 0
  const globalResults = useSearchAll(global ? query : '', map)

  const filtered = useMemo(() => {
    if (global) return (globalResults ?? []).filter((e) => !cat || e.categoryId === cat)
    const q = query.trim().toLowerCase()
    return (expenses ?? []).filter(
      (e) =>
        (!cat || e.categoryId === cat) &&
        (!q || e.description.toLowerCase().includes(q) || (e.note ?? '').toLowerCase().includes(q) || map.get(e.categoryId)?.name.toLowerCase().includes(q)),
    )
  }, [global, globalResults, expenses, query, cat, map])

  const groups = useMemo(() => {
    const g = new Map<string, Expense[]>()
    for (const e of filtered) g.set(e.date, [...(g.get(e.date) ?? []), e])
    return [...g.entries()]
  }, [filtered])

  const source = global ? globalResults : expenses
  const usedCats = useMemo(() => categories.filter((c) => source?.some((e) => e.categoryId === c.id)), [categories, source])
  const loading = source === undefined
  const thisYear = new Date().getFullYear()

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Spese</h1>
          <p className="text-sm text-muted">
            {filtered.length} movimenti{global ? ' in tutti i mesi' : ''} · <AnimatedNumber value={sumAmounts(filtered)} className="font-semibold text-ink-soft" />
          </p>
        </div>
        <AnimatePresence initial={false}>
          {!global && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
              <PeriodNav
                label={`${MONTHS[month]} ${year}`}
                ordinal={year * 12 + month}
                isCurrent={year === new Date().getFullYear() && month === new Date().getMonth()}
                onPrev={() => setPeriod(shiftMonth(period, -1))}
                onNext={() => setPeriod(shiftMonth(period, 1))}
                onReset={() => setPeriod({ year: new Date().getFullYear(), month: new Date().getMonth() })}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <div className="flex gap-2">
        <div className="glass flex min-w-0 flex-1 items-center gap-2 rounded-2xl px-4 focus-within:ring-2 focus-within:ring-accent/40">
          <Search size={18} className="shrink-0 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={everywhere ? 'Cerca in tutti i mesi' : 'Cerca descrizione, nota, categoria'}
            className="w-full min-w-0 bg-transparent py-3 outline-none placeholder:text-faint"
            aria-label="Cerca"
          />
          <AnimatePresence>
            {query && (
              <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} onClick={() => setQuery('')} aria-label="Pulisci">
                <X size={18} className="text-muted" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            haptic('select')
            setEverywhere(!everywhere)
          }}
          aria-pressed={everywhere}
          title="Cerca in tutti i mesi"
          className={`glass flex shrink-0 items-center gap-1.5 rounded-2xl px-3.5 text-sm font-semibold transition-colors ${everywhere ? 'text-accent ring-2 ring-accent/50' : 'text-muted'}`}
        >
          <Globe size={17} />
          <span className="hidden sm:inline">Tutti i mesi</span>
        </motion.button>
      </div>

      {usedCats.length > 0 && (
        <LayoutGroup id="chips">
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" data-noswipe>
            {[{ id: null as string | null, name: 'Tutte', color: '#9085e9' }, ...usedCats].map((c) => {
              const active = cat === c.id
              return (
                <motion.button
                  key={c.id ?? 'all'}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => {
                    haptic('select')
                    setCat(c.id)
                  }}
                  className={`relative shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${active ? 'text-ink' : 'text-muted hover:text-ink-soft'}`}
                >
                  {active && (
                    <motion.span
                      layoutId="chip"
                      className="absolute inset-0 rounded-full"
                      style={{ background: `${c.color}33`, boxShadow: `inset 0 0 0 1.5px ${c.color}` }}
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                  <span className="relative">{c.name}</span>
                </motion.button>
              )
            })}
          </div>
        </LayoutGroup>
      )}

      <SwipePeriod ordinal={year * 12 + month} onPrev={() => !global && setPeriod(shiftMonth(period, -1))} onNext={() => !global && setPeriod(shiftMonth(period, 1))}>
        {loading ? (
          <div className="glass space-y-3 rounded-[1.75rem] p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/5" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="glass rounded-[1.75rem]">
            {source?.length || query ? (
              <EmptyState icon={<SearchX size={22} />} title="Nessun risultato" text={global ? 'Nessuna spesa trovata in nessun mese.' : 'Prova a cambiare i filtri o cerca in tutti i mesi.'} />
            ) : (
              <EmptyState icon={<ReceiptText size={22} />} title="Mese vuoto" text="Nessuna spesa in questo mese. Tocca + per aggiungerne una, o scorri per cambiare mese." />
            )}
          </div>
        ) : (
          <motion.div layout className="space-y-4">
            <AnimatePresence initial={false}>
              {groups.map(([date, items], gi) => (
                <motion.section
                  key={date}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: Math.min(gi * 0.04, 0.4) } }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className="glass rounded-[1.75rem] p-3"
                >
                  <div className="flex items-center justify-between px-2 pt-1 pb-2 text-xs font-semibold tracking-wide text-muted uppercase">
                    <span className="capitalize">
                      {formatDayLabel(date)}
                      {global && Number(date.slice(0, 4)) !== thisYear && ` ${date.slice(0, 4)}`}
                    </span>
                    <span className="tabular">{formatEur(sumAmounts(items))}</span>
                  </div>
                  <AnimatePresence initial={false}>
                    {items.map((e) => (
                      <ExpenseRow key={e.id} expense={e} category={map.get(e.categoryId)} onClick={() => openExpense(e)} />
                    ))}
                  </AnimatePresence>
                </motion.section>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </SwipePeriod>
    </div>
  )
}
