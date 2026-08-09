# Hermes v1

Bot Discord per la community Wolvesville + **Dashboard di controllo integrata** (Welcome/Leave Canvas Editor, Auto Role, Messaggi programmati, TTS, Logs).

- **1 solo processo PM2**: il bot Discord + il server web della dashboard girano insieme.
- Storage locale in `data/bot-config.json` (nessun database esterno).
- Porta dashboard (default): `DASHBOARD_PORT=3000`.
- Autenticazione dashboard opzionale via `DASHBOARD_PASSWORD` nel `.env`.

## 🚀 Sviluppo locale

```bash
npm install
npm run dev                 # solo il bot, hot reload (ts-node)
# oppure
npm run dev:dashboard       # solo frontend Vite (porta 5173) — per editare la UI velocemente
```

## 🏗️ Build di produzione

```bash
npm run build
# -> compila TypeScript in dist/ + dashboard React in dashboard-dist/
```

## ⚙️ Deploy su PC Linux H24 con PM2

1. **Clona / copia** la cartella sul PC Linux 

2. **Crea il file `.env`** dentro la cartella (copia da `.env` locale, o da 

   ```bash
   DISCORD_BOT_TOKEN=...
   WOLVESVILLE_API_KEY=...
   WOLVESVILLE_PERSONAL_API_KEY=...
   WOLVESVILLE_CLAN_ID=...
   DASHBOARD_PORT=3000
   DASHBOARD_PASSWORD=   # lasciala vuota se solo LAN locale, oppure metti password
   NODE_ENV=production
   LOG_LEVEL=info
   ```

3. **Installa**

   ```bash
   npm install
   npm run build
   sudo npm install pm2 -g
   ```

4. **Avvia**

   ```bash
   pm2 start ecosystem.config.js
   pm2 save                      # salva la lista processi
   pm2 startup                   # ti stampa 1 comando da copiare (abilita auto-start dopo reboot)
   ```

5. **Dashboard accessibile su**:

   - Sullo stesso PC: `http://localhost:3000`
   - In casa (LAN): `http://192.168.x.x:3000` (sostituisci con IP Linux)
   - Fuori casa (opzionale): Cloudflare Tunnel / ngrok → punta a `http://localhost:3000` (imposta `DASHBOARD_PASSWORD`)

## 🔄 Aggiornamenti successivi (1 solo comando)

```bash
chmod +x deploy.sh    # (solo la PRIMA volta)
./deploy.sh
```

Oppure manuale:

```bash
git pull
npm ci
npm run build
pm2 reload ecosystem.config.js --update-env
pm2 save
```

## 📋 Comandi PM2 utili

| Comando | Cosa fa |
|---|---|
| `pm2 status` | Lista processi e uptime |
| `pm2 logs hermes-bot --lines 200` | Ultimi 200 log |
| `pm2 logs hermes-bot` | Log live |
| `pm2 restart hermes-bot` | Riavvio immediato |
| `pm2 reload ecosystem.config.js` | Hot reload (zero downtime, dopo build) |
| `pm2 monit` | Monitor CPU/RAM/Log a tutto schermo |
| `pm2 stop hermes-bot` | Stop |
| `pm2 delete hermes-bot` | Rimuovi da PM2 |

## 🗂️ Struttura del progetto

```
Hermes v1/
├── src/                  # Bot + server API Express (TypeScript)
│   ├── commands/         # /slash commands (sondaggio, rose, impostazioni, ecc.)
│   ├── utils/            # storage.ts, wolvesville.ts, welcome-leave.ts, tts.ts…
│   ├── server.ts         # HTTP server: serve la dashboard + /api/*
│   └── index.ts          # Entry point: startBot() + avvia server.ts
├── dashboard/            # Sorgenti React della dashboard (solo sviluppo)
│   └── src/
├── dashboard-dist/       # Build di produzione della dashboard (generato da Vite)
├── dist/                 # Build TypeScript del bot (generata da tsc)
├── assets/               # Immagini statiche (card, rose, ecc.)
├── data/                 # Config e log persistenti (NON su git!)
│   └── bot-config.json
├── ecosystem.config.js   # Config PM2 (processo singolo bot+dashboard)
├── deploy.sh             # Script update 1-click
├── .env
├── package.json
└── tsconfig.json
```

## 🔒 Note sicurezza

- Se apri la porta 3000 su internet con **port forwarding**: **imposta OBBLIGATORIAMENTE** `DASHBOARD_PASSWORD=...` nel `.env`.
- Alternativa consigliata per accesso esterno senza port forwarding: **Cloudflare Tunnel** (dominio HTTPS gratis, zero configurazione firewall).
- Non condividere la cartella `data/` — contiene la configurazione e i log del server.
