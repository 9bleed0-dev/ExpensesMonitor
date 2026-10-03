import Dexie from 'dexie'
import { useSyncExternalStore } from 'react'
import { db } from '../db'

/**
 * Sincronizzazione con il server sul telefono (cartella server/ del repo).
 * L'app resta local-first: lavora sempre su IndexedDB e, quando il server è raggiungibile,
 * invia le proprie modifiche e riceve quelle fatte altrove (per esempio da Claude via MCP).
 *
 * Le modifiche locali si calcolano confrontando le righe attuali con l'ultima versione sincronizzata
 * (tabella syncShadow), quindi non serve toccare il resto del codice che scrive su Dexie.
 */

const TABLES = ['expenses', 'recurring', 'categories', 'meta'] as const
type TableName = (typeof TABLES)[number]
type Change = { t: TableName; k: string | number; v: Record<string, unknown> | null }
type Row = Record<string, unknown>

const keyOf = (t: TableName, row: Row) => (t === 'meta' ? row.key : row.id) as string | number
const shadowId = (t: string, k: string | number) => `${t}:${k}`
const REV = '__rev'

export interface SyncConfig {
  url: string
  token: string
}

export type SyncState = 'off' | 'idle' | 'syncing' | 'offline' | 'error'
export interface SyncStatus {
  state: SyncState
  lastSync?: number
  error?: string
}

export const DEFAULT_SYNC_URL = 'http://127.0.0.1:8787'
const CONFIG_KEY = 'syncConfig'

export function getSyncConfig(): SyncConfig | null {
  try {
    const v = JSON.parse(localStorage.getItem(CONFIG_KEY) ?? 'null')
    return v?.url && v?.token ? v : null
  } catch {
    return null
  }
}

export function setSyncConfig(cfg: SyncConfig | null) {
  try {
    if (cfg) localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg))
    else localStorage.removeItem(CONFIG_KEY)
  } catch {
    /* storage non disponibile */
  }
  setStatus(cfg ? { state: 'idle' } : { state: 'off' })
  if (cfg) void syncNow()
}

// ---- stato osservabile dalla UI ----
let status: SyncStatus = { state: 'off' }
const listeners = new Set<() => void>()
function setStatus(next: SyncStatus) {
  status = { lastSync: status.lastSync, ...next }
  listeners.forEach((l) => l())
}
export function useSyncStatus() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => status,
  )
}

async function readSnapshot() {
  const snap = new Map<string, string>()
  for (const t of TABLES) {
    const rows = (await db.table(t).toArray()) as Row[]
    for (const r of rows) snap.set(shadowId(t, keyOf(t, r)), JSON.stringify(r))
  }
  return snap
}

let running = false
let again = false

export async function syncNow(): Promise<void> {
  const cfg = getSyncConfig()
  if (!cfg) return setStatus({ state: 'off' })
  if (running) {
    again = true
    return
  }
  running = true
  setStatus({ state: 'syncing' })
  try {
    const snap = await readSnapshot()
    const shadow = new Map((await db.syncShadow.toArray()).map((r) => [r.id, r.json]))
    const neverSynced = !shadow.has(REV)
    const since = Number(shadow.get(REV) ?? 0)

    // Prima sincronizzazione su un dispositivo vuoto (solo categorie di default): scarica e basta,
    // così le categorie predefinite non sovrascrivono quelle personalizzate salvate sul server.
    const hasLocalData = [...snap.keys()].some((id) => id.startsWith('expenses:') || id.startsWith('recurring:'))
    const changes: Change[] = []
    if (!neverSynced || hasLocalData) {
      for (const [id, json] of snap) if (shadow.get(id) !== json) changes.push(toChange(id, JSON.parse(json)))
      for (const id of shadow.keys()) if (id !== REV && !snap.has(id)) changes.push(toChange(id, null))
    }

    const res = await fetch(`${cfg.url.replace(/\/+$/, '')}/api/sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ since, changes }),
      signal: AbortSignal.timeout(20_000),
    })
    if (res.status === 401) throw new Error('Token non valido')
    if (!res.ok) throw new Error(`Errore del server (${res.status})`)
    const out = (await res.json()) as { rev: number; changes: Change[] }

    await db.transaction('rw', [db.expenses, db.recurring, db.categories, db.meta, db.syncShadow], async () => {
      // Quello che abbiamo inviato ora è la versione sincronizzata
      for (const c of changes) {
        const id = shadowId(c.t, c.k)
        if (c.v) await db.syncShadow.put({ id, json: JSON.stringify(c.v) })
        else await db.syncShadow.delete(id)
      }
      // Modifiche arrivate dal server
      for (const c of out.changes) {
        if (!TABLES.includes(c.t)) continue
        const id = shadowId(c.t, c.k)
        const table = db.table(c.t)
        const cur = (await table.get(c.k)) as Row | undefined
        const curJson = cur ? JSON.stringify(cur) : undefined
        // Riga modificata sul telefono mentre sincronizzavamo: vince la modifica locale, verrà inviata al prossimo giro
        if (curJson !== snap.get(id)) continue
        if (c.v == null) {
          if (cur) await table.delete(c.k)
          if (shadow.has(id) || changes.some((x) => shadowId(x.t, x.k) === id)) await db.syncShadow.delete(id)
        } else {
          const json = JSON.stringify(c.v)
          if (curJson !== json) await table.put(c.v)
          if (shadow.get(id) !== json) await db.syncShadow.put({ id, json })
        }
      }
      if (shadow.get(REV) !== String(out.rev)) await db.syncShadow.put({ id: REV, json: String(out.rev) })
    })
    setStatus({ state: 'idle', lastSync: Date.now() })
  } catch (e) {
    const offline = e instanceof TypeError || (e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError'))
    setStatus(offline ? { state: 'offline', error: 'Server non raggiungibile' } : { state: 'error', error: e instanceof Error ? e.message : String(e) })
  } finally {
    running = false
    if (again) {
      again = false
      schedule(500)
    }
  }
}

function toChange(id: string, v: Row | null): Change {
  const i = id.indexOf(':')
  const t = id.slice(0, i) as TableName
  const raw = id.slice(i + 1)
  return { t, k: t === 'expenses' || t === 'recurring' ? Number(raw) : raw, v }
}

let timer: ReturnType<typeof setTimeout> | undefined
function schedule(ms: number) {
  clearTimeout(timer)
  timer = setTimeout(() => void syncNow(), ms)
}

/** Avvia la sincronizzazione automatica: dopo ogni modifica, ogni 30 s con l'app aperta, al ritorno online. */
export function startSync() {
  if (getSyncConfig()) setStatus({ state: 'idle' })
  // Dopo ogni scrittura su IndexedDB (anche da altre schede), con un piccolo ritardo per raggruppare le modifiche
  ;(Dexie.on as unknown as (event: string, fn: () => void) => void)('storagemutated', () => {
    if (!running) schedule(1500)
  })
  setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow()
  }, 30_000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') schedule(300)
  })
  window.addEventListener('online', () => schedule(1000))
  schedule(500)
}
