import { motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import type { Category } from '../db'
import { haptic } from '../lib/haptics'
import { CategoryIcon } from './CategoryIcon'

/** Griglia di categorie; `compact` = una sola riga scorrevole (usata nel form spesa per lasciare spazio al tastierino) */
export function CategoryPicker({ categories, value, onChange, compact }: { categories: Category[]; value: string; onChange: (id: string) => void; compact?: boolean }) {
  const scroller = useRef<HTMLDivElement>(null)

  // Porta in vista la categoria attiva quando cambia (es. scelta da un suggerimento)
  useEffect(() => {
    if (!compact) return
    const el = scroller.current?.querySelector<HTMLElement>(`[data-cat="${CSS.escape(value)}"]`)
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [compact, value])

  return (
    <div
      ref={scroller}
      data-noswipe
      className={compact ? 'no-scrollbar -mx-6 flex snap-x gap-1 overflow-x-auto scroll-px-6 px-6' : 'grid grid-cols-4 gap-2'}
    >
      {categories.map((c) => {
        const active = c.id === value
        return (
          <motion.button
            type="button"
            key={c.id}
            data-cat={c.id}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              haptic('select')
              onChange(c.id)
            }}
            aria-pressed={active}
            className={`relative flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 ${compact ? 'w-[4.5rem] shrink-0 snap-start' : ''}`}
          >
            {active && (
              <motion.span
                layoutId={compact ? 'cat-active-compact' : 'cat-active'}
                className="absolute inset-0 rounded-2xl"
                style={{ background: `${c.color}22`, boxShadow: `inset 0 0 0 1.5px ${c.color}` }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <motion.span className="relative" animate={{ scale: active ? 1.08 : 1, y: active ? -1 : 0 }}>
              <CategoryIcon category={c} size={36} />
            </motion.span>
            <span className={`relative w-full truncate text-center text-[11px] ${active ? 'font-semibold text-ink' : 'text-muted'}`}>{c.name}</span>
          </motion.button>
        )
      })}
    </div>
  )
}
