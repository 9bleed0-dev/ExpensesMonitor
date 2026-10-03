import { Download, Plus, Trash2, Upload } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Card, SectionTitle, staggerContainer } from '../components/Card'
import { CategoryIcon, ICONS } from '../components/CategoryIcon'
import { Button, Field, Input } from '../components/ui'
import { db, exportData, importData, resetData, setMeta, type Category } from '../db'
import { centsToInput, parseAmount, todayISO } from '../lib/format'
import { useBudget, useCategories } from '../lib/hooks'

const SWATCHES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767', '#b07cf0', '#a87b4f', '#8a8a85']

export function SettingsPage() {
  const budget = useBudget()
  const { list: categories } = useCategories()
  const [budgetInput, setBudgetInput] = useState('')
  const [editing, setEditing] = useState<Category | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => setBudgetInput(budget ? centsToInput(budget) : ''), [budget])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  async function saveBudget() {
    const cents = budgetInput.trim() ? parseAmount(budgetInput) : 0
    if (!Number.isFinite(cents) || cents < 0) return setToast('Importo non valido')
    await setMeta('monthlyBudget', cents)
    setToast('Budget salvato ✓')
  }

  async function doExport() {
    const data = await exportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `expenses-backup-${todayISO()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    await setMeta('lastBackup', Date.now())
    setToast('Backup scaricato ✓')
  }

  async function doImport(file: File) {
    try {
      if (!confirm('Importare il backup? I dati attuali verranno sostituiti.')) return
      await importData(JSON.parse(await file.text()))
      setToast('Backup ripristinato ✓')
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Errore durante l’importazione')
    }
  }

  async function doExportCsv() {
    const [expenses, cats] = await Promise.all([db.expenses.orderBy('date').toArray(), db.categories.toArray()])
    const names = new Map(cats.map((c) => [c.id, c.name]))
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
    const rows = expenses.map((e) => [e.date, esc(names.get(e.categoryId) ?? e.categoryId), esc(e.description), (e.amount / 100).toFixed(2).replace('.', ',')].join(';'))
    const blob = new Blob(['﻿Data;Categoria;Descrizione;Importo\n' + rows.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `spese-${todayISO()}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function saveCategory(c: Category) {
    if (!c.name.trim()) return
    await db.categories.put({ ...c, name: c.name.trim() })
    setEditing(null)
  }

  async function deleteCategory(c: Category) {
    const used = await db.expenses.where('categoryId').equals(c.id).count()
    if (used > 0 && !confirm(`${used} spese usano "${c.name}". Verranno spostate in "Altro". Continuare?`)) return
    await db.transaction('rw', db.categories, db.expenses, db.recurring, async () => {
      await db.expenses.where('categoryId').equals(c.id).modify({ categoryId: 'altro' })
      await db.recurring.where('categoryId').equals(c.id).modify({ categoryId: 'altro' })
      await db.categories.delete(c.id)
    })
    setEditing(null)
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-4">
      <h1 className="text-3xl font-extrabold tracking-tight">Opzioni</h1>

      <Card>
        <SectionTitle>Budget mensile</SectionTitle>
        <div className="flex gap-3">
          <Input inputMode="decimal" placeholder="es. 1500" value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} className="tabular" />
          <Button onClick={saveBudget}>Salva</Button>
        </div>
        <p className="mt-2 text-xs text-slate-500">Lascia vuoto per nascondere la barra del budget.</p>
      </Card>

      <Card>
        <SectionTitle
          action={
            <button onClick={() => setEditing({ id: crypto.randomUUID(), name: '', color: SWATCHES[0], icon: 'Wallet', order: categories.length })} className="flex items-center gap-1 text-xs font-semibold text-violet-300">
              <Plus size={14} /> Nuova
            </button>
          }
        >
          Categorie
        </SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {categories.map((c) => (
            <motion.button key={c.id} layout whileTap={{ scale: 0.95 }} onClick={() => setEditing(c)} className="flex items-center gap-2 rounded-2xl bg-white/5 p-2 text-left text-sm font-semibold hover:bg-white/10">
              <CategoryIcon category={c} size={32} />
              <span className="truncate">{c.name}</span>
            </motion.button>
          ))}
        </div>
        <AnimatePresence>
          {editing && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-4 space-y-4 rounded-2xl border border-white/10 p-4">
                <div className="flex items-center gap-3">
                  <CategoryIcon category={editing} size={44} />
                  <Field label="Nome">
                    <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus />
                  </Field>
                </div>
                <div className="flex flex-wrap gap-2">
                  {SWATCHES.map((s) => (
                    <motion.button key={s} whileTap={{ scale: 0.85 }} onClick={() => setEditing({ ...editing, color: s })} className="h-8 w-8 rounded-full" style={{ background: s, boxShadow: editing.color === s ? `0 0 0 3px #13131f, 0 0 0 5px ${s}` : undefined }} aria-label={s} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(ICONS).map(([name, Icon]) => (
                    <button key={name} onClick={() => setEditing({ ...editing, icon: name })} className={`grid h-9 w-9 place-items-center rounded-xl ${editing.icon === name ? 'bg-white/20' : 'bg-white/5 hover:bg-white/10'}`} aria-label={name}>
                      <Icon size={18} />
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  {editing.id !== 'altro' && categories.some((c) => c.id === editing.id) && (
                    <Button variant="danger" onClick={() => deleteCategory(editing)} aria-label="Elimina">
                      <Trash2 size={18} />
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => setEditing(null)}>Annulla</Button>
                  <Button className="flex-1" onClick={() => saveCategory(editing)}>Salva</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      <Card>
        <SectionTitle>Dati & backup</SectionTitle>
        <p className="mb-4 text-sm text-slate-400">Tutto è salvato solo su questo dispositivo (IndexedDB). Fai un backup ogni tanto: se cancelli i dati del browser li perdi.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <Button variant="ghost" onClick={doExport}>
            <Download size={18} /> Backup JSON
          </Button>
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>
            <Upload size={18} /> Ripristina
          </Button>
          <Button variant="ghost" onClick={doExportCsv}>
            <Download size={18} /> Esporta CSV
          </Button>
        </div>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0]).finally(() => (e.target.value = ''))} />
        <Button
          variant="danger"
          className="mt-4 w-full"
          onClick={async () => {
            if (confirm('Cancellare TUTTI i dati? L’operazione non è reversibile.')) {
              await resetData()
              setToast('Dati cancellati')
            }
          }}
        >
          <Trash2 size={18} /> Cancella tutti i dati
        </Button>
      </Card>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: 40, opacity: 0, x: '-50%' }} animate={{ y: 0, opacity: 1, x: '-50%' }} exit={{ y: 40, opacity: 0, x: '-50%' }} className="glass fixed bottom-28 left-1/2 z-50 rounded-full px-5 py-3 text-sm font-semibold shadow-xl">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
