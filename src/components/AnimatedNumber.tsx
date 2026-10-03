import { motion, useSpring, useTransform } from 'motion/react'
import { useEffect } from 'react'
import { formatEur } from '../lib/format'

/** Importo che "scorre" con una molla verso il nuovo valore */
export function AnimatedNumber({ value, format = formatEur, className }: { value: number; format?: (n: number) => string; className?: string }) {
  const spring = useSpring(0, { stiffness: 90, damping: 22, mass: 0.8 })
  const display = useTransform(spring, (v) => format(Math.round(v)))
  useEffect(() => {
    spring.set(value)
  }, [spring, value])
  return <motion.span className={`tabular ${className ?? ''}`}>{display}</motion.span>
}
