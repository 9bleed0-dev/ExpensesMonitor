import { AlertTriangle, ArrowRight, Landmark, CalendarDays, Check, Flame, Gauge, ReceiptText, Sparkles, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'
import { AnimatePresence, motion, useScroll, useTransform } from 'motion/react'
import { useMemo } from 'react'
import type { AppActions } from '../App'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { Card, SectionTitle, staggerContainer } from '../components/Card'
import { CategoryIcon } from '../components/CategoryIcon'
import { CumulativeArea, Donut } from '../components/charts'
import { ExpenseRow } from '../components/ExpenseRow'
import { PeriodNav, SwipePeriod } from '../components/MonthNav'
import { ThemeToggle } from '../components/ThemeToggle'
import { EmptyState, Skeleton } from '../components/ui'
import { UpcomingBills } from '../components/UpcomingBills'
import { daysInMonth, formatEur, formatShortDate, MONTHS, shiftMonth, todayISO } from '../lib/format'
import { byCategory, sumAmounts, toSlices, useAccountBalance, useBudget, useCategories, useMonthExpenses, useRecurring } from '../lib/hooks'
import { categoryBudgets, categoryChanges, monthStats } from '../lib/insights'
import { dueItemsForMonth, payDate } from '../lib/recurring'
import { useTheme } from '../lib/theme'

export function Dashboard({ period, setPeriod, openExpense, goTo }: AppActions) {
  const { year, month } = period
  const prev = shiftMonth(period, -1)
  const expenses = useMonthExpenses(year, month)
  const prevExpenses = useMonthExpenses(prev.year, prev.month)
  const recurring = useRecurring()
  const budget = useBudget()
  const { list: categories, map } = useCategories()
  const { theme } = useTheme()

  const total = sumAmounts(expenses)
  const prevTotal = sumAmounts(prevExpenses)
  const delta = prevTotal > 0 ? (total - prevTotal) / prevTotal : null
  const budgetPct = budget > 0 ? total / budget : 0
  const slices = useMemo(() => toSlices(byCategory(expenses ?? []), map, theme), [expenses, map, theme])
  const due = useMemo(() => dueItemsForMonth(recurring, expenses ?? [], year, month), [recurring, expenses, year, month])
  const dueOpen = due.filter((d) => !d.paid)
  const stats = useMemo(() => monthStats(expenses ?? [], recurring, year, month), [expenses, recurring, year, month])
  const budgets = useMemo(() => categoryBudgets(expenses ?? [], categories), [expenses, categories])
  const budgetById = useMemo(() => new Map(budgets.map((b) => [b.category.id, b])), [budgets])

  const cumulative = useMemo(() => {
    const days = daysInMonth(year, month)
    const lastDay = stats.isCurrent ? stats.elapsed : stats.isFuture ? 0 : days
    const perDay = new Array(days + 1).fill(0)
    for (const e of expenses ?? []) perDay[Number(e.date.slice(8, 10))] += e.amount
    let run = 0
    const points: { day: number; total?: number; projected?: number; label: string }[] = []
    for (let d = 1; d <= days; d++) {
      const label = `${d} ${MONTHS[month].toLowerCase()}`
      if (d <= lastDay) {
        run += perDay[d]
        points.push({ day: d, total: run, label, projected: stats.projection != null && d === lastDay ? run : undefined })
      } else if (stats.projection != null) {
        points.push({ day: d, label, projected: Math.round(run + ((stats.projection - run) * (d - lastDay)) / (days - lastDay)) })
      }
    }
    return points
  }, [expenses, year, month, stats])

  // Header compatto che compare scorrendo (mobile) e hero che si "ritira"
  const { scrollY } = useScroll()
  const barOpacity = useTransform(scrollY, [150, 210], [0, 1])
  const barY = useTransform(scrollY, [150, 210], [-12, 0])
  const heroScale = useTransform(scrollY, [0, 220], [1, 0.94])
  const heroOpacity = useTransform(scrollY, [60, 260], [1, 0.55])

  const resetPeriod = () => setPeriod({ year: new Date().getFullYear(), month: new Date().getMonth() })
  const loading = expenses === undefined

  return (
    <>
      <div className="pointer-events-none sticky top-0 z-30 h-0 lg:hidden">
        <motion.div
          style={{ opacity: barOpacity, y: barY }}
          className="glass absolute inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] flex items-center justify-between rounded-full px-4 py-2 text-sm shadow-lg shadow-black/20"
        >
          <span className="font-semibold capitalize">
            {MONTHS[month]} {year}
          </span>
          <span className="tabular font-bold">{formatEur(total)}</span>
        </motion.div>
      </div>

      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3 pb-2">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-sm text-muted">{greeting()}</p>
              <h1 className="text-3xl font-extrabold tracking-tight">
                Le tue <span className="text-gradient">spese</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle className="lg:hidden" />
            <PeriodNav
              label={`${MONTHS[month]} ${year}`}
              ordinal={year * 12 + month}
              isCurrent={stats.isCurrent}
              onPrev={() => setPeriod(shiftMonth(period, -1))}
              onNext={() => setPeriod(shiftMonth(period, 1))}
              onReset={resetPeriod}
            />
          </div>
        </header>

        <UpcomingBills openExpense={openExpense} />

        <BalanceCard onEdit={() => goTo('settings')} />

        <SwipePeriod ordinal={year * 12 + month} onPrev={() => setPeriod(shiftMonth(period, -1))} onNext={() => setPeriod(shiftMonth(period, 1))}>
          <div className="grid gap-4 md:grid-cols-5">
            {/* Hero */}
            <motion.div className="min-w-0 md:col-span-3" style={{ scale: heroScale, opacity: heroOpacity, transformOrigin: 'top center' }}>
            <Card className="relative h-full overflow-hidden">
              <motion.div
                className="absolute -top-20 -right-16 h-56 w-56 rounded-full bg-violet-500/25 blur-3xl light:bg-violet-400/25"
                animate={{ scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              />
              <p className="relative text-sm font-medium text-ink-soft">Speso a {MONTHS[month].toLowerCase()}</p>
              <div className="relative mt-1 text-5xl font-extrabold tracking-tight sm:text-6xl">
                {loading ? <Skeleton className="h-14 w-56" /> : <AnimatedNumber value={total} />}
              </div>
              <div className="relative mt-3 flex flex-wrap items-center gap-2 text-sm">
                {delta !== null && (
                  <motion.span
                    key={`${year}-${month}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${delta > 0 ? 'bg-bad/15 text-bad' : 'bg-good/15 text-good'}`}
                  >
                    {delta > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {delta > 0 ? '+' : ''}
                    {Math.round(delta * 100)}%
                  </motion.span>
                )}
                <span className="text-muted">
                  vs {MONTHS[prev.month].toLowerCase()} ({formatEur(prevTotal)})
                </span>
              </div>

              {budget > 0 && (
                <div className="relative mt-6">
                  <div className="mb-2 flex justify-between gap-2 text-xs text-muted">
                    <span>Budget {formatEur(budget)}</span>
                    <span className={budgetPct > 1 ? 'font-semibold text-bad' : ''}>
                      {budgetPct > 1 ? `Sforato di ${formatEur(total - budget)}` : `Restano ${formatEur(budget - total)}`}
                    </span>
                  </div>
                  <div className="relative h-3 overflow-hidden rounded-full bg-fg/10">
                    {/* Stima a fine mese come traccia tenue dietro la barra */}
                    {stats.projection != null && (
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full bg-fg/15"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(stats.projection / budget, 1) * 100}%` }}
                        transition={{ type: 'spring', stiffness: 50, damping: 18, delay: 0.3 }}
                      />
                    )}
                    <motion.div
                      className={`relative h-full rounded-full ${budgetPct > 1 ? 'bg-gradient-to-r from-rose-500 to-orange-400' : budgetPct > 0.8 ? 'bg-gradient-to-r from-amber-500 to-orange-400' : 'bg-gradient-to-r from-violet-500 to-cyan-400'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(budgetPct, 1) * 100}%` }}
                      transition={{ type: 'spring', stiffness: 60, damping: 18, delay: 0.2 }}
                    />
                  </div>
                </div>
              )}

              <div className="relative mt-5 grid grid-cols-2 gap-3 border-t border-fg/10 pt-4">
                <MiniStat icon={CalendarDays} label="Media al giorno" value={stats.dailyAvg} />
                {stats.projection != null ? (
                  <MiniStat icon={Gauge} label="Stima fine mese" value={stats.projection} warn={budget > 0 && stats.projection > budget} />
                ) : (
                  <MiniStat icon={ReceiptText} label="Movimenti" text={String(expenses?.length ?? 0)} />
                )}
              </div>
            </Card>
            </motion.div>

            {/* Scadenze */}
            <Card className="md:col-span-2">
              <SectionTitle action={<LinkBtn onClick={() => goTo('recurring')}>Tutte</LinkBtn>}>Scadenze del mese</SectionTitle>
              {due.length === 0 ? (
                <EmptyState icon={<ReceiptText size={22} />} text="Nessuna bolletta in scadenza. Aggiungile dalla sezione Bollette." />
              ) : (
                <>
                  <div className="mb-3 text-sm text-muted">
                    {dueOpen.length === 0 ? '🎉 Tutto pagato!' : `${dueOpen.length} da pagare · ~${formatEur(sumAmounts(dueOpen.map((d) => d.recurring)))}`}
                  </div>
                  <ul className="space-y-1">
                    <AnimatePresence initial={false}>
                      {due.slice(0, 5).map(({ recurring: r, dueDate, paid }) => (
                        <motion.li key={r.id} layout className="flex items-center gap-3 py-1.5">
                          <CategoryIcon category={map.get(r.categoryId)} size={34} />
                          <div className="min-w-0 flex-1">
                            <div className={`truncate text-sm font-semibold ${paid ? 'text-faint line-through' : ''}`}>{r.name}</div>
                            <div className={`text-xs ${!paid && dueDate < todayISO() ? 'text-bad' : 'text-muted'}`}>
                              {paid ? `Pagata ${formatEur(paid.amount)}` : `Scade ${formatShortDate(dueDate)} · ${formatEur(r.amount)}`}
                            </div>
                          </div>
                          {paid ? (
                            <motion.span initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} className="grid h-8 w-8 place-items-center rounded-full bg-good/20 text-good">
                              <Check size={16} strokeWidth={3} />
                            </motion.span>
                          ) : (
                            <motion.button
                              whileTap={{ scale: 0.9 }}
                              onClick={() => openExpense({ amount: r.amount, categoryId: r.categoryId, description: r.name, date: payDate(dueDate, todayISO()), recurringId: r.id })}
                              className="rounded-full bg-fg/10 px-3 py-1.5 text-xs font-semibold hover:bg-fg/15"
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
                <ul className="w-full flex-1 space-y-3">
                  {slices.length === 0 && <EmptyState icon={<Sparkles size={22} />} text="Ancora nessuna spesa questo mese." />}
                  {slices.map((s, i) => {
                    const b = budgetById.get(s.key)
                    const width = b ? Math.min(b.pct, 1) : s.amount / slices[0].amount
                    return (
                      <motion.li key={s.key} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="flex min-w-0 items-center gap-2 truncate">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                            <span className="truncate">{s.name}</span>
                          </span>
                          <span className="tabular shrink-0 pl-2 font-semibold whitespace-nowrap">
                            {formatEur(s.amount)} <span className="font-normal text-muted">· {Math.round((s.amount / total) * 100)}%</span>
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-fg/5">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: s.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${width * 100}%` }}
                            transition={{ type: 'spring', stiffness: 70, damping: 18, delay: 0.15 + i * 0.05 }}
                          />
                        </div>
                        {b && (
                          <div className={`mt-1 flex items-center gap-1 text-[11px] ${b.pct > 1 ? 'font-semibold text-bad' : b.pct >= 0.8 ? 'text-warn' : 'text-muted'}`}>
                            {b.pct >= 0.8 && <AlertTriangle size={11} />}
                            {b.pct > 1 ? `Budget sforato di ${formatEur(b.spent - b.budget)}` : `${Math.round(b.pct * 100)}% del budget di ${formatEur(b.budget)}`}
                          </div>
                        )}
                      </motion.li>
                    )
                  })}
                </ul>
              </div>
            </Card>

            {/* Andamento */}
            <Card className="md:col-span-2">
              <SectionTitle
                action={
                  stats.projection != null && total > 0 ? (
                    <span className="flex items-center gap-1.5 text-[11px] text-muted">
                      <span className="w-4 border-t-2 border-dashed border-current" /> stima
                    </span>
                  ) : undefined
                }
              >
                Andamento del mese
              </SectionTitle>
              {total > 0 ? <CumulativeArea data={cumulative} budget={budget || undefined} /> : <EmptyState icon={<TrendingUp size={22} />} text="Il grafico apparirà con le prime spese." />}
            </Card>

            {/* Approfondimenti */}
            <Insights expenses={expenses ?? []} prevExpenses={prevExpenses ?? []} prevMonth={prev.month} stats={stats} budgets={budgets} map={map} />

            {/* Recenti */}
            <Card className="md:col-span-3">
              <SectionTitle action={<LinkBtn onClick={() => goTo('expenses')}>Vedi tutte</LinkBtn>}>Ultime spese</SectionTitle>
              {loading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : expenses.length ? (
                <div className="-mx-2">
                  <AnimatePresence initial={false}>
                    {expenses.slice(0, 6).map((e) => (
                      <ExpenseRow key={e.id} expense={e} category={map.get(e.categoryId)} onClick={() => openExpense(e)} showDate />
                    ))}
                  </AnimatePresence>
                  <p className="mt-2 px-2 text-center text-[11px] text-faint lg:hidden">Scorri una spesa: ← elimina · duplica →</p>
                </div>
              ) : (
                <EmptyState icon={<ReceiptText size={22} />} title="Nessuna spesa" text="Tocca + per aggiungere la prima spesa del mese." />
              )}
            </Card>
          </div>
        </SwipePeriod>
      </motion.div>
    </>
  )
}

function Insights({
  expenses,
  prevExpenses,
  prevMonth,
  stats,
  budgets,
  map,
}: {
  expenses: Parameters<typeof categoryChanges>[0]
  prevExpenses: Parameters<typeof categoryChanges>[1]
  prevMonth: number
  stats: ReturnType<typeof monthStats>
  budgets: ReturnType<typeof categoryBudgets>
  map: Parameters<typeof categoryChanges>[2]
}) {
  const items = useMemo(() => {
    const out: { icon: LucideIcon; tone: 'bad' | 'good' | 'warn' | 'neutral'; text: React.ReactNode; key: string }[] = []
    const over = budgets.filter((b) => b.pct > 1)
    for (const b of over.slice(0, 2))
      out.push({ key: `over-${b.category.id}`, icon: AlertTriangle, tone: 'bad', text: <><b>{b.category.name}</b> ha superato il budget ({formatEur(b.spent)} su {formatEur(b.budget)})</> })
    const near = budgets.filter((b) => b.pct >= 0.8 && b.pct <= 1)
    for (const b of near.slice(0, 1))
      out.push({ key: `near-${b.category.id}`, icon: Gauge, tone: 'warn', text: <><b>{b.category.name}</b> è al {Math.round(b.pct * 100)}% del budget</> })

    if (prevExpenses.length && expenses.length) {
      const changes = categoryChanges(expenses, prevExpenses, map)
      const up = changes[0]
      const down = changes[changes.length - 1]
      const prevName = MONTHS[prevMonth].toLowerCase()
      if (up && up.diff > 0)
        out.push({
          key: 'up',
          icon: TrendingUp,
          tone: 'bad',
          text: <><b>{up.category?.name ?? 'Altro'}</b> +{formatEur(up.diff)}{up.previous > 0 ? ` (+${Math.round((up.diff / up.previous) * 100)}%)` : ''} rispetto a {prevName}</>,
        })
      if (down && down.diff < 0)
        out.push({ key: 'down', icon: TrendingDown, tone: 'good', text: <><b>{down.category?.name ?? 'Altro'}</b> −{formatEur(-down.diff)} rispetto a {prevName}</> })
    }
    if (stats.topDay)
      out.push({ key: 'top', icon: Flame, tone: 'neutral', text: <>Giorno più caro: <b>{formatShortDate(stats.topDay.date)}</b> con {formatEur(stats.topDay.amount)}</> })
    if (stats.isCurrent && stats.elapsed < stats.days && stats.dailyAvg > 0)
      out.push({ key: 'left', icon: CalendarDays, tone: 'neutral', text: <>Mancano <b>{stats.days - stats.elapsed} giorni</b> a fine mese</> })
    return out.slice(0, 5)
  }, [expenses, prevExpenses, prevMonth, stats, budgets, map])

  const tones = { bad: 'bg-bad/15 text-bad', good: 'bg-good/15 text-good', warn: 'bg-warn/15 text-warn', neutral: 'bg-accent/15 text-accent' }

  return (
    <Card className="md:col-span-2">
      <SectionTitle>Approfondimenti</SectionTitle>
      {items.length === 0 ? (
        <EmptyState icon={<Sparkles size={22} />} text="Qui compariranno confronti e consigli man mano che registri le spese." />
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false} mode="popLayout">
            {items.map((it, i) => (
              <motion.li
                key={it.key}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.05 * i }}
                className="flex items-start gap-3 text-sm"
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${tones[it.tone]}`}>
                  <it.icon size={16} />
                </span>
                <span className="pt-1.5 leading-snug text-ink-soft [&_b]:font-semibold [&_b]:text-ink">{it.text}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Card>
  )
}

/** Saldo del conto stimato: saldo inserito meno le spese registrate dopo quella data */
function BalanceCard({ onEdit }: { onEdit: () => void }) {
  const balance = useAccountBalance()
  if (!balance) return null
  const { base, spentSince, count, current } = balance
  return (
    <Card className="flex items-center gap-4">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent/15 text-accent">
        <Landmark size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-muted">Saldo conto stimato</div>
        <div className={`text-2xl font-extrabold tracking-tight ${current < 0 ? 'text-bad' : ''}`}>
          <AnimatedNumber value={current} />
        </div>
        <div className="truncate text-xs text-faint">
          {formatEur(base.amount)} al {formatShortDate(base.date)}
          {count > 0 && ` · −${formatEur(spentSince)} di spese dopo`}
        </div>
      </div>
      <LinkBtn onClick={onEdit}>Aggiorna</LinkBtn>
    </Card>
  )
}

function MiniStat({ icon: Icon, label, value, text, warn }: { icon: LucideIcon; label: string; value?: number; text?: string; warn?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <Icon size={13} /> {label}
      </div>
      <div className={`mt-0.5 truncate text-lg font-bold ${warn ? 'text-bad' : ''}`}>{text ?? <AnimatedNumber value={value ?? 0} />}</div>
    </div>
  )
}

export function LinkBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button whileHover={{ x: 2 }} onClick={onClick} className="flex items-center gap-1 text-xs font-semibold text-accent hover:opacity-80">
      {children} <ArrowRight size={14} />
    </motion.button>
  )
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Buongiorno 👋' : h < 18 ? 'Buon pomeriggio 👋' : 'Buonasera 👋'
}
