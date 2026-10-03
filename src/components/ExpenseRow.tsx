import { Repeat } from 'lucide-react'
import { motion } from 'motion/react'
import type { Category, Expense } from '../db'
import { formatEur, formatShortDate } from '../lib/format'
import { CategoryIcon } from './CategoryIcon'

export function ExpenseRow({ expense, category, onClick, showDate }: { expense: Expense; category?: Category; onClick: () => void; showDate?: boolean }) {
  return (
    <motion.button
      layout
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40, height: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex w-full items-center gap-3 overflow-hidden rounded-2xl px-2 py-2.5 text-left"
    >
      <CategoryIcon category={category} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 truncate font-semibold">
          {expense.description || category?.name || 'Spesa'}
          {expense.recurringId != null && <Repeat size={13} className="shrink-0 text-cyan-300" />}
        </div>
        <div className="truncate text-xs text-slate-400">
          {category?.name}
          {showDate && ` · ${formatShortDate(expense.date)}`}
        </div>
      </div>
      <div className="tabular font-bold">−{formatEur(expense.amount)}</div>
    </motion.button>
  )
}
