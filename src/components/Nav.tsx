import { CalendarClock, ChartColumn, LayoutDashboard, List, Settings } from 'lucide-react'
import { motion } from 'motion/react'
import { haptic } from '../lib/haptics'
import { ThemeToggle } from './ThemeToggle'

export const TABS = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'expenses', label: 'Spese', icon: List },
  { id: 'recurring', label: 'Bollette', icon: CalendarClock },
  { id: 'year', label: 'Anno', icon: ChartColumn },
  { id: 'settings', label: 'Opzioni', icon: Settings },
] as const

export type TabId = (typeof TABS)[number]['id']

export function Nav({ tab, onChange, badge }: { tab: TabId; onChange: (t: TabId) => void; badge?: number }) {
  return (
    <nav className="glass fixed inset-x-3 bottom-3 z-40 rounded-[1.75rem] p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-2xl shadow-black/30 lg:inset-x-auto lg:top-6 lg:bottom-6 lg:left-6 lg:flex lg:w-56 lg:flex-col lg:p-3">
      <div className="hidden px-3 pt-2 pb-8 lg:block">
        <div className="text-gradient text-xl font-extrabold">Expenses</div>
        <div className="text-xs text-muted">Monitor personale</div>
      </div>
      <ul className="flex justify-between lg:flex-col lg:gap-1">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id
          return (
            <li key={id} className="flex-1">
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => {
                  if (!active) haptic('tap')
                  onChange(id)
                }}
                aria-current={active ? 'page' : undefined}
                className={`relative flex w-full flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-semibold transition-colors lg:flex-row lg:gap-3 lg:px-4 lg:py-3 lg:text-sm ${active ? 'text-ink' : 'text-muted hover:text-ink-soft'}`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/30 to-cyan-500/20 ring-1 ring-fg/10 light:from-violet-500/15 light:to-cyan-500/10"
                    transition={{ type: 'spring', stiffness: 450, damping: 34 }}
                  />
                )}
                <motion.span className="relative" animate={{ y: active ? -1 : 0, scale: active ? 1.12 : 1 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}>
                  <Icon size={21} strokeWidth={active ? 2.4 : 2} />
                  {id === 'recurring' && !!badge && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1.5 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] leading-none font-bold text-white ring-2 ring-[var(--bg)]"
                      aria-label={`${badge} in scadenza`}
                    >
                      {badge}
                    </motion.span>
                  )}
                </motion.span>
                <span className="relative">{label}</span>
              </motion.button>
            </li>
          )
        })}
      </ul>
      <div className="mt-auto hidden items-center justify-between px-3 pt-4 lg:flex">
        <span className="text-xs text-muted">Tema</span>
        <ThemeToggle />
      </div>
    </nav>
  )
}
