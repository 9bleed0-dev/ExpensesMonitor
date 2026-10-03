#!/data/data/com.termux/files/usr/bin/bash
# Scarica ngrok (arm64) e registra il tuo authtoken.  Uso: bash termux/ngrok-setup.sh <AUTHTOKEN>
set -euo pipefail
[ $# -eq 1 ] || { echo "Uso: bash termux/ngrok-setup.sh <AUTHTOKEN dalla dashboard ngrok>"; exit 1; }
mkdir -p "$HOME/.local/bin"
cd "$HOME/.local/bin"
curl -fsSLo ngrok.tgz https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-arm64.tgz
tar xzf ngrok.tgz && rm ngrok.tgz
chmod +x ngrok
proot -b "$PREFIX/etc/resolv.conf:/etc/resolv.conf" ./ngrok config add-authtoken "$1"
echo "ngrok pronto. Ora in ~/.expenses-monitor/env imposta TUNNEL=ngrok, NGROK_DOMAIN e PUBLIC_URL, poi riesegui termux/install.sh"
