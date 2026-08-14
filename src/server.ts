import type { Client } from "discord.js";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import {
  loadConfig,
  saveConfig,
  type GuildWelcomeLeaveConfig,
  type GuildTTSConfig,
  type GuildLogsConfig,
  type ScheduledMessageConfig,
  type BotConfig,
} from "./utils/storage.js";
import { logger } from "./utils/logger.js";
import { fetchClanById, fetchClanMembers, fetchClanLog } from "./utils/wolvesville.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DASHBOARD_PASSWORD = process.env["DASHBOARD_PASSWORD"] || "";
const DASHBOARD_PORT = Number(process.env["DASHBOARD_PORT"] || process.env["PORT"] || 3000);
const startedAt = new Date();

const tokens = new Set<string>();

type AppRequest = Request & {
  __hermesAuth?: boolean;
};

function makeToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function authMiddleware(req: AppRequest, res: Response, next: NextFunction) {
  if (!DASHBOARD_PASSWORD) {
    req.__hermesAuth = true;
    return next();
  }
  const header = req.header("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token && tokens.has(token)) {
    req.__hermesAuth = true;
    return next();
  }
  // Cookie / query per le richieste GET browser? Per ora basta header.
  res.status(401).json({ error: "Autenticazione richiesta" });
}

export async function startWebServer(discordClient: Client): Promise<{ port: number }> {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "20mb" }));

  const assetsDir = path.resolve(__dirname, "..", "assets");
  if (existsSync(assetsDir)) {
    app.use("/assets", express.static(assetsDir));
  }

  /* ===== Auth ===== */
  app.get("/api/auth/meta", (_req, res) => {
    res.json({ needPassword: Boolean(DASHBOARD_PASSWORD), port: DASHBOARD_PORT });
  });

  app.post("/api/auth/login", (req, res) => {
    const { password } = (req.body || {}) as { password?: string };
    if (!DASHBOARD_PASSWORD) {
      return res.json({ ok: true, token: "" });
    }
    if (password !== DASHBOARD_PASSWORD) {
      return res.status(401).json({ ok: false, error: "Password errata" });
    }
    const tok = makeToken();
    tokens.add(tok);
    return res.json({ ok: true, token: tok });
  });

  app.use("/api", authMiddleware);

  /* ===== Status ===== */
  app.get("/api/status", (_req, res) => {
    const cfg = loadConfig();
    const anyWL = cfg.welcomeLeaveConfigs ?? [];
    const anyTts = cfg.ttsConfigs ?? [];
    const anyLogs = cfg.logsConfigs ?? [];
    let guildsCount = 0;
    let membersCount = 0;
    try {
      guildsCount = discordClient.guilds.cache.size;
      membersCount = discordClient.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0);
    } catch {
      /* empty */
    }
    const uptimeSeconds = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));
    res.json({
      online: discordClient.isReady(),
      platform: process.platform,
      uptime: formatUptime(uptimeSeconds),
      uptimeSeconds,
      guildsCount,
      membersCount,
      pingMs: discordClient.isReady() ? discordClient.ws.ping : -1,
      modules: {
        welcome: anyWL.some((c) => c.welcomeEnabled),
        leave: anyWL.some((c) => c.leaveEnabled),
        autorole: anyWL.some((c) => c.autoroleEnabled),
        tts: anyTts.some((c) => c.ttsEnabled),
        logs: anyLogs.some((c) => c.enabled),
      },
      port: DASHBOARD_PORT,
      startedAt: startedAt.toISOString(),
    });
  });

  /* ===== Guilds ===== */
  app.get("/api/guilds", (_req, res) => {
    const out: Array<{ id: string; name: string; icon?: string }> = [];
    discordClient.guilds.cache.forEach((g) => {
      out.push({ id: g.id, name: g.name, icon: g.icon || undefined });
    });
    res.json(out);
  });

  app.get("/api/guilds/:id/channels", async (req, res) => {
    try {
      const guild = discordClient.guilds.cache.get(req.params.id);
      if (!guild) return res.status(404).json({ error: "Guild non trovata" });
      const channels = await guild.channels.fetch().catch(() => null);
      const out: Array<{ id: string; name: string; type: number; parentId?: string | null }> = [];
      channels?.forEach((ch) => {
        if (!ch) return;
        out.push({ id: ch.id, name: ch.name, type: ch.type, parentId: (ch as any).parentId ?? null });
      });
      res.json(out);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/guilds/:id/roles", async (req, res) => {
    try {
      const guild = discordClient.guilds.cache.get(req.params.id);
      if (!guild) return res.status(404).json({ error: "Guild non trovata" });
      const roles = await guild.roles.fetch().catch(() => null);
      const out: Array<{ id: string; name: string; color: number; position: number }> = [];
      roles?.forEach((r) => {
        out.push({ id: r.id, name: r.name, color: r.color, position: r.position });
      });
      res.json(out);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  /* ===== Helpers config ===== */
  function patchConfig(mutator: (c: BotConfig) => void): BotConfig {
    const cfg = loadConfig();
    mutator(cfg);
    saveConfig(cfg);
    return loadConfig();
  }

  function ensureGuild(
    arr: undefined | GuildWelcomeLeaveConfig[],
    guildId: string,
    guildName: string
  ): GuildWelcomeLeaveConfig {
    const found = arr?.find((c) => c.guildId === guildId);
    if (found) return found;
    return {
      guildId,
      guildName,
      welcomeEnabled: false,
      leaveEnabled: false,
      autoroleEnabled: false,
      autoroleRoleIds: [],
    };
  }
  function ensureGuildTts(arr: undefined | GuildTTSConfig[], guildId: string, guildName: string): GuildTTSConfig {
    const found = arr?.find((c) => c.guildId === guildId);
    if (found) return found;
    return { guildId, guildName, ttsEnabled: false, ttsLanguage: "it", ttsPrefixes: [] };
  }
  function ensureGuildLogs(arr: undefined | GuildLogsConfig[], guildId: string, guildName: string): GuildLogsConfig {
    const found = arr?.find((c) => c.guildId === guildId);
    if (found) return found;
    return { guildId, guildName, enabled: false, interceptApps: true, interceptUsers: true };
  }

  async function getGuildName(id: string): Promise<string> {
    try {
      const g = discordClient.guilds.cache.get(id);
      if (g) return g.name;
      const fetched = await discordClient.guilds.fetch(id).catch(() => null);
      return fetched?.name || "Unknown";
    } catch {
      return "Unknown";
    }
  }

  /* ===== Module: WelcomeLeave ===== */
  app.get("/api/module/welcome-leave/:guildId", async (req, res) => {
    const cfg = loadConfig();
    const gn = await getGuildName(req.params.guildId);
    res.json(ensureGuild(cfg.welcomeLeaveConfigs, req.params.guildId, gn));
  });

  app.put("/api/module/welcome-leave/:guildId", async (req, res) => {
    const guildId = req.params.guildId;
    const gn = await getGuildName(guildId);
    const incoming = (req.body || {}) as Partial<GuildWelcomeLeaveConfig>;
    const updated = patchConfig((c) => {
      const arr = Array.isArray(c.welcomeLeaveConfigs) ? [...c.welcomeLeaveConfigs] : [];
      const idx = arr.findIndex((x) => x.guildId === guildId);
      const current = idx >= 0 ? arr[idx] : ensureGuild(arr, guildId, gn);
      const next: GuildWelcomeLeaveConfig = { ...current, guildId, guildName: gn, ...incoming };
      if (idx >= 0) arr[idx] = next;
      else arr.push(next);
      c.welcomeLeaveConfigs = arr;
    });
    res.json(ensureGuild(updated.welcomeLeaveConfigs, guildId, gn));
  });

  /* ===== Module: TTS ===== */
  app.get("/api/module/tts/:guildId", async (req, res) => {
    const cfg = loadConfig();
    const gn = await getGuildName(req.params.guildId);
    res.json(ensureGuildTts(cfg.ttsConfigs, req.params.guildId, gn));
  });

  app.put("/api/module/tts/:guildId", async (req, res) => {
    const guildId = req.params.guildId;
    const gn = await getGuildName(guildId);
    const incoming = (req.body || {}) as Partial<GuildTTSConfig>;
    const updated = patchConfig((c) => {
      const arr = Array.isArray(c.ttsConfigs) ? [...c.ttsConfigs] : [];
      const idx = arr.findIndex((x) => x.guildId === guildId);
      const current = idx >= 0 ? arr[idx] : ensureGuildTts(arr, guildId, gn);
      const next: GuildTTSConfig = { ...current, guildId, guildName: gn, ...incoming };
      if (idx >= 0) arr[idx] = next;
      else arr.push(next);
      c.ttsConfigs = arr;
    });
    res.json(ensureGuildTts(updated.ttsConfigs, guildId, gn));
  });

  /* ===== Module: Logs ===== */
  app.get("/api/module/logs/:guildId", async (req, res) => {
    const cfg = loadConfig();
    const gn = await getGuildName(req.params.guildId);
    res.json(ensureGuildLogs(cfg.logsConfigs, req.params.guildId, gn));
  });

  app.put("/api/module/logs/:guildId", async (req, res) => {
    const guildId = req.params.guildId;
    const gn = await getGuildName(guildId);
    const incoming = (req.body || {}) as Partial<GuildLogsConfig>;
    const updated = patchConfig((c) => {
      const arr = Array.isArray(c.logsConfigs) ? [...c.logsConfigs] : [];
      const idx = arr.findIndex((x) => x.guildId === guildId);
      const current = idx >= 0 ? arr[idx] : ensureGuildLogs(arr, guildId, gn);
      const next: GuildLogsConfig = { ...current, guildId, guildName: gn, ...incoming };
      if (idx >= 0) arr[idx] = next;
      else arr.push(next);
      c.logsConfigs = arr;
    });
    res.json(ensureGuildLogs(updated.logsConfigs, guildId, gn));
  });

  /* ===== Scheduled messages ===== */
  app.get("/api/scheduled-messages/:guildId", (req, res) => {
    const cfg = loadConfig();
    res.json((cfg.scheduledMessages || []).filter((m) => m.guildId === req.params.guildId));
  });

  app.put("/api/scheduled-messages/:guildId", (req, res) => {
    const guildId = req.params.guildId;
    const incoming = (req.body || {}) as Partial<ScheduledMessageConfig>;
    if (!incoming.id) return res.status(400).json({ error: "id required" });
    const updated = patchConfig((c) => {
      const arr = Array.isArray(c.scheduledMessages) ? [...c.scheduledMessages] : [];
      const idx = arr.findIndex((m) => m.id === incoming.id);
      const base: ScheduledMessageConfig = {
        id: incoming.id,
        guildId,
        channelId: incoming.channelId ?? "",
        message: incoming.message ?? "",
        isRecurring: incoming.isRecurring ?? false,
        recurrenceInterval: incoming.recurrenceInterval as any,
        scheduledTime: incoming.scheduledTime ?? new Date().toISOString(),
        lastSent: incoming.lastSent,
        enabled: incoming.enabled ?? true,
        createdAt: incoming.createdAt ?? new Date().toISOString(),
      };
      if (idx >= 0) arr[idx] = { ...arr[idx], ...base };
      else arr.push(base);
      c.scheduledMessages = arr;
    });
    const out = updated.scheduledMessages?.find((m) => m.id === incoming.id);
    res.json(out);
  });

  app.delete("/api/scheduled-messages/:guildId/:id", (req, res) => {
    patchConfig((c) => {
      c.scheduledMessages = (c.scheduledMessages || []).filter(
        (m) => !(m.guildId === req.params.guildId && m.id === req.params.id)
      );
    });
    res.status(204).end();
  });

  /* ===== Clan Wolvesville ===== */
  app.get("/api/clan/overview", async (_req, res) => {
    const clanId = process.env["WOLVESVILLE_CLAN_ID"];
    if (!clanId) {
      return res.status(400).json({ error: "WOLVESVILLE_CLAN_ID non impostato nel .env del bot" });
    }
    try {
      // Ogni chiamata è isolata: se una fallisce, logghiamo il motivo reale
      // e rispondiamo comunque con JSON valido (con quel campo vuoto/null)
      // invece di far fallire l'intera richiesta senza un messaggio chiaro.
      const clan = await fetchClanById(clanId).catch((e) => {
        logger.error({ err: e }, "clan/overview: fetchClanById fallita");
        return null;
      });
      const members = await fetchClanMembers(clanId).catch((e) => {
        logger.error({ err: e }, "clan/overview: fetchClanMembers fallita");
        throw e; // i membri sono il dato principale: qui vogliamo che l'errore emerga
      });
      const logs = await fetchClanLog(clanId).catch((e) => {
        logger.error({ err: e }, "clan/overview: fetchClanLog fallita");
        return [];
      });
      res.json({ clan, members, logs });
    } catch (e: any) {
      logger.error({ err: e }, "clan/overview: errore generale");
      res.status(500).json({ error: e?.message || "Errore recupero dati clan" });
    }
  });

  /* ===== Deleted/modified logs ===== */
  app.get("/api/logs/deleted-modified/:guildId", (req, res) => {
    const cfg = loadConfig();
    const out = (cfg.deletedModifiedLogs || []).filter((l) => l.guildId === req.params.guildId).slice(0, 100);
    res.json(out);
  });

  /* ===== Static dashboard (in production / dist build) ===== */
  const dashboardDir = path.resolve(__dirname, "..", "dashboard-dist");
  if (existsSync(dashboardDir)) {
    app.use(express.static(dashboardDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(dashboardDir, "index.html"));
    });
  } else {
    app.get("/", (_req, res) => {
      res.type("html").send(`
        <!doctype html>
        <html><head><title>Hermes v1</title></head>
        <body style="font-family: system-ui; background:#111214; color:#fff; padding:40px;">
          <h2>🛠️ Dashboard non compilata</h2>
          <p>Esegui <code>npm run build:dashboard</code> oppure avvia il dev server con <code>npm run dev:dashboard</code>.</p>
        </body></html>
      `);
    });
  }

  return new Promise((resolve) => {
    const server = app.listen(DASHBOARD_PORT, () => {
      logger.info({ port: DASHBOARD_PORT, dashboardBuilt: existsSync(dashboardDir) }, "Web server (dashboard + API) avviato");
      resolve({ port: DASHBOARD_PORT });
    });
    server.on("error", (err) => {
      logger.error({ err }, "Errore avvio web server");
      resolve({ port: DASHBOARD_PORT });
    });
  });
}

function formatUptime(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s % 60}s`;
  return `${m}m ${s % 60}s`;
}
