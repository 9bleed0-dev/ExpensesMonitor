import { useMemo } from 'react'
import { useToast } from '../components/Toast'
import { db, type Expense } from '../db'
import { formatEur, todayISO } from './format'
import { haptic } from './haptics'

/** Eliminazione con "Annulla" e duplicazione rapida, condivise da righe e form */
export function useExpenseActions() {
  const toast = useToast()
  return useMemo(
    () => ({
      async remove(e: Expense) {
        if (e.id == null) return
        await db.expenses.delete(e.id)
        haptic('warning')
        toast({
          text: `Eliminata ${e.description ? `“${e.description}”` : formatEur(e.amount)}`,
          action: { label: 'Annulla', onClick: () => void db.expenses.add(e) },
        })
      },
      async duplicate(e: Expense) {
        const { id: _id, recurringId: _r, ...rest } = e
        const id = await db.expenses.add({ ...rest, date: todayISO(), createdAt: Date.now() })
        haptic('success')
        toast({
          text: `Duplicata oggi · ${formatEur(e.amount)}`,
          action: { label: 'Annulla', onClick: () => void db.expenses.delete(id) },
        })
      },
    }),
    [toast],
  )
}
