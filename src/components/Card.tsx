import { motion, type HTMLMotionProps } from 'motion/react'

export const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
}

export const fadeUp = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, stiffness: 260, damping: 26 } },
}

export function Card({ className = '', ...props }: HTMLMotionProps<'div'>) {
  return <motion.div variants={fadeUp} className={`glass min-w-0 rounded-[1.75rem] p-5 ${className}`} {...props} />
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-sm font-semibold tracking-wide text-muted uppercase">{children}</h3>
      {action}
    </div>
  )
}
