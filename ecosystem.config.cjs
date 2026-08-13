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
      restart_delay: 8000,
      min_uptime: 20000,
      max_restarts: 50,
      kill_timeout: 15000,
      listen_timeout: 15000,
      exp_backoff_restart_delay: 15000,
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
