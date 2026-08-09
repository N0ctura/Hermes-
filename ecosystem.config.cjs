// ecosystem.config.cjs
// IMPORTANTE: estensione .cjs invece di .js perché package.json ha "type": "module".
// Senza .cjs, Node.js tratta il file come ES module e require()/module.exports non funzionano.
//
// Configurazione PM2 per Hermes v1 (bot Discord + dashboard HTTP)
// Avvio:  pm2 start ecosystem.config.cjs
// Riavvio dopo build: pm2 reload ecosystem.config.cjs
// Log live: pm2 logs hermes-bot
// Stato:    pm2 status
// Persisti: pm2 save && pm2 startup (per autostart dopo reboot Linux)

const path = require("node:path");

const ROOT = __dirname;
const SCRIPT = path.join(ROOT, "dist", "index.js");

module.exports = {
  apps: [
    {
      name: "hermes-bot",
      script: SCRIPT,
      cwd: ROOT,
      node_args: "--enable-source-maps",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      restart_delay: 3000,
      min_uptime: 10000,
      max_restarts: 15,
      kill_timeout: 5000,
      listen_timeout: 8000,
      env: {
        NODE_ENV: "production",
        LOG_LEVEL: "info",
      },
      error_file: path.join(ROOT, "data", "pm2-error.log"),
      out_file: path.join(ROOT, "data", "pm2-out.log"),
      log_file: path.join(ROOT, "data", "pm2-combined.log"),
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      time: true,
      merge_logs: true,
    },
  ],
};
