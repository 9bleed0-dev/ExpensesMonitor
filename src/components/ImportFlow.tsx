import { ChevronDown, FileUp, Receipt } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { db, getMeta, setMeta, type Expense, type Income, type Recurring } from '../db'
import { formatEur, formatShortDate, shiftMonth } from '../lib/format'
import { haptic } from '../lib/haptics'
import { useCategories } from '../lib/hooks'
import {
  categoryHistory,
  DEFAULT_RULES,
  detectDelimiter,
  findHeaderRow,
  guessMapping,
  headerSignature,
  IMPORT_SOURCES,
  looksLikePaypal,
  matchesDue,
  parseCSV,
  prettyDesc,
  rowsToImport,
  suggestCategory,
  type ColumnMapping,
  type ImportSource,
} from '../lib/importer'
import { dueDateIn } from '../lib/recurring'
import { useToast } from './Toast'
import { Button, Field, Select, Toggle } from './ui'

interface Loaded {
  fileName: string
  rows: string[][]
  headerIndex: number
  mapping: ColumnMapping
  expenses: Expense[]
  incomeKeys: Set<string>
  recurring: Recurring[]
}

type Mappings = Record<string, ColumnMapping>

async function readText(file: File) {
  const buf = await file.arrayBuffer()
  let text = new TextDecoder('utf-8').decode(buf)
  if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buf) // vecchi export delle banche
  return text.replace(/^﻿/, '')
}

