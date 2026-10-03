import { RefreshCw, Unplug } from 'lucide-react'
import { useState } from 'react'
import { DEFAULT_SYNC_URL, getSyncConfig, setSyncConfig, syncNow, useSyncStatus, type SyncState } from '../lib/sync'
import { Card, SectionTitle } from './Card'
import { useToast } from './Toast'
import { Button, Field, Input } from './ui'

const LABELS: Record<SyncState, { text: string; dot: string }> = {
  off: { text: 'Non collegato', dot: 'bg-fg/30' },
  idle: { text: 'Sincronizzato', dot: 'bg-good' },
  syncing: { text: 'Sincronizzazione…', dot: 'bg-accent animate-pulse' },
  offline: { text: 'Server non raggiungibile', dot: 'bg-amber-500' },
  error: { text: 'Errore', dot: 'bg-bad' },
}

/** Collegamento al server sul telefono (Termux), che permette anche a Claude di gestire i dati */
export function SyncSettings() {
  const status = useSyncStatus()
  const toast = useToast()
  const saved = getSyncConfig()
  const [url, setUrl] = useState(saved?.url ?? DEFAULT_SYNC_URL)
  const [token, setToken] = useState(saved?.token ?? '')
  const label = LABELS[status.state]

  function connect() {
    const u = url.trim().replace(/\/+$/, '')
    if (!/^https?:\/\/.+/.test(u) || token.trim().length < 24) return toast({ text: 'Indirizzo o token non validi' })
    setSyncConfig({ url: u, token: token.trim() })
    toast({ text: 'Server collegato ✓' })
  }

  return (
    <Card>
      <SectionTitle>Server sul telefono</SectionTitle>
      <div className="mb-4 flex items-center gap-2 text-sm">
        <span className={`h-2.5 w-2.5 rounded-full ${label.dot}`} />
        <span className="font-semibold">{label.text}</span>
        {status.lastSync && status.state !== 'off' && (
          <span className="text-muted">· ultima {new Date(status.lastSync).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
        )}
      </div>
      {status.error && status.state !== 'idle' && <p className="-mt-2 mb-4 text-xs text-muted">{status.error}</p>}
      <div className="space-y-3">
        <Field label="Indirizzo">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={DEFAULT_SYNC_URL} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        </Field>
        <Field label="Token">
          <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="dal file ~/.expenses-monitor/env" autoComplete="off" />
        </Field>
        <div className="flex gap-2">
          {saved && (
            <>
              <Button variant="ghost" onClick={() => setSyncConfig(null)} aria-label="Scollega">
                <Unplug size={18} />
              </Button>
              <Button variant="ghost" onClick={() => void syncNow()} aria-label="Sincronizza ora">
                <RefreshCw size={18} />
              </Button>
            </>
          )}
          <Button className="flex-1" onClick={connect}>
            {saved ? 'Aggiorna' : 'Collega'}
          </Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-faint">
        I dati restano sul telefono: l'app si sincronizza con il server in Termux, e Claude lo usa tramite il connettore. Senza server l'app funziona come prima.
      </p>
    </Card>
  )
}
