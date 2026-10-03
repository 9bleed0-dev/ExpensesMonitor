import { Search, X } from 'lucide-react'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import type { AppActions } from '../App'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { ExpenseRow } from '../components/ExpenseRow'
import { PeriodNav } from '../components/MonthNav'
import type { Expense } from '../db'
import { formatDayLabel, formatEur, MONTHS } from '../lib/format'
import { sumAmounts, useCategories, useMonthExpenses } from '../lib/hooks'
import { Empty } from './Dashboard'

export function Expenses({ period, setPeriod, openExpense }: AppActions) {
  const { year, month } = period
  const expenses = useMonthExpenses(year, month)
  const { list: categories, map } = useCategories()
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (expenses ?? []).filter(
      (e) => (!cat || e.categoryId === cat) && (!q || e.description.toLowerCase().includes(q) || map.get(e.categoryId)?.name.toLowerCase().includes(q)),
    )
  }, [expenses, query, cat, map])

  const groups = useMemo(() => {
    const g = new Map<string, Expense[]>()
    for (const e of filtered) g.set(e.date, [...(g.get(e.date) ?? []), e])
    return [...g.entries()]
  }, [filtered])

  const usedCats = useMemo(() => categories.filter((c) => expenses?.some((e) => e.categoryId === c.id)), [categories, expenses])

  const shift = (d: number) => {
    const m = month + d
    setPeriod({ year: year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 })
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Spese</h1>
          <p className="text-sm text-slate-400">
            {filtered.length} movimenti · <AnimatedNumber value={sumAmounts(filtered)} className="font-semibold text-slate-200" />
          </p>
        </div>
        <PeriodNav
          label={`${MONTHS[month]} ${year}`}
          keyId={`${year}-${month}`}
          onPrev={() => shift(-1)}
          onNext={() => shift(1)}
          onReset={() => setPeriod({ year: new Date().getFullYear(), month: new Date().getMonth() })}
        />
      </header>

      <div className="glass flex items-center gap-2 rounded-2xl px-4">
        <Search size={18} className="text-slate-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca per descrizione o categoria" className="w-full bg-transparent py-3 outline-none placeholder:text-slate-500" />
        <AnimatePresence>
          {query && (
            <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} onClick={() => setQuery('')} aria-label="Pulisci">
              <X size={18} className="text-slate-400" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {usedCats.length > 0 && (
        <LayoutGroup id="chips">
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {[{ id: null as string | null, name: 'Tutte', color: '#9085e9' }, ...usedCats].map((c) => {
              const active = cat === c.id
              return (
                <motion.button
                  key={c.id ?? 'all'}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setCat(c.id)}
                  className={`relative shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${active ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {active && <motion.span layoutId="chip" className="absolute inset-0 rounded-full" style={{ background: `${c.color}33`, boxShadow: `inset 0 0 0 1.5px ${c.color}` }} transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                  <span className="relative">{c.name}</span>
                </motion.button>
              )
            })}
          </div>
        </LayoutGroup>
      )}

      {groups.length === 0 ? (
        <div className="glass rounded-[1.75rem]">
          <Empty text={expenses?.length ? 'Nessun risultato con questi filtri.' : 'Nessuna spesa in questo mese. Tocca + per aggiungerne una.'} />
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
                <div className="flex items-center justify-between px-2 pt-1 pb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                  <span className="capitalize">{formatDayLabel(date)}</span>
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
    </div>
  )
}
