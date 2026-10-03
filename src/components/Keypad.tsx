import { Check, Delete } from 'lucide-react'
import { motion } from 'motion/react'
import { useRef } from 'react'
import { centsToInput, evaluateAmount } from '../lib/format'
import { haptic } from '../lib/haptics'

export type Key = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | ',' | '+' | '−' | '⌫' | '=' | 'C'

const isOp = (c: string | undefined) => c === '+' || c === '−'

/** Applica un tasto all'espressione (es. "12,5+3"): max 2 decimali per termine, operatori non ripetuti */
export function pressKey(expr: string, key: Key): string {
  const term = expr.split(/[+−]/).pop() ?? ''
  const last = expr.at(-1)
  switch (key) {
    case 'C':
      return ''
    case '⌫':
      return expr.slice(0, -1)
    case ',':
      if (term.includes(',')) return expr
      return expr + (term === '' ? '0,' : ',')
    case '+':
    case '−':
      if (!expr) return expr
      if (isOp(last)) return expr.slice(0, -1) + key
      return (last === ',' ? expr.slice(0, -1) : expr) + key
    case '=': {
      const v = evaluateAmount(expr.replace(/[+−,]$/, '').replace(/−/g, '-'))
      return Number.isFinite(v) && v > 0 ? centsToInput(v).replace(/,00$/, '') : expr
    }
    default: {
      const [int, dec] = term.split(',')
      if (dec !== undefined && dec.length >= 2) return expr
      if (dec === undefined && int.length >= 7) return expr
      if (term === '0') return expr.slice(0, -1) + key
      return expr + key
    }
  }
}

const ROWS: Key[][] = [
  ['7', '8', '9', '⌫'],
  ['4', '5', '6', '+'],
  ['1', '2', '3', '−'],
  [',', '0', '=', 'C'],
]

/** Tastierino stile calcolatrice per inserire importi con somme rapide (12+4,50) */
export function Keypad({ value, onChange, onSubmit, canSubmit, submitLabel }: { value: string; onChange: (v: string) => void; onSubmit: () => void; canSubmit: boolean; submitLabel: string }) {
  const hold = useRef<number>(undefined)
  const press = (k: Key) => {
    haptic('tap')
    onChange(pressKey(value, k))
  }

  return (
    <div className="grid grid-cols-[repeat(4,1fr)_auto] gap-2" data-noswipe>
      <div className="col-span-4 grid grid-cols-4 gap-2">
        {ROWS.flat().map((k) => {
          const op = k === '+' || k === '−' || k === '=' || k === '⌫' || k === 'C'
          return (
            <motion.button
              key={k}
              type="button"
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 700, damping: 30 }}
              onClick={() => press(k)}
              onPointerDown={() => {
                // Tieni premuto ⌫ per cancellare tutto
                if (k === '⌫') hold.current = window.setTimeout(() => (haptic('warning'), onChange('')), 550)
              }}
              onPointerUp={() => window.clearTimeout(hold.current)}
              onPointerLeave={() => window.clearTimeout(hold.current)}
              aria-label={k === '⌫' ? 'Cancella' : k === 'C' ? 'Azzera' : k === '−' ? 'Meno' : k}
              className={`tabular h-12 rounded-2xl text-xl font-semibold select-none active:bg-fg/15 ${op ? 'bg-accent/10 text-accent' : 'bg-fg/[0.06] text-ink'}`}
            >
              {k === '⌫' ? <Delete size={20} className="mx-auto" /> : k}
            </motion.button>
          )
        })}
      </div>
      <motion.button
        type="button"
        whileTap={canSubmit ? { scale: 0.92 } : undefined}
        animate={{ opacity: canSubmit ? 1 : 0.4 }}
        disabled={!canSubmit}
        onClick={onSubmit}
        aria-label={submitLabel}
        className="grid w-16 place-items-center rounded-2xl bg-gradient-to-b from-violet-500 to-cyan-500 text-white shadow-lg shadow-violet-500/25 light:from-violet-600 light:to-cyan-600"
      >
        <Check size={28} strokeWidth={3} />
      </motion.button>
    </div>
  )
}
