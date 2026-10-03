import { Plus } from 'lucide-react'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { useCallback, useState } from 'react'
import { Background } from './components/Background'
import { ExpenseForm } from './components/ExpenseForm'
import { Nav, type TabId } from './components/Nav'
import { RecurringForm } from './components/RecurringForm'
import { Sheet } from './components/Sheet'
import type { Expense, Recurring } from './db'
import { Dashboard } from './pages/Dashboard'
import { Expenses } from './pages/Expenses'
import { RecurringPage } from './pages/Recurring'
import { SettingsPage } from './pages/Settings'
import { YearPage } from './pages/Year'

export interface Period {
  year: number
  month: number
}

export interface AppActions {
  period: Period
  setPeriod: (p: Period) => void
  openExpense: (initial?: Partial<Expense>) => void
  openRecurring: (initial?: Partial<Recurring>) => void
  goTo: (tab: TabId) => void
}

type SheetState = ({ kind: 'expense'; initial?: Partial<Expense> } | { kind: 'recurring'; initial?: Partial<Recurring> }) & { nonce: number } | null

export default function App() {
  const now = new Date()
  const [tab, setTab] = useState<TabId>('dashboard')
  const [period, setPeriod] = useState<Period>({ year: now.getFullYear(), month: now.getMonth() })
  // Il contenuto dello sheet resta montato durante l'animazione di chiusura
  const [sheet, setSheet] = useState<SheetState>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const close = useCallback(() => setSheetOpen(false), [])

  const actions: AppActions = {
    period,
    setPeriod,
    openExpense: (initial) => {
      setSheet({ kind: 'expense', initial, nonce: Date.now() })
      setSheetOpen(true)
    },
    openRecurring: (initial) => {
      setSheet({ kind: 'recurring', initial, nonce: Date.now() })
      setSheetOpen(true)
    },
    goTo: (t) => {
      setTab(t)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
  }

  const pages: Record<TabId, React.ReactNode> = {
    dashboard: <Dashboard {...actions} />,
    expenses: <Expenses {...actions} />,
    recurring: <RecurringPage {...actions} />,
    year: <YearPage {...actions} />,
    settings: <SettingsPage />,
  }

  return (
    <MotionConfig reducedMotion="user">
      <Background />
      <div className="lg:pl-64">
      <main className="mx-auto max-w-5xl px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-36 lg:pb-12 lg:pl-8 min-[1400px]:max-w-6xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {pages[tab]}
          </motion.div>
        </AnimatePresence>
      </main>
      </div>

      <AnimatePresence>
        {tab !== 'settings' && (
          <motion.button
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 90 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            onClick={() => (tab === 'recurring' ? actions.openRecurring() : actions.openExpense())}
            className="fixed right-5 bottom-28 z-40 grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-white shadow-xl shadow-violet-500/40 lg:right-10 lg:bottom-10"
            aria-label="Aggiungi"
          >
            <span className="absolute inset-0 animate-ping rounded-full bg-violet-500/30 [animation-duration:2.5s]" />
            <Plus size={28} strokeWidth={2.6} className="relative" />
          </motion.button>
        )}
      </AnimatePresence>

      <Nav tab={tab} onChange={actions.goTo} />

      <Sheet open={sheetOpen && sheet?.kind === 'expense'} onClose={close} title={sheet?.initial?.id != null ? 'Modifica spesa' : 'Nuova spesa'}>
        {sheet?.kind === 'expense' && <ExpenseForm key={sheet.nonce} initial={sheet.initial} onDone={close} />}
      </Sheet>
      <Sheet open={sheetOpen && sheet?.kind === 'recurring'} onClose={close} title={sheet?.initial?.id != null ? 'Modifica ricorrenza' : 'Nuova ricorrenza'}>
        {sheet?.kind === 'recurring' && <RecurringForm key={sheet.nonce} initial={sheet.initial} onDone={close} />}
      </Sheet>
    </MotionConfig>
  )
}
