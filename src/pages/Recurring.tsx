import { Check, Pause } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo } from 'react'
import type { AppActions } from '../App'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { Card, SectionTitle, staggerContainer } from '../components/Card'
import { CategoryIcon } from '../components/CategoryIcon'
import { PeriodNav } from '../components/MonthNav'
import { formatEur, formatShortDate, MONTHS, todayISO } from '../lib/format'
import { useCategories, useMonthExpenses, useRecurring } from '../lib/hooks'
import { dueItemsForMonth, FREQUENCIES, monthlyEquivalent, payDate } from '../lib/recurring'
import { Empty } from './Dashboard'

export function RecurringPage({ period, setPeriod, openExpense, openRecurring }: AppActions) {
  const { year, month } = period
  const recurring = useRecurring()
  const expenses = useMonthExpenses(year, month)
  const { map } = useCategories()
  const due = useMemo(() => dueItemsForMonth(recurring, expenses ?? [], year, month), [recurring, expenses, year, month])
  const active = recurring.filter((r) => r.active)
  const monthlyAvg = active.reduce((s, r) => s + monthlyEquivalent(r), 0)
  const paidCount = due.filter((d) => d.paid).length
  const today = todayISO()

  const shift = (d: number) => {
    const m = month + d
    setPeriod({ year: year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 })
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Bollette & ricorrenti</h1>
          <p className="text-sm text-slate-400">Luce, gas, affitto, abbonamenti…</p>
        </div>
        <PeriodNav
          label={`${MONTHS[month]} ${year}`}
          keyId={`${year}-${month}`}
          onPrev={() => shift(-1)}
          onNext={() => shift(1)}
          onReset={() => setPeriod({ year: new Date().getFullYear(), month: new Date().getMonth() })}
        />
      </header>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Costo fisso medio</p>
          <div className="mt-1 text-2xl font-extrabold sm:text-3xl">
            <AnimatedNumber value={monthlyAvg} />
          </div>
          <p className="text-xs text-slate-500">al mese · {formatEur(monthlyAvg * 12)} l'anno</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Pagate a {MONTHS[month].toLowerCase()}</p>
          <div className="mt-1 text-2xl font-extrabold sm:text-3xl">
            {paidCount}
            <span className="text-slate-500">/{due.length}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div className="h-full rounded-full bg-emerald-400" initial={{ width: 0 }} animate={{ width: due.length ? `${(paidCount / due.length) * 100}%` : 0 }} transition={{ type: 'spring', stiffness: 70, damping: 18 }} />
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle>In scadenza a {MONTHS[month].toLowerCase()}</SectionTitle>
        {due.length === 0 ? (
          <Empty text="Niente in scadenza questo mese." />
        ) : (
          <ul className="space-y-1">
            <AnimatePresence initial={false}>
              {due.map(({ recurring: r, dueDate, paid }) => {
                const late = !paid && dueDate < today
                return (
                  <motion.li key={r.id} layout transition={{ type: 'spring', stiffness: 400, damping: 34 }} className="flex items-center gap-3 rounded-2xl p-2">
                    <CategoryIcon category={map.get(r.categoryId)} />
                    <div className="min-w-0 flex-1">
                      <div className={`truncate font-semibold ${paid ? 'text-slate-500 line-through' : ''}`}>{r.name}</div>
                      <div className={`text-xs ${late ? 'font-semibold text-rose-300' : 'text-slate-400'}`}>
                        {paid ? `Pagata il ${formatShortDate(paid.date)}` : `${late ? 'Scaduta' : 'Scade'} il ${formatShortDate(dueDate)}`}
                      </div>
                    </div>
                    <div className="tabular text-right font-bold">{formatEur(paid?.amount ?? r.amount)}</div>
                    {paid ? (
                      <motion.button
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                        onClick={() => openExpense(paid)}
                        className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500/20 text-emerald-300"
                        aria-label="Vedi pagamento"
                      >
                        <Check size={18} strokeWidth={3} />
                      </motion.button>
                    ) : (
                      <motion.button
                        whileTap={{ scale: 0.88 }}
                        onClick={() => openExpense({ amount: r.amount, categoryId: r.categoryId, description: r.name, date: payDate(dueDate, today), recurringId: r.id })}
                        className="h-9 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-4 text-sm font-semibold"
                      >
                        Paga
                      </motion.button>
                    )}
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle>Tutte le ricorrenze</SectionTitle>
        {recurring.length === 0 ? (
          <Empty text="Aggiungi bollette e abbonamenti con il pulsante +." />
        ) : (
          <ul className="-mx-2">
            {recurring.map((r, i) => (
              <motion.li key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <motion.button whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }} whileTap={{ scale: 0.98 }} onClick={() => openRecurring(r)} className={`flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left ${r.active ? '' : 'opacity-50'}`}>
                  <CategoryIcon category={map.get(r.categoryId)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate font-semibold">
                      {r.name} {!r.active && <Pause size={13} />}
                    </div>
                    <div className="text-xs text-slate-400">
                      {FREQUENCIES[r.frequency].label} · dal {formatShortDate(r.startDate)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="tabular font-bold">{formatEur(r.amount)}</div>
                    {r.frequency !== 'monthly' && <div className="tabular text-xs text-slate-500">≈ {formatEur(monthlyEquivalent(r))}/mese</div>}
                  </div>
                </motion.button>
              </motion.li>
            ))}
          </ul>
        )}
      </Card>
    </motion.div>
  )
}
