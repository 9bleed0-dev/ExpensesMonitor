import { motion, type HTMLMotionProps } from 'motion/react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold tracking-wide text-slate-400 uppercase">{label}</span>
      {children}
    </label>
  )
}

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-violet-400/60 focus:bg-white/[0.07] focus:ring-4 focus:ring-violet-500/15'

export const Input = (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} className={`${inputCls} ${props.className ?? ''}`} />

export const Select = (props: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...props} className={`${inputCls} appearance-none [&>option]:bg-[#13131f] ${props.className ?? ''}`} />
)

type BtnVariant = 'primary' | 'ghost' | 'danger'
const variants: Record<BtnVariant, string> = {
  primary: 'bg-gradient-to-r from-violet-500 to-cyan-500 text-white shadow-lg shadow-violet-500/25',
  ghost: 'bg-white/5 text-slate-200 border border-white/10 hover:bg-white/10',
  danger: 'bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25',
}

export function Button({ variant = 'primary', className = '', ...props }: HTMLMotionProps<'button'> & { variant?: BtnVariant }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
      className={`flex items-center justify-center gap-2 rounded-2xl px-5 py-3 font-semibold transition-colors disabled:opacity-40 ${variants[variant]} ${className}`}
      {...props}
    />
  )
}
