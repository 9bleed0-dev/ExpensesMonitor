# Server sul telefono (e accesso di Claude)

Il server gira in **Termux** sul telefono Android. L'app continua a funzionare offline come prima,
ma si sincronizza con il server; Claude legge e modifica i dati tramite un **connettore MCP**
raggiungibile attraverso un tunnel. I dati restano solo sul telefono (database SQLite + backup giornalieri).

```
App (PWA, IndexedDB) ──sync──▶ server Node su 127.0.0.1:8787 ◀──tunnel── Claude (connettore MCP)
                                   │
                                   └── backup JSON giornaliero
```

## Cosa succede quando…

| Situazione | App sul telefono | Claude |
|---|---|---|
| Niente campo | funziona, sincronizza in locale | non raggiunge il server; il tunnel si ricollega da solo al ritorno della rete |
| Il server va in crash | funziona offline | runit lo riavvia in pochi secondi |
| Il server è bloccato | funziona offline | il watchdog lo riavvia entro ~2 minuti |
| Il tunnel non risponde | — | il watchdog lo riavvia dopo ~3 minuti (solo se c'è rete) |
| Android chiude Termux | funziona offline | il controllo ogni 15 minuti (Termux:API) lo rilancia |
| Riavvio del telefono | — | Termux:Boot riavvia tutto all'accensione |
| Telefono spento | — | non raggiungibile |

## Installazione

1. Installa da **F-Droid** (non dal Play Store, quelle versioni sono vecchie): **Termux**, **Termux:Boot**, **Termux:API**.
2. Apri **Termux:Boot** una volta (serve ad attivarlo).
3. Impostazioni Android → App → Termux (e Termux:API) → Batteria → **Senza restrizioni**.
4. In Termux:
   ```bash
   termux-setup-storage            # facoltativo: backup visibili in Download/ExpensesMonitor
   pkg install -y git
   git clone https://github.com/9bleed0-dev/ExpensesMonitor ~/expensesmonitor
   bash ~/expensesmonitor/termux/install.sh
   ```
   Alla fine stampa il **token**. Lo ritrovi sempre in `~/.expenses-monitor/env`.
5. Nell'app: **Opzioni → Server sul telefono** → indirizzo `http://127.0.0.1:8787` + token → **Collega**.
   La prima sincronizzazione carica sul server tutti i dati già presenti nell'app.
   Se Chrome chiede il permesso di accedere ai dispositivi della rete locale, concedilo.

## Tunnel per Claude

Serve un indirizzo pubblico **fisso**, altrimenti il connettore smette di funzionare a ogni riavvio.

**ngrok (gratis, nessun dominio):**
1. Crea un account su ngrok.com, copia l'**authtoken** e prendi il tuo **dominio statico gratuito** (Domains).
2. `bash ~/expensesmonitor/termux/ngrok-setup.sh <AUTHTOKEN>`
3. In `~/.expenses-monitor/env`: `TUNNEL="ngrok"`, `NGROK_DOMAIN="tuo-dominio.ngrok-free.app"`, `PUBLIC_URL="https://tuo-dominio.ngrok-free.app"`.
4. `bash ~/expensesmonitor/termux/install.sh`

**cloudflared (serve un dominio su Cloudflare):**
1. `pkg install cloudflared`
2. Dashboard Cloudflare → Zero Trust → Networks → Tunnels → crea un tunnel, hostname pubblico → `http://localhost:8787`, copia il token.
3. In `~/.expenses-monitor/env`: `TUNNEL="cloudflared"`, `CF_TUNNEL_TOKEN="..."`, `PUBLIC_URL="https://spese.tuodominio.it"`.
4. `bash ~/expensesmonitor/termux/install.sh`

Verifica dal browser: `PUBLIC_URL/health` deve rispondere `{"ok":true,…}`.

## Collegare Claude

Claude → Impostazioni → Connettori → **Aggiungi connettore personalizzato**:

- Nome: `Expenses Monitor`
- URL: `PUBLIC_URL/mcp/TOKEN` (es. `https://tuo-dominio.ngrok-free.app/mcp/abc…`)

Il token nell'URL è la chiave d'accesso: non condividerlo. Per cambiarlo, modifica `TOKEN` nel file env,
riesegui `install.sh` e aggiorna sia l'app sia il connettore.

Strumenti disponibili: `riepilogo_mese`, `elenca_spese`, `aggiungi_spesa`, `modifica_spesa`, `elimina_spesa`,
`elenca_categorie`, `elenca_bollette`, `segna_bolletta_pagata`, `saldo_conto`, `imposta_saldo`.
Le modifiche di Claude compaiono nell'app alla sincronizzazione successiva (entro 30 secondi con l'app aperta).

## Comandi utili

```bash
sv status expenses-server expenses-tunnel expenses-watchdog   # stato
tail -f $PREFIX/var/log/sv/expenses-server/current            # log del server
sv restart expenses-server                                    # riavvio manuale
bash ~/expensesmonitor/termux/update.sh                       # aggiorna all'ultima versione
ls ~/.expenses-monitor/backup ~/storage/shared/ExpensesMonitor/backup 2>/dev/null   # backup
```

I backup giornalieri hanno lo stesso formato di **Opzioni → Backup JSON** e si ripristinano dall'app.
