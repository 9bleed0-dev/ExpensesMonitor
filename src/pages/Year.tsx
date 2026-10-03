import { ChartColumn, Shapes } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo } from 'react'
import type { AppActions } from '../App'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { Card, SectionTitle, staggerContainer } from '../components/Card'
import { CategoryIcon } from '../components/CategoryIcon'
import { MonthBars } from '../components/charts'
import { PeriodNav, SwipePeriod } from '../components/MonthNav'
import { formatEur, MONTHS, MONTHS_SHORT } from '../lib/format'
import { byCategory, sumAmounts, useCategories, useYearExpenses } from '../lib/hooks'
import { EmptyState } from '../components/ui'

export function YearPage({ period, setPeriod, goTo }: AppActions) {
  const { year } = period
  const expenses = useYearExpenses(year)
  const prevYear = useYearExpenses(year - 1)
  const { map } = useCategories()

  const total = sumAmounts(expenses)
  const prevTotal = sumAmounts(prevYear)
  const months = useMemo(() => {
    const t = new Array(12).fill(0)
    const p = new Array(12).fill(0)
    for (const e of expenses ?? []) t[Number(e.date.slice(5, 7)) - 1] += e.amount
    for (const e of prevYear ?? []) p[Number(e.date.slice(5, 7)) - 1] += e.amount
    return t.map((total, month) => ({ month, label: MONTHS_SHORT[month], total, prev: p[month] }))
  }, [expenses, prevYear])
  const activeMonths = months.filter((m) => m.total > 0)
  const avg = activeMonths.length ? Math.round(total / activeMonths.length) : 0
  const top = activeMonths.reduce<(typeof months)[number] | null>((a, b) => (!a || b.total > a.total ? b : a), null)
  const cats = useMemo(() => byCategory(expenses ?? []), [expenses])
  // Mesi trascorsi: 12 per gli anni passati, fino al mese corrente per l'anno in corso
  const now = new Date()
  const elapsed = year < now.getFullYear() ? 12 : year === now.getFullYear() ? now.getMonth() + 1 : 1

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Riepilogo annuale</h1>
          <p className="text-sm text-muted">Tocca un mese per aprirlo</p>
        </div>
        <PeriodNav label={String(year)} ordinal={year} isCurrent={year === new Date().getFullYear()} onPrev={() => setPeriod({ ...period, year: year - 1 })} onNext={() => setPeriod({ ...period, year: year + 1 })} onReset={() => setPeriod({ ...period, year: new Date().getFullYear() })} />
      </header>

      <SwipePeriod ordinal={year} onPrev={() => setPeriod({ ...period, year: year - 1 })} onNext={() => setPeriod({ ...period, year: year + 1 })}>
      <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label={`Totale ${year}`} value={total} big />
        <Stat label="Media mensile" value={avg} />
        <Stat label="Mese più caro" value={top?.total ?? 0} hint={top ? MONTHS[top.month] : '—'} />
        <Stat label={`Totale ${year - 1}`} value={prevTotal} hint={prevTotal ? `${total >= prevTotal ? '+' : ''}${Math.round(((total - prevTotal) / prevTotal) * 100)}%` : undefined} />
      </div>

      <Card>
        <SectionTitle>Spesa per mese</SectionTitle>
        {total > 0 ? (
          <MonthBars
            data={months}
            curLabel={String(year)}
            prevLabel={String(year - 1)}
            highlight={year === period.year ? period.month : undefined}
            onSelect={(m) => {
              setPeriod({ year, month: m })
              goTo('dashboard')
            }}
          />
        ) : (
          <EmptyState icon={<ChartColumn size={22} />} text={`Nessuna spesa registrata nel ${year}.`} />
        )}
      </Card>

      <Card>
        <SectionTitle>Categorie dell'anno</SectionTitle>
        {cats.length === 0 ? (
          <EmptyState icon={<Shapes size={22} />} text="Le categorie dell'anno appariranno qui." />
        ) : (
          <ul className="space-y-3">
            {cats.map((c, i) => {
              const cat = map.get(c.categoryId)
              return (
                <motion.li key={c.categoryId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="flex items-center gap-3">
                  <CategoryIcon category={cat} size={36} />
                  <div className="flex-1">
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-semibold">{cat?.name ?? 'Senza categoria'}</span>
                      <span className="tabular">
                        {formatEur(c.amount)} <span className="text-muted">· {formatEur(Math.round(c.amount / elapsed))}/mese</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-fg/5">
                      <motion.div className="h-full rounded-full" style={{ background: cat?.color ?? '#8a8a85' }} initial={{ width: 0 }} animate={{ width: `${(c.amount / cats[0].amount) * 100}%` }} transition={{ type: 'spring', stiffness: 60, damping: 18, delay: 0.1 + i * 0.04 }} />
                    </div>
                  </div>
                </motion.li>
              )
            })}
          </ul>
        )}
      </Card>
      </div>
      </SwipePeriod>
    </motion.div>
  )
}

function Stat({ label, value, hint, big }: { label: string; value: number; hint?: string; big?: boolean }) {
  return (
    <Card className={big ? 'bg-gradient-to-br from-violet-500/20 to-cyan-500/10 light:from-violet-500/10 light:to-cyan-500/5' : ''}>
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
      <div className="mt-1 text-lg font-extrabold sm:text-xl xl:text-2xl">
        <AnimatedNumber value={value} />
      </div>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </Card>
  )
}
