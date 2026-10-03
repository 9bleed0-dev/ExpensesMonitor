// Archivio dati del server: SQLite (node:sqlite, nessuna dipendenza esterna).
// Specchia le tabelle Dexie dell'app (expenses, recurring, categories, meta) come righe JSON
// con un numero di revisione crescente, usato dalla sincronizzazione.
import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'

export const TABLES = ['expenses', 'recurring', 'categories', 'meta']
const KEY_FIELD = { expenses: 'id', recurring: 'id', categories: 'id', meta: 'key' }
const NUMERIC_KEY = { expenses: true, recurring: true }

export function openStore(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true })
  const db = new DatabaseSync(path.join(dataDir, 'expenses.sqlite'))
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE IF NOT EXISTS rows (
      tbl  TEXT NOT NULL,
      key  TEXT NOT NULL,
      data TEXT,               -- JSON della riga, NULL = eliminata
      rev  INTEGER NOT NULL,
      PRIMARY KEY (tbl, key)
    );
    CREATE INDEX IF NOT EXISTS rows_rev ON rows(rev);
  `)

  const q = {
    maxRev: db.prepare('SELECT COALESCE(MAX(rev), 0) AS rev FROM rows'),
    upsert: db.prepare('INSERT INTO rows (tbl, key, data, rev) VALUES (?, ?, ?, ?) ON CONFLICT(tbl, key) DO UPDATE SET data = excluded.data, rev = excluded.rev'),
    get: db.prepare('SELECT data FROM rows WHERE tbl = ? AND key = ?'),
    all: db.prepare('SELECT key, data FROM rows WHERE tbl = ? AND data IS NOT NULL'),
    since: db.prepare('SELECT tbl, key, data, rev FROM rows WHERE rev > ? ORDER BY rev'),
    minId: db.prepare("SELECT MIN(CAST(key AS INTEGER)) AS m FROM rows WHERE tbl = ?"),
  }

  let rev = q.maxRev.get().rev

  function tx(fn) {
    db.exec('BEGIN')
    try {
      const out = fn()
      db.exec('COMMIT')
      return out
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
  }

  const keyOf = (tbl, row) => String(row[KEY_FIELD[tbl]])

  function put(tbl, row) {
    if (!TABLES.includes(tbl)) throw new Error(`Tabella sconosciuta: ${tbl}`)
    q.upsert.run(tbl, keyOf(tbl, row), JSON.stringify(row), ++rev)
    return row
  }

  function remove(tbl, key) {
    q.upsert.run(tbl, String(key), null, ++rev)
  }

  function get(tbl, key) {
    const r = q.get.get(tbl, String(key))
    return r?.data ? JSON.parse(r.data) : undefined
  }

  function all(tbl) {
    return q.all.all(tbl).map((r) => JSON.parse(r.data))
  }

  /**
   * Nuovo id per righe create dal server (Claude): numeri negativi, così non si scontrano mai
   * con gli id auto-incrementali positivi generati da IndexedDB sul telefono.
   */
  function newId(tbl) {
    const m = q.minId.get(tbl).m
    return Math.min(m ?? 0, 0) - 1
  }

  /** Applica le modifiche del client e restituisce tutto ciò che è cambiato dopo `since`. */
  function sync(since, changes) {
    return tx(() => {
      for (const c of changes ?? []) {
        if (!TABLES.includes(c.t)) continue
        if (c.v == null) remove(c.t, c.k)
        else put(c.t, normalizeKey(c.t, c.v))
      }
      const out = q.since.all(Number(since) || 0).map((r) => ({ t: r.tbl, k: NUMERIC_KEY[r.tbl] ? Number(r.key) : r.key, v: r.data ? JSON.parse(r.data) : null }))
      return { rev, changes: out }
    })
  }

  function normalizeKey(tbl, row) {
    if (NUMERIC_KEY[tbl]) row.id = Number(row.id)
    return row
  }

  /** Backup nello stesso formato di "Backup JSON" dell'app (ripristinabile da Opzioni). */
  function exportData() {
    return {
      app: 'expenses-monitor',
      version: 1,
      exportedAt: new Date().toISOString(),
      expenses: all('expenses'),
      recurring: all('recurring'),
      categories: all('categories'),
      meta: all('meta'),
    }
  }

  return { put, remove, get, all, newId, sync, tx, exportData, get rev() { return rev }, close: () => db.close() }
}
