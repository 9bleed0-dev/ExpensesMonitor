import { BellRing, ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import type { Expense } from '../db'
import { formatEur, relativeDue, todayISO } from '../lib/format'
import { sumAmounts, useCategories, useUpcomingBills } from '../lib/hooks'
import { payDate } from '../lib/recurring'
import { CategoryIcon } from './CategoryIcon'

/** Promemoria: bollette scadute o in scadenza entro 7 giorni (sempre rispetto a oggi) */
export function UpcomingBills({ openExpense }: { openExpense: (initial?: Partial<Expense>) => void }) {
  const items = useUpcomingBills(7)
  const { map } = useCategories()
  const [open, setOpen] = useState(true)
  const today = todayISO()
  const late = items.filter((i) => i.dueDate < today).length

  return (
    <AnimatePresence initial={false}>
      {items.length > 0 && (
        <motion.section
          layout
          initial={{ opacity: 0, y: -12, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -12, height: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="overflow-hidden"
          aria-label="Bollette in scadenza"
        >
          <div className={`glass rounded-[1.75rem] p-4 ring-1 ${late ? 'ring-bad/30' : 'ring-warn/25'}`}>
            <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 text-left" aria-expanded={open}>
              <motion.span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${late ? 'bg-bad/15 text-bad' : 'bg-warn/15 text-warn'}`}
                animate={{ rotate: [0, -14, 12, -8, 6, 0] }}
                transition={{ duration: 0.9, delay: 0.4, repeat: Infinity, repeatDelay: 6 }}
              >
                <BellRing size={19} />
              </motion.span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">
                  {items.length === 1 ? '1 bolletta da pagare' : `${items.length} bollette da pagare`}
                </div>
                <div className="truncate text-xs text-muted">
                  {late ? `${late} scadut${late === 1 ? 'a' : 'e'} · ` : ''}~{formatEur(sumAmounts(items.map((i) => i.recurring)))} entro 7 giorni
                </div>
              </div>
              <motion.span animate={{ rotate: open ? 180 : 0 }} className="text-muted">
                <ChevronDown size={18} />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  {items.slice(0, 4).map(({ recurring: r, dueDate }, i) => {
                    const isLate = dueDate < today
                    return (
                      <motion.li
                        key={`${r.id}-${dueDate}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 * i }}
                        className="flex items-center gap-3 pt-3"
                      >
                        <CategoryIcon category={map.get(r.categoryId)} size={32} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{r.name}</div>
                          <div className={`text-xs ${isLate ? 'font-semibold text-bad' : 'text-muted'}`}>
                            {relativeDue(dueDate, today)} · {formatEur(r.amount)}
                          </div>
                        </div>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => openExpense({ amount: r.amount, categoryId: r.categoryId, description: r.name, date: payDate(dueDate, today), recurringId: r.id })}
                          className="rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-1.5 text-xs font-semibold text-white light:from-violet-600 light:to-cyan-600"
                        >
                          Paga
                        </motion.button>
                      </motion.li>
                    )
                  })}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
