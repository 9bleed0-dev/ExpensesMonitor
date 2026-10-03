import { X } from 'lucide-react'
import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { useEffect, type ReactNode } from 'react'

/**
 * Bottom sheet su mobile, dialog centrato su desktop.
 * Si trascina verso il basso dalla maniglia/intestazione per chiudere, così il contenuto resta scorrevole.
 */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const controls = useDragControls()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    // Blocca lo scroll della pagina sotto lo sheet
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" initial="hidden" animate="visible" exit="hidden">
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative flex max-h-[94dvh] w-full flex-col rounded-t-[2rem] border border-fg/10 bg-surface/95 shadow-2xl backdrop-blur-xl sm:max-w-lg sm:rounded-[2rem]"
            variants={{ hidden: { y: '100%', opacity: 0.6 }, visible: { y: 0, opacity: 1 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 38, mass: 0.9 }}
            drag="y"
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.7 }}
            onDragEnd={(_, info) => (info.offset.y > 120 || info.velocity.y > 600) && onClose()}
          >
            <div className="cursor-grab touch-none px-6 pt-3 pb-3 active:cursor-grabbing" onPointerDown={(e) => controls.start(e)}>
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-fg/20 sm:hidden" />
              <div className="flex items-center justify-between gap-3 sm:pt-3">
                <h2 className="text-xl font-bold">{title}</h2>
                <motion.button whileTap={{ scale: 0.85 }} onClick={onClose} onPointerDown={(e) => e.stopPropagation()} className="grid h-9 w-9 place-items-center rounded-full bg-fg/5 text-muted hover:bg-fg/10 hover:text-ink" aria-label="Chiudi">
                  <X size={18} />
                </motion.button>
              </div>
            </div>
            <div className="overflow-y-auto overscroll-contain px-6 pt-1 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
