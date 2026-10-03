#!/data/data/com.termux/files/usr/bin/bash
# Aggiorna il server all'ultima versione del repo e lo riavvia.
set -e
cd "$(dirname "$0")/.."
git pull --ff-only
bash termux/install.sh
