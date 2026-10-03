import { ArrowRight, Check, TrendingDown, TrendingUp } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo } from 'react'
import type { AppActions } from '../App'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { Card, SectionTitle, staggerContainer } from '../components/Card'
import { CategoryIcon } from '../components/CategoryIcon'
import { CumulativeArea, Donut } from '../components/charts'
import { ExpenseRow } from '../components/ExpenseRow'
import { PeriodNav } from '../components/MonthNav'
import { daysInMonth, formatEur, formatShortDate, MONTHS, todayISO } from '../lib/format'
import { byCategory, sumAmounts, toSlices, useBudget, useCategories, useMonthExpenses, useRecurring } from '../lib/hooks'
import { dueItemsForMonth, payDate } from '../lib/recurring'

export function Dashboard({ period, setPeriod, openExpense, goTo }: AppActions) {
  const { year, month } = period
  const prev = month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
  const expenses = useMonthExpenses(year, month)
  const prevExpenses = useMonthExpenses(prev.year, prev.month)
  const recurring = useRecurring()
  const budget = useBudget()
  const { map } = useCategories()

  const total = sumAmounts(expenses)
  const prevTotal = sumAmounts(prevExpenses)
  const delta = prevTotal > 0 ? (total - prevTotal) / prevTotal : null
  const budgetPct = budget > 0 ? total / budget : 0
  const slices = useMemo(() => toSlices(byCategory(expenses ?? []), map), [expenses, map])
  const due = useMemo(() => dueItemsForMonth(recurring, expenses ?? [], year, month), [recurring, expenses, year, month])
  const dueOpen = due.filter((d) => !d.paid)

  const cumulative = useMemo(() => {
    const days = daysInMonth(year, month)
    const now = new Date()
    const isCurrent = now.getFullYear() === year && now.getMonth() === month
    const lastDay = isCurrent ? now.getDate() : days
    const perDay = new Array(days + 1).fill(0)
    for (const e of expenses ?? []) perDay[Number(e.date.slice(8, 10))] += e.amount
    let run = 0
    return Array.from({ length: lastDay }, (_, i) => {
      run += perDay[i + 1]
      return { day: i + 1, total: run, label: `${i + 1} ${MONTHS[month].toLowerCase()}` }
    })
  }, [expenses, year, month])

  const shift = (d: number) => {
    const m = month + d
    setPeriod({ year: year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 })
  }
  const resetPeriod = () => setPeriod({ year: new Date().getFullYear(), month: new Date().getMonth() })

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 pb-2">
        <div>
          <p className="text-sm text-slate-400">{greeting()}</p>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Le tue <span className="text-gradient">spese</span>
          </h1>
        </div>
        <PeriodNav label={`${MONTHS[month]} ${year}`} keyId={`${year}-${month}`} onPrev={() => shift(-1)} onNext={() => shift(1)} onReset={resetPeriod} />
      </header>

      <div className="grid gap-4 md:grid-cols-5">
        {/* Hero */}
        <Card className="relative overflow-hidden md:col-span-3">
          <div className="absolute -top-20 -right-16 h-56 w-56 rounded-full bg-violet-500/25 blur-3xl" />
          <p className="relative text-sm font-medium text-slate-300">Speso a {MONTHS[month].toLowerCase()}</p>
          <div className="relative mt-1 text-5xl font-extrabold tracking-tight sm:text-6xl">
            <AnimatedNumber value={total} />
          </div>
          <div className="relative mt-3 flex flex-wrap items-center gap-2 text-sm">
            {delta !== null && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${delta > 0 ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/15 text-emerald-300'}`}
              >
                {delta > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {delta > 0 ? '+' : ''}
                {Math.round(delta * 100)}%
              </motion.span>
            )}
            <span className="text-slate-400">vs {MONTHS[prev.month].toLowerCase()} ({formatEur(prevTotal)})</span>
          </div>

          {budget > 0 && (
            <div className="relative mt-6">
              <div className="mb-2 flex justify-between text-xs text-slate-400">
                <span>Budget {formatEur(budget)}</span>
                <span className={budgetPct > 1 ? 'font-semibold text-rose-300' : ''}>
                  {budgetPct > 1 ? `Sforato di ${formatEur(total - budget)}` : `Restano ${formatEur(budget - total)}`}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className={`h-full rounded-full ${budgetPct > 1 ? 'bg-gradient-to-r from-rose-500 to-orange-400' : budgetPct > 0.8 ? 'bg-gradient-to-r from-amber-500 to-orange-400' : 'bg-gradient-to-r from-violet-500 to-cyan-400'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(budgetPct, 1) * 100}%` }}
                  transition={{ type: 'spring', stiffness: 60, damping: 18, delay: 0.2 }}
                />
              </div>
            </div>
          )}
        </Card>

        {/* Scadenze */}
        <Card className="md:col-span-2">
          <SectionTitle
            action={
              <button onClick={() => goTo('recurring')} className="flex items-center gap-1 text-xs font-semibold text-violet-300 hover:text-violet-200">
                Tutte <ArrowRight size={14} />
              </button>
            }
          >
            Scadenze del mese
          </SectionTitle>
          {due.length === 0 ? (
            <Empty text="Nessuna bolletta in scadenza. Aggiungile dalla sezione Bollette." />
          ) : (
            <>
              <div className="mb-3 text-sm text-slate-400">
                {dueOpen.length === 0 ? '🎉 Tutto pagato!' : `${dueOpen.length} da pagare · ~${formatEur(sumAmounts(dueOpen.map((d) => d.recurring)))}`}
              </div>
              <ul className="space-y-1">
                <AnimatePresence initial={false}>
                  {due.slice(0, 5).map(({ recurring: r, dueDate, paid }) => (
                    <motion.li key={r.id} layout className="flex items-center gap-3 py-1.5">
                      <CategoryIcon category={map.get(r.categoryId)} size={34} />
                      <div className="min-w-0 flex-1">
                        <div className={`truncate text-sm font-semibold ${paid ? 'text-slate-500 line-through' : ''}`}>{r.name}</div>
                        <div className={`text-xs ${!paid && dueDate < todayISO() ? 'text-rose-300' : 'text-slate-400'}`}>
                          {paid ? `Pagata ${formatEur(paid.amount)}` : `Scade ${formatShortDate(dueDate)} · ${formatEur(r.amount)}`}
                        </div>
                      </div>
                      {paid ? (
                        <motion.span initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500/20 text-emerald-300">
                          <Check size={16} strokeWidth={3} />
                        </motion.span>
                      ) : (
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => openExpense({ amount: r.amount, categoryId: r.categoryId, description: r.name, date: payDate(dueDate, todayISO()), recurringId: r.id })}
                          className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/15"
                        >
                          Paga
                        </motion.button>
                      )}
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </>
          )}
        </Card>

        {/* Categorie */}
        <Card className="md:col-span-3">
          <SectionTitle>Per categoria</SectionTitle>
          <div className="flex flex-col items-center gap-6 sm:flex-row md:flex-col xl:flex-row">
            <Donut data={slices} total={total} />
            <ul className="w-full flex-1 space-y-2.5">
              {slices.length === 0 && <Empty text="Ancora nessuna spesa questo mese." />}
              {slices.map((s, i) => (
                <motion.li key={s.key} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex min-w-0 items-center gap-2 truncate">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                      {s.name}
                    </span>
                    <span className="tabular shrink-0 pl-2 font-semibold whitespace-nowrap">
                      {formatEur(s.amount)} <span className="font-normal text-slate-400">· {Math.round((s.amount / total) * 100)}%</span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                    <motion.div className="h-full rounded-full" style={{ background: s.color }} initial={{ width: 0 }} animate={{ width: `${(s.amount / slices[0].amount) * 100}%` }} transition={{ type: 'spring', stiffness: 70, damping: 18, delay: 0.15 + i * 0.05 }} />
                  </div>
                </motion.li>
              ))}
            </ul>
          </div>
        </Card>

        {/* Andamento */}
        <Card className="md:col-span-2">
          <SectionTitle>Andamento del mese</SectionTitle>
          {cumulative.length > 0 && total > 0 ? <CumulativeArea data={cumulative} /> : <Empty text="Il grafico apparirà con le prime spese." />}
        </Card>

        {/* Recenti */}
        <Card className="md:col-span-5">
          <SectionTitle
            action={
              <button onClick={() => goTo('expenses')} className="flex items-center gap-1 text-xs font-semibold text-violet-300 hover:text-violet-200">
                Vedi tutte <ArrowRight size={14} />
              </button>
            }
          >
            Ultime spese
          </SectionTitle>
          {expenses?.length ? (
            <div className="-mx-2">
              <AnimatePresence initial={false}>
                {expenses.slice(0, 6).map((e) => (
                  <ExpenseRow key={e.id} expense={e} category={map.get(e.categoryId)} onClick={() => openExpense(e)} showDate />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <Empty text="Tocca + per aggiungere la prima spesa." />
          )}
        </Card>
      </div>
    </motion.div>
  )
}

export function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-slate-500">{text}</p>
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Buongiorno 👋' : h < 18 ? 'Buon pomeriggio 👋' : 'Buonasera 👋'
}
