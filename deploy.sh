#!/usr/bin/env bash
#
# deploy.sh — Aggiorna il bot sul PC Linux (H24) con 1 comando.
#
#   chmod +x deploy.sh   # (solo la PRIMA volta)
#   ./deploy.sh
#
set -euo pipefail

BOT_NAME="hermes-bot"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "▶ [1/5] Pull ultimo codice da git..."
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git pull --ff-only
else
  echo "⚠️  Non è una repo git — salto il pull."
fi

echo
echo "▶ [2/5] Install dipendenze (npm ci)..."
command -v npm >/dev/null 2>&1 || { echo "❌ npm non trovato. Installa Node.js v20+."; exit 1; }
npm ci

echo
echo "▶ [3/5] Build bot (tsc) + dashboard (vite)..."
npm run build

echo
echo "▶ [4/5] Hot-reload via PM2..."
if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe "$BOT_NAME" >/dev/null 2>&1; then
    pm2 reload ecosystem.config.js --update-env
  else
    pm2 start ecosystem.config.js
  fi
  pm2 save
else
  echo "⚠️  PM2 non installato globalmente. Provo con npx..."
  npx --yes pm2 start ecosystem.config.js
  npx --yes pm2 save
fi

echo
echo "▶ [5/5] Stato..."
if command -v pm2 >/dev/null 2>&1; then
  pm2 status
  echo
  echo "💡 Log live:  pm2 logs $BOT_NAME"
  echo "💡 Riavvia:   pm2 restart $BOT_NAME"
  echo "💡 Dashboard: http://<IP-PC>:3000"
else
  echo "Fatto."
fi
