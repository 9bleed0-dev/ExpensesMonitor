import { Banknote, Copy, CreditCard, Landmark, Repeat, StickyNote, Trash2 } from 'lucide-react'
import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from 'motion/react'
import { useRef } from 'react'
import { PAYMENT_METHODS, type Category, type Expense, type PaymentMethod } from '../db'
import { useExpenseActions } from '../lib/actions'
import { formatEur, formatShortDate } from '../lib/format'
import { haptic } from '../lib/haptics'
import { CategoryIcon } from './CategoryIcon'

export const METHOD_ICONS: Record<PaymentMethod, typeof Banknote> = { cash: Banknote, card: CreditCard, transfer: Landmark }

const THRESHOLD = 96

/**
 * Riga spesa: tocca per modificare, scorri a sinistra per eliminare (con Annulla),
 * a destra per duplicarla oggi. Su desktop le stesse azioni compaiono al passaggio del mouse.
 */
export function ExpenseRow({ expense, category, onClick, showDate }: { expense: Expense; category?: Category; onClick: () => void; showDate?: boolean }) {
  const { remove, duplicate } = useExpenseActions()
  const x = useMotionValue(0)
  const dragged = useRef(false)
  const armed = useRef(false)

  const delOpacity = useTransform(x, [-THRESHOLD, -24, 0], [1, 0.4, 0])
  const delScale = useTransform(x, [-THRESHOLD * 1.4, -THRESHOLD, -24], [1.15, 1, 0.6])
  const dupOpacity = useTransform(x, [0, 24, THRESHOLD], [0, 0.4, 1])
  const dupScale = useTransform(x, [24, THRESHOLD, THRESHOLD * 1.4], [0.6, 1, 1.15])

  // Vibrazione leggera quando si supera la soglia (in entrambe le direzioni)
  useMotionValueEvent(x, 'change', (v) => {
    const over = Math.abs(v) > THRESHOLD
    if (over !== armed.current) {
      armed.current = over
      if (over) haptic('threshold')
    }
  })

  const Method = expense.method ? METHOD_ICONS[expense.method] : null
  const sub = [category?.name, showDate ? formatShortDate(expense.date) : null].filter(Boolean).join(' · ')

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.22 } }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className="group relative overflow-hidden rounded-2xl"
      data-noswipe
    >
      {/* Azioni rivelate dallo swipe */}
      <motion.div style={{ opacity: dupOpacity }} className="absolute inset-0 flex items-center rounded-2xl bg-accent/15 pl-5 text-accent">
        <motion.span style={{ scale: dupScale }} className="flex items-center gap-2 text-sm font-bold">
          <Copy size={18} /> Duplica
        </motion.span>
      </motion.div>
      <motion.div style={{ opacity: delOpacity }} className="absolute inset-0 flex items-center justify-end rounded-2xl bg-bad/15 pr-5 text-bad">
        <motion.span style={{ scale: delScale }} className="flex items-center gap-2 text-sm font-bold">
          Elimina <Trash2 size={18} />
        </motion.span>
      </motion.div>

      <motion.div
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.9, right: 0.6 }}
        dragTransition={{ bounceStiffness: 500, bounceDamping: 32 }}
        onDragStart={() => (dragged.current = true)}
        onDragEnd={(_, info) => {
          window.setTimeout(() => (dragged.current = false), 0)
          const dx = info.offset.x
          if (dx < -THRESHOLD || info.velocity.x < -800) {
            animate(x, -window.innerWidth, { type: 'spring', stiffness: 300, damping: 34 }).then(() => remove(expense))
          } else if (dx > THRESHOLD || info.velocity.x > 800) {
            duplicate(expense)
          }
        }}
        whileTap={{ scale: 0.985 }}
        onClick={() => !dragged.current && onClick()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick())}
        className="relative flex w-full cursor-pointer touch-pan-y items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors outline-none select-none hover:bg-fg/5 focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <CategoryIcon category={category} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 font-semibold">
            <span className="truncate">{expense.description || category?.name || 'Spesa'}</span>
            {expense.recurringId != null && <Repeat size={13} className="shrink-0 text-accent" aria-label="Ricorrente" />}
          </div>
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
            <span className="truncate">{sub}</span>
            {Method && <Method size={12} className="shrink-0" aria-label={PAYMENT_METHODS[expense.method!]} />}
            {expense.note && (
              <span className="flex min-w-0 items-center gap-1 truncate text-faint">
                <StickyNote size={11} className="shrink-0" />
                <span className="truncate">{expense.note}</span>
              </span>
            )}
          </div>
        </div>
        <div className="tabular shrink-0 font-bold">−{formatEur(expense.amount)}</div>
        {/* Azioni rapide su desktop */}
        <div className="hidden shrink-0 gap-1 lg:group-hover:flex">
          <HoverAction label="Duplica oggi" onClick={() => duplicate(expense)}>
            <Copy size={15} />
          </HoverAction>
          <HoverAction label="Elimina" danger onClick={() => remove(expense)}>
            <Trash2 size={15} />
          </HoverAction>
        </div>
      </motion.div>
    </motion.div>
  )
}

function HoverAction({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <motion.button
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileTap={{ scale: 0.85 }}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      title={label}
      aria-label={label}
      className={`grid h-8 w-8 place-items-center rounded-full bg-fg/5 ${danger ? 'text-bad hover:bg-bad/15' : 'text-muted hover:bg-fg/10 hover:text-ink'}`}
    >
      {children}
    </motion.button>
  )
}
