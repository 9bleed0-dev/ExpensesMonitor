#!/data/data/com.termux/files/usr/bin/sh
# Lanciato da termux-job-scheduler ogni 15 minuti, anche se Android ha chiuso Termux:
# se i servizi non girano li rimette in piedi.
. "$HOME/.expenses-monitor/env"
termux-wake-lock >/dev/null 2>&1
if ! curl -fsS -m 10 "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
  . "$PREFIX/etc/profile.d/start-services.sh" 2>/dev/null || service-daemon start
  sleep 3
  sv restart expenses-server
fi