/** Import di un estratto conto CSV (banca o PayPal): colonne, anteprima, categorie, bollette pagate */
export function ImportFlow({ onDone, onShowRecurring }: { onDone: () => void; onShowRecurring: () => void }) {
  const { list: categories } = useCategories()
  const toast = useToast()
  const [source, setSource] = useState<ImportSource>('banca')
  const [skipPaypal, setSkipPaypal] = useState(true)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [overrides, setOverrides] = useState<Record<number, string>>({})
  const [showSkipped, setShowSkipped] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getMeta('skipPaypalInBank', true).then(setSkipPaypal)
  }, [])

  async function onFile(file: File) {
    const text = await readText(file)
    const rows = parseCSV(text, detectDelimiter(text))
    if (rows.length < 2) return alert('Il file sembra vuoto o non è un CSV.')
    const headerIndex = findHeaderRow(rows)
    const headers = rows[headerIndex]
    if (looksLikePaypal(headers)) setSource('paypal')
    const [expenses, incomes, recurring, saved] = await Promise.all([
      db.expenses.toArray(),
      db.incomes.toArray(),
      db.recurring.toArray(),
      getMeta<Mappings>('importMappings', {}),
    ])
    const incomeKeys = new Set(incomes.map((i) => i.importKey).filter((k): k is string => !!k))
    setOverrides({})
    setLoaded({ fileName: file.name, rows, headerIndex, mapping: saved[headerSignature(headers)] ?? guessMapping(headers), expenses, incomeKeys, recurring })
  }

  const preview = useMemo(() => {
    if (!loaded) return null
    const validIds = new Set(categories.map((c) => c.id))
    const history = categoryHistory(loaded.expenses)
    const items = rowsToImport(loaded.rows, loaded.headerIndex, {
      mapping: loaded.mapping,
      source,
      skipPaypalInBank: skipPaypal,
      existingKeys: new Set([...loaded.expenses.map((e) => e.importKey).filter((k): k is string => !!k), ...loaded.incomeKeys]),
    })
    // Bollette già pagate per mese, per non segnare due volte la stessa scadenza
    const paid = new Set(loaded.expenses.filter((e) => e.recurringId != null).map((e) => `${e.recurringId}|${e.date.slice(0, 7)}`))
    const active = loaded.recurring.filter((r) => r.active)
    const ok = items
      .filter((i) => !i.skip && !i.income)
      .sort((a, b) => a.date!.localeCompare(b.date!))
      .map((i) => {
        const [y, m] = i.date!.split('-').map(Number)
        let bill: Recurring | undefined
        for (const r of active) {
          for (const d of [0, -1, 1]) {
            const p = shiftMonth({ year: y, month: m - 1 }, d)
            const due = dueDateIn(r, p.year, p.month)
            const key = `${r.id}|${due?.slice(0, 7)}`
            if (due && !paid.has(key) && matchesDue(i.desc, i.date!, r, due)) {
              bill = r
              paid.add(key)
              break
            }
          }
          if (bill) break
        }
        const suggested = bill?.categoryId ?? suggestCategory(i.desc, history, DEFAULT_RULES, validIds)
        return { ...i, bill, suggested }
      })
      .reverse()
    const incomes = items.filter((i) => !i.skip && i.income)
    return {
      ok,
      incomes,
      skipped: items.filter((i) => i.skip),
      total: ok.reduce((s, i) => s - i.amount!, 0),
      incomeTotal: incomes.reduce((s, i) => s + i.amount!, 0),
    }
  }, [loaded, source, skipPaypal, categories])

  async function doImport() {
    if (!loaded || !preview || !(preview.ok.length || preview.incomes.length)) return
    setBusy(true)
    const now = Date.now()
    const rows: Expense[] = preview.ok.map((i, n) => {
      const description = prettyDesc(i.desc)
      return {
        amount: -i.amount!,
        categoryId: overrides[i.row] ?? i.suggested ?? 'altro',
        description,
        note: description.toLowerCase() !== i.desc.toLowerCase() ? i.desc : undefined,
        date: i.date!,
        recurringId: i.bill?.id,
        source,
        importKey: i.key,
        createdAt: now + n,
      }
    })
    const incomes: Income[] = preview.incomes.map((i, n) => {
      const description = prettyDesc(i.desc)
      return {
        amount: i.amount!,
        description,
        note: description.toLowerCase() !== i.desc.toLowerCase() ? i.desc : undefined,
        date: i.date!,
        source,
        importKey: i.key,
        createdAt: now + rows.length + n,
      }
    })
    await db.transaction('rw', db.expenses, db.incomes, async () => {
      await db.expenses.bulkAdd(rows)
      await db.incomes.bulkAdd(incomes)
    })
    const saved = await getMeta<Mappings>('importMappings', {})
    await setMeta('importMappings', { ...saved, [headerSignature(loaded.rows[loaded.headerIndex])]: loaded.mapping })
    haptic('success')
    toast({
      text: `Importate ${rows.length} spese${incomes.length ? ` e ${incomes.length} entrate` : ''} ✓`,
      action: { label: 'Ricorrenti', onClick: onShowRecurring },
    })
    onDone()
  }

  const setMapping = (k: keyof ColumnMapping, v: number) => loaded && setLoaded({ ...loaded, mapping: { ...loaded.mapping, [k]: v } })
  const headers = loaded ? loaded.rows[loaded.headerIndex] : []
  const columnSelect = (k: keyof ColumnMapping, label: string, optional = false) => (
    <Field label={label}>
      <Select value={loaded?.mapping[k] ?? -1} onChange={(e) => setMapping(k, Number(e.target.value))}>
        {optional && <option value={-1}>— nessuna —</option>}
        {headers.map((h, i) => (
          <option key={i} value={i}>
            {h || `Colonna ${i + 1}`}
          </option>
        ))}
      </Select>
    </Field>
  )
  const uncategorized = preview?.ok.filter((i) => !(overrides[i.row] ?? i.suggested)).length ?? 0
  const bills = preview?.ok.filter((i) => i.bill).length ?? 0

  return (
    <div className="space-y-4">
      <Field label="Da dove arriva il file">
        <Select value={source} onChange={(e) => setSource(e.target.value as ImportSource)}>
          {Object.entries(IMPORT_SOURCES).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      {source !== 'paypal' && (
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm">
            <p className="font-semibold">Salta i pagamenti PayPal</p>
            <p className="text-xs text-muted">Se importi anche il file di PayPal, lì vedi il vero negozio e la spesa non conta due volte.</p>
          </div>
          <Toggle
            label="Salta i pagamenti PayPal"
            checked={skipPaypal}
            onChange={(v) => {
              setSkipPaypal(v)
              setMeta('skipPaypalInBank', v)
            }}
          />
        </div>
      )}

      <Button variant={loaded ? 'ghost' : 'primary'} className="w-full" onClick={() => fileRef.current?.click()}>
        <FileUp size={18} /> {loaded ? `Cambia file (${loaded.fileName})` : 'Scegli il file CSV'}
      </Button>
      <input ref={fileRef} type="file" accept=".csv,.txt,text/csv" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0]).finally(() => (e.target.value = ''))} />

      {!loaded && (
        <details className="rounded-2xl bg-fg/5 p-4 text-sm text-ink-soft">
          <summary className="cursor-pointer font-semibold text-ink">Come scarico il file?</summary>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <b>Banca</b>: home banking dal computer → Conto → Movimenti → scegli il periodo → esporta in <b>CSV</b>. Se c'è solo Excel, aprilo e fai Salva con nome → CSV.
            </li>
            <li>
              <b>PayPal</b>: paypal.com → Attività → Estratti conto → Scarica attività → formato <b>CSV</b>, tutte le transazioni.
            </li>
            <li>Puoi importare più volte lo stesso periodo: le righe già presenti vengono saltate. Le entrate (stipendio, rimborsi) finiscono tra le entrate.</li>
          </ul>
        </details>
      )}

      {loaded && preview && (
        <>
          <details className="rounded-2xl border border-fg/10 p-4" open={!preview.ok.length}>
            <summary className="cursor-pointer text-sm font-semibold">Colonne del file</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {columnSelect('date', 'Data')}
              {columnSelect('desc', 'Descrizione')}
              {columnSelect('amount', 'Importo', true)}
              <Field label="Riga dei titoli">
                <Select
                  value={loaded.headerIndex}
                  onChange={(e) => {
                    const i = Number(e.target.value)
                    setLoaded({ ...loaded, headerIndex: i, mapping: guessMapping(loaded.rows[i]) })
                  }}
                >
                  {loaded.rows.slice(0, 15).map((r, i) => (
                    <option key={i} value={i}>
                      {i + 1}: {r.filter(Boolean).slice(0, 3).join(' · ')}
                    </option>
                  ))}
                </Select>
              </Field>
              {columnSelect('debit', 'Uscite (Dare), se su due colonne', true)}
              {columnSelect('credit', 'Entrate (Avere), se su due colonne', true)}
            </div>
          </details>

          <div className="rounded-2xl bg-fg/5 p-4 text-sm">
            <p>
              <b className="tabular">{preview.ok.length}</b> spese · <b className="tabular">{formatEur(preview.total)}</b>
              {preview.incomes.length > 0 && (
                <>
                  {' '}
                  e <b className="tabular">{preview.incomes.length}</b> entrate · <b className="tabular text-good">+{formatEur(preview.incomeTotal)}</b>
                </>
              )}
            </p>
            <p className="text-xs text-muted">
              {bills > 0 && `${bills} pagano una bolletta in scadenza · `}
              {uncategorized > 0 && `${uncategorized} senza categoria (andranno in Altro) · `}
              {preview.skipped.length} righe saltate
            </p>
          </div>

          <ul className="-mx-1 max-h-[45vh] space-y-1 overflow-y-auto px-1">
            {preview.ok.map((i) => (
              <li key={i.row} className="flex items-center gap-2 rounded-2xl bg-fg/[0.03] p-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{prettyDesc(i.desc)}</div>
                  <div className="truncate text-xs text-muted">
                    {formatShortDate(i.date!)}
                    {i.bill && <span className="ml-1 font-semibold text-good">· paga {i.bill.name}</span>}
                  </div>
                </div>
                <div className="tabular text-sm font-bold">{formatEur(-i.amount!)}</div>
                <select
                  value={overrides[i.row] ?? i.suggested ?? ''}
                  onChange={(e) => setOverrides({ ...overrides, [i.row]: e.target.value })}
                  aria-label="Categoria"
                  className={`w-28 shrink-0 rounded-xl border border-fg/10 bg-fg/5 px-2 py-1.5 text-xs [&>option]:bg-surface ${(overrides[i.row] ?? i.suggested) ? '' : 'text-warn'}`}
                >
                  {!(overrides[i.row] ?? i.suggested) && <option value="">Da scegliere</option>}
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>

          {preview.skipped.length > 0 && (
            <div>
              <button onClick={() => setShowSkipped(!showSkipped)} className="flex items-center gap-1 text-xs font-semibold text-muted">
                <ChevronDown size={14} className={`transition-transform ${showSkipped ? 'rotate-180' : ''}`} /> Righe saltate ({preview.skipped.length})
              </button>
              <AnimatePresence>
                {showSkipped && (
                  <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-faint">
                    {preview.skipped.map((i) => (
                      <li key={i.row} className="flex gap-2">
                        <span className="truncate">{i.desc || `riga ${i.row + 1}`}</span>
                        <span className="tabular shrink-0">{i.amount != null ? formatEur(i.amount) : ''}</span>
                        <span className="ml-auto shrink-0 font-semibold">{i.skip}</span>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          )}

          <Button className="w-full" disabled={!(preview.ok.length || preview.incomes.length) || busy} onClick={doImport}>
            <Receipt size={18} /> Importa {preview.ok.length + preview.incomes.length} movimenti
          </Button>
        </>
      )}
    </div>
  )
}
