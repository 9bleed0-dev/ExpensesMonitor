#!/data/data/com.termux/files/usr/bin/bash
# Installa (o aggiorna) il server di Expenses Monitor in Termux, con avvio automatico e self-healing.
# Uso:  bash termux/install.sh            (dalla cartella del repo clonato)
# Rieseguirlo è sicuro: non tocca dati, token e configurazione già presenti.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONF_DIR="$HOME/.expenses-monitor"
ENV_FILE="$CONF_DIR/env"
SV_DIR="$PREFIX/var/service"

say() { printf '\n\033[1;35m▶ %s\033[0m\n' "$*"; }

say "Pacchetti (node, git, servizi, proot)"
pkg update -y
pkg install -y nodejs-lts git termux-services proot curl

say "Configurazione in $CONF_DIR"
mkdir -p "$CONF_DIR"
chmod 700 "$CONF_DIR"
if [ ! -f "$ENV_FILE" ]; then
  TOKEN="$(node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))")"
  BACKUP_DIR="$CONF_DIR/backup"
  [ -d "$HOME/storage/shared" ] && BACKUP_DIR="$HOME/storage/shared/ExpensesMonitor/backup"
  cat > "$ENV_FILE" <<EOF
# Configurazione del server Expenses Monitor (non condividere: contiene il token)
export TOKEN="$TOKEN"
export PORT=8787
export HOST=127.0.0.1
export DATA_DIR="$CONF_DIR"
export BACKUP_DIR="$BACKUP_DIR"
export BACKUP_KEEP=30
export REPO_DIR="$REPO_DIR"

# Tunnel per far arrivare Claude al telefono: "ngrok" oppure "cloudflared" (vuoto = nessun tunnel)
export TUNNEL=""
# ngrok: dominio statico gratuito dalla dashboard ngrok (es. nome-a-caso.ngrok-free.app)
export NGROK_DOMAIN=""
# cloudflared: token del tunnel creato nella dashboard Cloudflare (Zero Trust → Networks → Tunnels)
export CF_TUNNEL_TOKEN=""
# Indirizzo pubblico del tunnel (https://...), usato dal watchdog per controllarlo
export PUBLIC_URL=""
EOF
  chmod 600 "$ENV_FILE"
  echo "Creato $ENV_FILE con un nuovo token."
else
  echo "$ENV_FILE esiste già: lo lascio com'è."
fi

say "Servizi (runit): server, tunnel, watchdog"
mkdir -p "$SV_DIR"
for s in expenses-server expenses-tunnel expenses-watchdog; do
  mkdir -p "$SV_DIR/$s/log"
  install -m 755 "$REPO_DIR/termux/services/$s/run" "$SV_DIR/$s/run"
  ln -sf "$PREFIX/share/termux-services/svlogger" "$SV_DIR/$s/log/run"
done

say "Avvio automatico all'accensione (Termux:Boot)"
mkdir -p "$HOME/.termux/boot"
install -m 755 "$REPO_DIR/termux/boot/start-expenses" "$HOME/.termux/boot/start-expenses"

# Controllo periodico anche se Android ha chiuso Termux (serve l'app Termux:API)
if command -v termux-job-scheduler >/dev/null 2>&1; then
  say "Controllo periodico ogni 15 minuti (Termux:API)"
  termux-job-scheduler --job-id 4207 --period-ms 900000 --persisted true \
    --script "$REPO_DIR/termux/healthcheck.sh" >/dev/null || echo "Job scheduler non disponibile, salto."
fi

say "Avvio"
termux-wake-lock || true
# shellcheck disable=SC1091
. "$PREFIX/etc/profile.d/start-services.sh" 2>/dev/null || service-daemon start
sleep 2
sv-enable expenses-server >/dev/null 2>&1 || true
sv-enable expenses-watchdog >/dev/null 2>&1 || true
# shellcheck disable=SC1090
. "$ENV_FILE"
if [ -n "${TUNNEL:-}" ]; then sv-enable expenses-tunnel >/dev/null 2>&1 || true; else sv-disable expenses-tunnel >/dev/null 2>&1 || true; fi
sv restart expenses-server >/dev/null 2>&1 || true

for i in 1 2 3 4 5 6 7 8 9 10; do
  curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1 && break
  sleep 1
done

if curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
  say "Fatto! Server attivo su http://127.0.0.1:$PORT"
else
  say "Il server non risponde: guarda il log con  tail -f $PREFIX/var/log/sv/expenses-server/current"
fi

cat <<EOF

Token (da incollare nell'app, Opzioni → Server sul telefono):
  $TOKEN

Prossimi passi: vedi docs/TELEFONO.md
  1. Esenta Termux dall'ottimizzazione batteria e apri una volta Termux:Boot.
  2. Configura il tunnel in $ENV_FILE e riesegui questo script.
  3. In Claude aggiungi il connettore personalizzato:  <PUBLIC_URL>/mcp/<TOKEN>
EOF
