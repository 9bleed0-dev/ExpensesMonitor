import { motion, type HTMLMotionProps } from 'motion/react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold tracking-wide text-muted uppercase">{label}</span>
      {children}
    </label>
  )
}

const inputCls =
  'w-full rounded-2xl border border-fg/10 bg-fg/5 px-4 py-3 outline-none transition placeholder:text-faint focus:border-accent/60 focus:bg-fg/[0.07] focus:ring-4 focus:ring-accent/15'

export const Input = (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} className={`${inputCls} ${props.className ?? ''}`} />

export const Select = (props: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...props} className={`${inputCls} appearance-none [&>option]:bg-surface ${props.className ?? ''}`} />
)

type BtnVariant = 'primary' | 'ghost' | 'danger'
const variants: Record<BtnVariant, string> = {
  primary: 'bg-gradient-to-r from-violet-500 to-cyan-500 text-white shadow-lg shadow-violet-500/25 light:from-violet-600 light:to-cyan-600',
  ghost: 'bg-fg/5 text-ink-soft border border-fg/10 hover:bg-fg/10',
  danger: 'bg-bad/10 text-bad border border-bad/30 hover:bg-bad/20',
}

export function Button({ variant = 'primary', className = '', ...props }: HTMLMotionProps<'button'> & { variant?: BtnVariant }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 600, damping: 30 }}
      className={`flex items-center justify-center gap-2 rounded-2xl px-5 py-3 font-semibold transition-colors disabled:opacity-40 ${variants[variant]} ${className}`}
      {...props}
    />
  )
}

/** Interruttore animato */
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-violet-500' : 'bg-fg/15'}`}
    >
      <motion.span
        className="absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow"
        animate={{ x: checked ? 20 : 0 }}
        transition={{ type: 'spring', stiffness: 700, damping: 35 }}
      />
    </button>
  )
}

/** Stato vuoto con una piccola "illustrazione" in CSS: icona fluttuante dentro un alone sfumato */
export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title?: string; text: string; action?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center px-4 py-8 text-center">
      <div className="relative mb-4 grid h-20 w-20 place-items-center">
        <span className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500/25 to-cyan-500/20 blur-md" />
        <span className="absolute inset-2 rounded-full border border-dashed border-fg/15" />
        <span className="float relative grid h-12 w-12 place-items-center rounded-2xl bg-surface text-accent shadow-lg ring-1 ring-fg/10">{icon}</span>
      </div>
      {title && <p className="font-semibold">{title}</p>}
      <p className="max-w-xs text-sm text-muted">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-2xl ${className}`} />
}
