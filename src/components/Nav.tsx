import { CalendarClock, ChartColumn, LayoutDashboard, List, Settings } from 'lucide-react'
import { motion } from 'motion/react'

export const TABS = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'expenses', label: 'Spese', icon: List },
  { id: 'recurring', label: 'Bollette', icon: CalendarClock },
  { id: 'year', label: 'Anno', icon: ChartColumn },
  { id: 'settings', label: 'Opzioni', icon: Settings },
] as const

export type TabId = (typeof TABS)[number]['id']

export function Nav({ tab, onChange }: { tab: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav className="glass fixed inset-x-3 bottom-3 z-40 rounded-[1.75rem] p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-2xl shadow-black/50 lg:inset-x-auto lg:top-6 lg:bottom-6 lg:left-6 lg:w-56 lg:p-3">
      <div className="hidden px-3 pt-2 pb-8 lg:block">
        <div className="text-gradient text-xl font-extrabold">Expenses</div>
        <div className="text-xs text-slate-400">Monitor personale</div>
      </div>
      <ul className="flex justify-between lg:flex-col lg:gap-1">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id
          return (
            <li key={id} className="flex-1">
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => onChange(id)}
                className={`relative flex w-full flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-semibold transition-colors lg:flex-row lg:gap-3 lg:px-4 lg:py-3 lg:text-sm ${active ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/30 to-cyan-500/20 ring-1 ring-white/10"
                    transition={{ type: 'spring', stiffness: 450, damping: 34 }}
                  />
                )}
                <motion.span className="relative" animate={{ y: active ? -1 : 0, scale: active ? 1.12 : 1 }}>
                  <Icon size={21} strokeWidth={active ? 2.4 : 2} />
                </motion.span>
                <span className="relative">{label}</span>
              </motion.button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
