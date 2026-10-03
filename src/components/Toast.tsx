import { AnimatePresence, motion } from 'motion/react'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { haptic } from '../lib/haptics'

interface ToastOptions {
  text: string
  action?: { label: string; onClick: () => void }
  duration?: number
}

const ToastContext = createContext<(t: ToastOptions) => void>(() => {})

export const useToast = () => useContext(ToastContext)

/** Un toast alla volta, con azione opzionale (es. "Annulla") e barra del tempo residuo */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null)
  const timer = useRef<number>(undefined)

  const show = useCallback((t: ToastOptions) => setToast({ ...t, id: Date.now() }), [])

  useEffect(() => {
    if (!toast) return
    timer.current = window.setTimeout(() => setToast(null), toast.duration ?? (toast.action ? 5000 : 2500))
    return () => window.clearTimeout(timer.current)
  }, [toast])

  const duration = toast?.duration ?? (toast?.action ? 5000 : 2500)

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-28 z-[60] flex justify-center px-4 lg:bottom-8 lg:pl-64">
        <AnimatePresence mode="popLayout">
          {toast && (
            <motion.div
              key={toast.id}
              layout
              initial={{ y: 40, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 24, opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 500, damping: 34 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.7}
              onDragEnd={(_, i) => Math.abs(i.offset.x) > 80 && setToast(null)}
              role="status"
              className="pointer-events-auto relative flex max-w-md items-center gap-3 overflow-hidden rounded-full bg-surface py-2.5 pr-2.5 pl-5 text-sm font-semibold text-ink shadow-2xl shadow-black/30 ring-1 ring-fg/10"
            >
              <span className="min-w-0 truncate py-1">{toast.text}</span>
              {toast.action && (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    haptic('select')
                    toast.action!.onClick()
                    setToast(null)
                  }}
                  className="shrink-0 rounded-full bg-accent/15 px-4 py-1.5 font-bold text-accent"
                >
                  {toast.action.label}
                </motion.button>
              )}
              <motion.span
                className="absolute bottom-0 left-0 h-0.5 bg-accent/60"
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: duration / 1000, ease: 'linear' }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
