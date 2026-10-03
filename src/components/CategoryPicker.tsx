import { motion } from 'motion/react'
import type { Category } from '../db'
import { CategoryIcon } from './CategoryIcon'

export function CategoryPicker({ categories, value, onChange }: { categories: Category[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {categories.map((c) => {
        const active = c.id === value
        return (
          <motion.button
            type="button"
            key={c.id}
            whileTap={{ scale: 0.9 }}
            onClick={() => onChange(c.id)}
            className="relative flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5"
          >
            {active && (
              <motion.span
                layoutId="cat-active"
                className="absolute inset-0 rounded-2xl"
                style={{ background: `${c.color}22`, boxShadow: `inset 0 0 0 1.5px ${c.color}` }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative">
              <CategoryIcon category={c} size={36} />
            </span>
            <span className={`relative w-full truncate text-center text-[11px] ${active ? 'font-semibold text-white' : 'text-slate-400'}`}>{c.name}</span>
          </motion.button>
        )
      })}
    </div>
  )
}
