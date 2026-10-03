# Setup completo: server sul telefono + Claude

Checklist da seguire una volta sola, dall'inizio alla fine. Il server gira sul **telefono Android** (Termux);
il **PC** serve solo come tastiera comoda via SSH (e per far lavorare Claude dall'app desktop).
Per i dettagli di funzionamento vedi [TELEFONO.md](TELEFONO.md).

Tempo: circa 30 minuti. Serve: telefono Android, PC sulla stessa Wi-Fi, account GitHub e ngrok.

---

## 0. Prima di iniziare

- [ ] La PR del server è mergiata su `main` (contiene `server/`, `termux/`, questi documenti).
- [ ] Il deploy su GitHub Pages è verde (scheda *Actions* del repo) e l'app si apre dal telefono.
- [ ] Hai fatto un **Backup JSON** dall'app (Opzioni → Dati & backup), per sicurezza.

## 1. Sul telefono: app e permessi (a mano)

1. Installa **F-Droid** da f-droid.org, poi da F-Droid: **Termux**, **Termux:Boot**, **Termux:API**.
   Non usare le versioni del Play Store: sono vecchie e non compatibili tra loro.
2. Apri **Termux:Boot** una volta e chiudilo (serve ad attivare l'avvio automatico).
3. Impostazioni Android → App → **Termux** → Batteria → **Senza restrizioni**. Stessa cosa per **Termux:API**.
   Su Xiaomi/Samsung/Huawei abilita anche "Avvio automatico" e disattiva "Sospendi app inutilizzate".
4. Apri **Termux** e lascialo finire la prima installazione.

## 2. Sul telefono: SSH per lavorare dal PC

In Termux:

```bash
pkg update -y && pkg install -y openssh
passwd            # scegli la password SSH
sshd              # avvia SSH sulla porta 8022
whoami            # nome utente, es. u0_a123
ifconfig wlan0    # IP del telefono, riga "inet", es. 192.168.1.42
```

Annota **utente** e **IP**. Se `ifconfig` non c'è: `pkg install -y net-tools`.

## 3. Sul PC: entrare nel telefono

```bash
ssh -p 8022 UTENTE@IP_TELEFONO
```

Facoltativo ma consigliato, per non digitare più la password (dal PC):

```bash
ssh-keygen -t ed25519                              # solo se non hai già una chiave
ssh-copy-id -p 8022 UTENTE@IP_TELEFONO
```

Da qui in poi tutti i comandi si danno **nella sessione SSH** (cioè girano sul telefono).

> **Con Claude:** apri questa chat nell'**app desktop di Claude** sul PC e manda un messaggio: Claude potrà usare
> il terminale del PC e fare i passi 4–7 via SSH. Dagli utente e IP, **mai** password o authtoken.

## 4. Installare il server

```bash
termux-setup-storage        # facoltativo: i backup finiscono in Download/ExpensesMonitor (conferma sul telefono)
pkg install -y git
git clone https://github.com/9bleed0-dev/ExpensesMonitor ~/expensesmonitor
bash ~/expensesmonitor/termux/install.sh
```

Verifica:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8787/health    # atteso: 200
sv status expenses-server expenses-watchdog                              # atteso: run
```

Il token si trova in `~/.expenses-monitor/env` (`grep TOKEN ~/.expenses-monitor/env`). Non va committato né condiviso.

## 5. Collegare l'app al server

Sul telefono, nell'app: **Opzioni → Server sul telefono**

- Indirizzo: `http://127.0.0.1:8787`
- Token: quello del passo 4
- **Collega** → lo stato deve diventare "Sincronizzato".

Se Chrome chiede il permesso di accedere ai dispositivi della rete locale, **consenti**.
La prima sincronizzazione carica sul server tutti i dati già presenti nell'app.

## 6. Tunnel ngrok (per far arrivare Claude al telefono)

1. Su **dashboard.ngrok.com**: registrati, copia l'**Authtoken**, e in **Domains** prendi il dominio statico gratuito
   (es. `nome-a-caso.ngrok-free.app`).
2. Installa ngrok e registra il token — **digitalo tu**, non incollarlo in chat:
   ```bash
   bash ~/expensesmonitor/termux/ngrok-setup.sh IL_TUO_AUTHTOKEN
   ```
3. Configura il tunnel:
   ```bash
   nano ~/.expenses-monitor/env
   ```
   ```
   export TUNNEL="ngrok"
   export NGROK_DOMAIN="nome-a-caso.ngrok-free.app"
   export PUBLIC_URL="https://nome-a-caso.ngrok-free.app"
   ```
   Salva: Ctrl+O, Invio, Ctrl+X.
4. Applica e verifica:
   ```bash
   bash ~/expensesmonitor/termux/install.sh
   sleep 5
   curl -sS -m 15 https://nome-a-caso.ngrok-free.app/health
   ```
   Atteso: `{"ok":true,"version":"1.0.0",…}`. Se compare `ERR_NGROK_…` il problema è nel tunnel:
   guarda `tail -n 50 $PREFIX/var/log/sv/expenses-tunnel/current`.

## 7. Collegare Claude

Claude (web o app) → **Impostazioni → Connettori → Aggiungi connettore personalizzato**

- Nome: `Expenses Monitor`
- URL: `https://nome-a-caso.ngrok-free.app/mcp/TOKEN`

Prova chiedendo a Claude: *"Dammi il riepilogo spese di questo mese"*. Le modifiche fatte da Claude
compaiono nell'app alla sincronizzazione successiva (entro 30 secondi con l'app aperta).

## 8. Prova del self-healing

```bash
pkill -f server.mjs; sleep 5; curl -sS http://127.0.0.1:8787/health      # runit lo ha già riavviato
```

Poi **riavvia il telefono**, aspetta un minuto senza aprire Termux e riprova `PUBLIC_URL/health` dal PC:
deve rispondere (avvio automatico con Termux:Boot).

---

## Problemi comuni

| Sintomo | Causa probabile | Soluzione |
|---|---|---|
| SSH: `Connection refused` | `sshd` non avviato | in Termux: `sshd` |
| SSH: timeout | telefono su altra rete o IP cambiato | stessa Wi-Fi, ricontrolla `ifconfig wlan0` |
| App: "Server non raggiungibile" | server fermo o permesso rete locale negato | `sv status expenses-server`; consenti il permesso in Chrome |
| App: "Token non valido" | token copiato male | ricopialo da `~/.expenses-monitor/env` |
| `/health` pubblico non risponde | tunnel giù o niente rete | `sv restart expenses-tunnel`, log del tunnel |
| ngrok: errore DNS / `lookup` | resolv.conf mancante | il servizio usa già `proot`; verifica `pkg install proot` |
| Dopo un riavvio non riparte nulla | Termux:Boot mai aperto o batteria limitata | ripeti il passo 1.2 e 1.3 |
| Claude non vede gli strumenti | URL connettore sbagliato | deve finire con `/mcp/TOKEN`, senza barra finale |

## Aggiornare in futuro

```bash
bash ~/expensesmonitor/termux/update.sh
```

Scarica l'ultima versione dal repo e riavvia i servizi. Dati, token e configurazione restano invariati.

## Cambiare il token

Modifica `TOKEN` in `~/.expenses-monitor/env`, poi `sv restart expenses-server`, e aggiorna sia
l'app (Opzioni → Server sul telefono) sia l'URL del connettore in Claude.
