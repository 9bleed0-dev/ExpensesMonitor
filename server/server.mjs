// Server di Expenses Monitor: gira sul telefono (Termux), senza dipendenze esterne.
//  - /health          stato (senza token, per il watchdog)
//  - /api/sync        sincronizzazione con l'app (Authorization: Bearer <TOKEN>)
//  - /mcp/<TOKEN>     endpoint MCP per Claude (connettore personalizzato)
// Configurazione da variabili d'ambiente: TOKEN (obbligatorio), PORT, HOST, DATA_DIR, BACKUP_DIR, BACKUP_KEEP.
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { openStore } from './store.mjs'
import { callTool, TOOLS } from './tools.mjs'

const TOKEN = process.env.TOKEN ?? ''
const PORT = Number(process.env.PORT ?? 8787)
const HOST = process.env.HOST ?? '127.0.0.1'
const DATA_DIR = process.env.DATA_DIR ?? path.join(os.homedir(), '.expenses-monitor')
const BACKUP_DIR = process.env.BACKUP_DIR ?? path.join(DATA_DIR, 'backup')
const BACKUP_KEEP = Number(process.env.BACKUP_KEEP ?? 30)
const VERSION = '1.0.0'

if (TOKEN.length < 24) {
  console.error('TOKEN mancante o troppo corto (minimo 24 caratteri). Esegui termux/install.sh o imposta TOKEN.')
  process.exit(1)
}

const store = openStore(DATA_DIR)
const log = (...a) => console.log(new Date().toISOString(), ...a)

const sameToken = (t) => {
  const a = Buffer.from(String(t ?? ''))
  const b = Buffer.from(TOKEN)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// CORS: l'app gira su GitHub Pages (https) e chiama il server su 127.0.0.1.
// Access-Control-Allow-Private-Network serve a Chrome per le richieste da sito pubblico a rete locale.
function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*')
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version')
  res.setHeader('Access-Control-Allow-Private-Network', 'true')
  res.setHeader('Access-Control-Max-Age', '600')
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(body === undefined ? '' : JSON.stringify(body))
}

async function readJson(req, limit = 20 * 1024 * 1024) {
  let size = 0
  const chunks = []
  for await (const c of req) {
    size += c.length
    if (size > limit) throw Object.assign(new Error('Richiesta troppo grande'), { status: 413 })
    chunks.push(c)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    throw Object.assign(new Error('JSON non valido'), { status: 400 })
  }
}

// ---------------- MCP (Streamable HTTP, risposte JSON) ----------------
const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05']

function mcpHandle(msg) {
  const { id, method, params } = msg ?? {}
  const ok = (result) => ({ jsonrpc: '2.0', id, result })
  const fail = (code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })
  if (id === undefined) return null // notifica: nessuna risposta

  switch (method) {
    case 'initialize':
      return ok({
        protocolVersion: PROTOCOLS.includes(params?.protocolVersion) ? params.protocolVersion : PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'expenses-monitor', title: 'Expenses Monitor', version: VERSION },
        instructions:
          "Dati di Expenses Monitor, l'app personale di spese dell'utente. Importi in euro. Le date sono YYYY-MM-DD. " +
          'Prima di aggiungere spese usa elenca_categorie se non conosci le categorie. Le modifiche arrivano sul telefono alla prossima sincronizzazione.',
      })
    case 'ping':
      return ok({})
    case 'tools/list':
      return ok({ tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) })
    case 'tools/call':
      try {
        const out = callTool(store, params?.name, params?.arguments)
        log('mcp', params?.name)
        return ok({ content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] })
      } catch (e) {
        return ok({ content: [{ type: 'text', text: e.message }], isError: true })
      }
    case 'resources/list':
      return ok({ resources: [] })
    case 'prompts/list':
      return ok({ prompts: [] })
    default:
      return fail(-32601, `Metodo non supportato: ${method}`)
  }
}

async function mcp(req, res) {
  if (req.method === 'GET') return send(res, 405, { error: 'Usa POST' })
  if (req.method === 'DELETE') return send(res, 200, {})
  if (req.method !== 'POST') return send(res, 405, { error: 'Metodo non consentito' })
  const body = await readJson(req)
  const replies = (Array.isArray(body) ? body : [body]).map(mcpHandle).filter(Boolean)
  if (replies.length === 0) {
    res.writeHead(202)
    return res.end()
  }
  return send(res, 200, Array.isArray(body) ? replies : replies[0])
}

// ---------------- Backup automatico ----------------
function backup() {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
    const day = new Date().toISOString().slice(0, 10)
    const file = path.join(BACKUP_DIR, `expenses-backup-${day}.json`)
    fs.writeFileSync(file + '.tmp', JSON.stringify(store.exportData(), null, 2))
    fs.renameSync(file + '.tmp', file)
    const old = fs.readdirSync(BACKUP_DIR).filter((f) => /^expenses-backup-.*\.json$/.test(f)).sort().slice(0, -BACKUP_KEEP)
    for (const f of old) fs.unlinkSync(path.join(BACKUP_DIR, f))
    log('backup', file)
  } catch (e) {
    log('backup fallito:', e.message)
  }
}

// ---------------- Router ----------------
const server = http.createServer(async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    return res.end()
  }
  const url = new URL(req.url, 'http://localhost')
  try {
    if (url.pathname === '/health') return send(res, 200, { ok: true, version: VERSION, rev: store.rev })

    const mcpMatch = url.pathname.match(/^\/mcp\/([^/]+)\/?$/)
    if (mcpMatch) {
      if (!sameToken(decodeURIComponent(mcpMatch[1]))) return send(res, 404, { error: 'Non trovato' })
      return await mcp(req, res)
    }

    if (url.pathname.startsWith('/api/')) {
      const auth = req.headers.authorization ?? ''
      if (!sameToken(auth.replace(/^Bearer\s+/i, ''))) return send(res, 401, { error: 'Token non valido' })
      if (url.pathname === '/api/sync' && req.method === 'POST') {
        const { since, changes } = await readJson(req)
        const out = store.sync(since, Array.isArray(changes) ? changes : [])
        if (changes?.length) log('sync', `${changes.length} modifiche dal telefono`)
        return send(res, 200, out)
      }
      if (url.pathname === '/api/backup' && req.method === 'GET') return send(res, 200, store.exportData())
    }
    return send(res, 404, { error: 'Non trovato' })
  } catch (e) {
    log('errore', req.method, url.pathname, e.message)
    if (!res.headersSent) send(res, e.status ?? 500, { error: e.message })
  }
})

server.listen(PORT, HOST, () => {
  log(`Expenses Monitor server ${VERSION} su http://${HOST}:${PORT} (dati in ${DATA_DIR})`)
  backup()
  setInterval(backup, 6 * 60 * 60 * 1000).unref() // il file del giorno viene sovrascritto
})

// Chiusura pulita (runit invia SIGTERM): il database WAL resta consistente
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    log('arresto', sig)
    server.close()
    store.close()
    process.exit(0)
  })
}
// In caso di errore imprevisto meglio uscire: il supervisore riavvia il processo pulito
process.on('uncaughtException', (e) => {
  log('errore fatale', e.stack ?? e)
  process.exit(1)
})
