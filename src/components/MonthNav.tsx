import { ChevronLeft, ChevronRight } from 'lucide-react'
import { animate, AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { haptic } from '../lib/haptics'
import { staggerContainer } from './Card'

/** Direzione dell'ultimo cambio di un valore ordinale (+1 avanti, -1 indietro) */
function useDirection(ordinal: number) {
  const prev = useRef(ordinal)
  const dir = useRef(1)
  if (prev.current !== ordinal) {
    dir.current = ordinal > prev.current ? 1 : -1
    prev.current = ordinal
  }
  return dir.current
}

/** `ordinal` cresce col tempo (es. anno*12+mese) e decide la direzione dell'animazione */
export function PeriodNav({ label, onPrev, onNext, onReset, ordinal, isCurrent }: { label: string; onPrev: () => void; onNext: () => void; onReset?: () => void; ordinal: number; isCurrent?: boolean }) {
  const dir = useDirection(ordinal)
  return (
    <div className="glass flex items-center gap-1 rounded-full p-1">
      <motion.button whileTap={{ scale: 0.85 }} className="grid h-9 w-9 place-items-center rounded-full hover:bg-fg/10" onClick={() => (haptic('tap'), onPrev())} aria-label="Precedente">
        <ChevronLeft size={18} />
      </motion.button>
      <button onClick={onReset} className="relative h-9 w-36 overflow-hidden text-sm font-semibold" title={isCurrent ? undefined : 'Torna a oggi'}>
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.span
            key={ordinal}
            custom={dir}
            className="absolute inset-0 grid place-items-center capitalize"
            variants={{ enter: (d: number) => ({ x: d * 40, opacity: 0 }), center: { x: 0, opacity: 1 }, exit: (d: number) => ({ x: d * -40, opacity: 0 }) }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          >
            {label}
          </motion.span>
        </AnimatePresence>
        {isCurrent === false && <motion.span layoutId="period-dot" className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" aria-hidden />}
      </button>
      <motion.button whileTap={{ scale: 0.85 }} className="grid h-9 w-9 place-items-center rounded-full hover:bg-fg/10" onClick={() => (haptic('tap'), onNext())} aria-label="Successivo">
        <ChevronRight size={18} />
      </motion.button>
    </div>
  )
}

const SWIPE = 72

/**
 * Contenuto che si può sfogliare col dito (solo touch): scorri a sinistra per il periodo successivo,
 * a destra per il precedente. Anche i cambi da pulsante entrano scivolando dal lato giusto.
 * Gli elementi con [data-noswipe] (righe con azioni, grafici, chip scorrevoli) sono esclusi.
 */
export function SwipePeriod({ ordinal, onPrev, onNext, children }: { ordinal: number; onPrev: () => void; onNext: () => void; children: ReactNode }) {
  const x = useMotionValue(0)
  const opacity = useTransform(x, [-160, 0, 160], [0.5, 1, 0.5])
  const g = useRef<{ x: number; y: number; id: number; horizontal: boolean | null } | null>(null)
  const prev = useRef(ordinal)

  useEffect(() => {
    if (prev.current === ordinal) return
    const d = ordinal > prev.current ? 1 : -1
    prev.current = ordinal
    x.jump(d * 56)
    animate(x, 0, { type: 'spring', stiffness: 380, damping: 34 })
  }, [ordinal, x])

  const end = (e: React.PointerEvent) => {
    const s = g.current
    if (!s || s.id !== e.pointerId) return
    g.current = null
    const dx = e.clientX - s.x
    if (s.horizontal && Math.abs(dx) > SWIPE) {
      haptic('select')
      if (dx < 0) onNext()
      else onPrev()
    } else {
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 36 })
    }
  }

  return (
    <motion.div
      style={{ x, opacity }}
      variants={staggerContainer}
      className="touch-pan-y"
      onPointerDown={(e) => {
        if (e.pointerType !== 'touch') return
        const t = e.target as HTMLElement
        if (t.closest('[data-noswipe], input, textarea, select')) return
        g.current = { x: e.clientX, y: e.clientY, id: e.pointerId, horizontal: null }
      }}
      onPointerMove={(e) => {
        const s = g.current
        if (!s || s.id !== e.pointerId) return
        const dx = e.clientX - s.x
        const dy = e.clientY - s.y
        if (s.horizontal === null && Math.hypot(dx, dy) > 10) s.horizontal = Math.abs(dx) > Math.abs(dy) * 1.4
        if (s.horizontal) x.set(dx * 0.4)
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {children}
    </motion.div>
  )
}
