import { ChevronLeft, ChevronRight } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useRef } from 'react'

export function PeriodNav({ label, onPrev, onNext, onReset, keyId }: { label: string; onPrev: () => void; onNext: () => void; onReset?: () => void; keyId: string }) {
  const dir = useRef(1)
  return (
    <div className="glass flex items-center gap-1 rounded-full p-1">
      <motion.button whileTap={{ scale: 0.85 }} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10" onClick={() => ((dir.current = -1), onPrev())} aria-label="Precedente">
        <ChevronLeft size={18} />
      </motion.button>
      <button onClick={onReset} className="relative h-9 w-36 overflow-hidden text-sm font-semibold">
        <AnimatePresence mode="popLayout" initial={false} custom={dir.current}>
          <motion.span
            key={keyId}
            custom={dir.current}
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
      </button>
      <motion.button whileTap={{ scale: 0.85 }} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10" onClick={() => ((dir.current = 1), onNext())} aria-label="Successivo">
        <ChevronRight size={18} />
      </motion.button>
    </div>
  )
}
