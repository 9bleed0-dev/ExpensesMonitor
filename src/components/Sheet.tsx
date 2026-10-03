import { AnimatePresence, motion } from 'motion/react'
import { useEffect, type ReactNode } from 'react'

/** Bottom sheet su mobile, dialog centrato su desktop. Trascinabile verso il basso per chiudere. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" initial="hidden" animate="visible" exit="hidden">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-label={title}
            className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[2rem] border border-white/10 bg-[#13131f]/95 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl backdrop-blur-xl sm:max-w-lg sm:rounded-[2rem]"
            variants={{ hidden: { y: '100%', opacity: 0.5 }, visible: { y: 0, opacity: 1 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => (info.offset.y > 120 || info.velocity.y > 600) && onClose()}
          >
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-white/20 sm:hidden" />
            <h2 className="mb-5 text-xl font-bold">{title}</h2>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
