import { Download, Monitor, Moon, Plus, Sun, Trash2, Upload } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Card, SectionTitle, staggerContainer } from '../components/Card'
import { CategoryIcon, ICONS } from '../components/CategoryIcon'
import { useToast } from '../components/Toast'
import { Button, Field, Input } from '../components/ui'
import { db, exportData, importData, PAYMENT_METHODS, resetData, setMeta, type Category } from '../db'
import { centsToInput, formatEur, parseAmount, todayISO } from '../lib/format'
import { haptic } from '../lib/haptics'
import { useBudget, useCategories } from '../lib/hooks'
import { themed, useTheme, type ThemePref } from '../lib/theme'

const SWATCHES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767', '#b07cf0', '#a87b4f', '#8a8a85']

const THEMES: { id: ThemePref; label: string; icon: typeof Sun }[] = [
  { id: 'system', label: 'Sistema', icon: Monitor },
  { id: 'light', label: 'Chiaro', icon: Sun },
  { id: 'dark', label: 'Scuro', icon: Moon },
]

export function SettingsPage() {
  const budget = useBudget()
  const { raw: categories, map } = useCategories()
  const { theme, pref, setPref } = useTheme()
  const toast = useToast()
  const [budgetInput, setBudgetInput] = useState('')
  const [editing, setEditing] = useState<(Category & { budgetInput: string }) | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => setBudgetInput(budget ? centsToInput(budget) : ''), [budget])

  const edit = (c: Category) => setEditing({ ...c, budgetInput: c.budget ? centsToInput(c.budget) : '' })

  async function saveBudget() {
    const cents = budgetInput.trim() ? parseAmount(budgetInput) : 0
    if (!Number.isFinite(cents) || cents < 0) return toast({ text: 'Importo non valido' })
    await setMeta('monthlyBudget', cents)
    haptic('success')
    toast({ text: 'Budget salvato ✓' })
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
    toast({ text: 'Backup scaricato ✓' })
  }

  async function doImport(file: File) {
    try {
      if (!confirm('Importare il backup? I dati attuali verranno sostituiti.')) return
      await importData(JSON.parse(await file.text()))
      toast({ text: 'Backup ripristinato ✓' })
    } catch (e) {
      toast({ text: e instanceof Error ? e.message : 'Errore durante l’importazione' })
    }
  }

  async function doExportCsv() {
    const [expenses, cats] = await Promise.all([db.expenses.orderBy('date').toArray(), db.categories.toArray()])
    const names = new Map(cats.map((c) => [c.id, c.name]))
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
    const rows = expenses.map((e) =>
      [
        e.date,
        esc(names.get(e.categoryId) ?? e.categoryId),
        esc(e.description),
        (e.amount / 100).toFixed(2).replace('.', ','),
        e.method ? PAYMENT_METHODS[e.method] : '',
        esc(e.note ?? ''),
      ].join(';'),
    )
    const blob = new Blob(['﻿Data;Categoria;Descrizione;Importo;Metodo;Nota\n' + rows.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `spese-${todayISO()}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function saveCategory() {
    if (!editing || !editing.name.trim()) return
    const { budgetInput: b, ...c } = editing
    const cents = b.trim() ? parseAmount(b) : 0
    if (!Number.isFinite(cents) || cents < 0) return toast({ text: 'Budget non valido' })
    await db.categories.put({ ...c, name: c.name.trim(), budget: cents || undefined })
    haptic('success')
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
        <SectionTitle>Aspetto</SectionTitle>
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-fg/5 p-1" role="radiogroup" aria-label="Tema">
          {THEMES.map(({ id, label, icon: Icon }) => {
            const active = pref === id
            return (
              <button
                key={id}
                role="radio"
                aria-checked={active}
                onClick={() => {
                  haptic('select')
                  setPref(id)
                }}
                className={`relative flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors ${active ? 'text-ink' : 'text-muted hover:text-ink-soft'}`}
              >
                {active && <motion.span layoutId="theme-pill" className="absolute inset-0 rounded-xl bg-surface shadow-md ring-1 ring-fg/10" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                <Icon size={16} className="relative" />
                <span className="relative">{label}</span>
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-faint">"Sistema" segue l'impostazione chiaro/scuro del dispositivo.</p>
      </Card>

      <Card>
        <SectionTitle>Budget mensile</SectionTitle>
        <div className="flex gap-3">
          <Input inputMode="decimal" placeholder="es. 1500" value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} className="tabular" aria-label="Budget mensile" />
          <Button onClick={saveBudget}>Salva</Button>
        </div>
        <p className="mt-2 text-xs text-faint">Lascia vuoto per nascondere la barra del budget. Puoi impostare anche un budget per ogni categoria qui sotto.</p>
      </Card>

      <Card>
        <SectionTitle
          action={
            <button
              onClick={() => setEditing({ id: crypto.randomUUID(), name: '', color: SWATCHES[0], icon: 'Wallet', order: categories.length, budgetInput: '' })}
              className="flex items-center gap-1 text-xs font-semibold text-accent"
            >
              <Plus size={14} /> Nuova
            </button>
          }
        >
          Categorie
        </SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {categories.map((c) => (
            <motion.button
              key={c.id}
              layout
              whileTap={{ scale: 0.95 }}
              onClick={() => edit(c)}
              className={`flex items-center gap-2 rounded-2xl p-2 text-left text-sm font-semibold transition-colors ${editing?.id === c.id ? 'bg-fg/10 ring-1 ring-accent/50' : 'bg-fg/5 hover:bg-fg/10'}`}
            >
              <CategoryIcon category={map.get(c.id)} size={32} />
              <span className="min-w-0">
                <span className="block truncate">{c.name}</span>
                {!!c.budget && <span className="tabular block truncate text-[11px] font-medium text-muted">{formatEur(c.budget)}/mese</span>}
              </span>
            </motion.button>
          ))}
        </div>
        <AnimatePresence>
          {editing && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-4 space-y-4 rounded-2xl border border-fg/10 p-4">
                <div className="flex items-end gap-3">
                  <CategoryIcon category={{ ...editing, color: themed(editing.color, theme) }} size={48} />
                  <div className="flex-1">
                    <Field label="Nome">
                      <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus />
                    </Field>
                  </div>
                </div>
                <Field label="Budget mensile della categoria (facoltativo)">
                  <Input inputMode="decimal" placeholder="es. 200" value={editing.budgetInput} onChange={(e) => setEditing({ ...editing, budgetInput: e.target.value })} className="tabular" />
                </Field>
                <div className="flex flex-wrap gap-2">
                  {SWATCHES.map((s) => (
                    <motion.button
                      key={s}
                      whileTap={{ scale: 0.85 }}
                      onClick={() => setEditing({ ...editing, color: s })}
                      className="h-8 w-8 rounded-full"
                      style={{ background: themed(s, theme), boxShadow: editing.color === s ? `0 0 0 3px var(--color-surface), 0 0 0 5px ${themed(s, theme)}` : undefined }}
                      aria-label={s}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(ICONS).map(([name, Icon]) => (
                    <button
                      key={name}
                      onClick={() => setEditing({ ...editing, icon: name })}
                      className={`grid h-9 w-9 place-items-center rounded-xl ${editing.icon === name ? 'bg-fg/20 text-ink' : 'bg-fg/5 text-ink-soft hover:bg-fg/10'}`}
                      aria-label={name}
                    >
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
                  <Button variant="ghost" onClick={() => setEditing(null)}>
                    Annulla
                  </Button>
                  <Button className="flex-1" onClick={saveCategory}>
                    Salva
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      <Card>
        <SectionTitle>Dati & backup</SectionTitle>
        <p className="mb-4 text-sm text-muted">Tutto è salvato solo su questo dispositivo (IndexedDB). Fai un backup ogni tanto: se cancelli i dati del browser li perdi.</p>
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
              toast({ text: 'Dati cancellati' })
            }
          }}
        >
          <Trash2 size={18} /> Cancella tutti i dati
        </Button>
      </Card>
    </motion.div>
  )
}
