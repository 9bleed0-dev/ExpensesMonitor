import { Moon, Sun } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { haptic } from '../lib/haptics'
import { useTheme } from '../lib/theme'

/** Passa al volo da chiaro a scuro (la scelta "Sistema" si trova in Opzioni) */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setPref } = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={() => {
        haptic('select')
        setPref(next)
      }}
      className={`glass relative grid h-11 w-11 place-items-center overflow-hidden rounded-full text-ink-soft hover:text-ink ${className}`}
      aria-label={next === 'light' ? 'Tema chiaro' : 'Tema scuro'}
      title={next === 'light' ? 'Tema chiaro' : 'Tema scuro'}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={theme}
          initial={{ y: 24, rotate: -90, opacity: 0 }}
          animate={{ y: 0, rotate: 0, opacity: 1 }}
          exit={{ y: -24, rotate: 90, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 24 }}
        >
          {theme === 'dark' ? <Moon size={19} /> : <Sun size={19} />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}
