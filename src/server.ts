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
  type GuildJoinRequestConfig,
  type GuildProfileCardConfig,
  type GuildBirthdayConfig,
  type GuildDailyConfig,
  type BirthdayEntry,
  type BotConfig,
  type AutoResponseConfig,
} from "./utils/storage.js";
import { logger } from "./utils/logger.js";
import { refreshBirthdayListMessage } from "./utils/birthday-list.js";
import { fetchClanById, fetchClanMembers, fetchClanLog, fetchClanLedger } from "./utils/wolvesville.js";
import { getGuildActivity } from "./utils/activity-tracker.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DASHBOARD_PASSWORD = process.env["DASHBOARD_PASSWORD"] || "";
const DASHBOARD_PORT = Number(process.env["DASHBOARD_PORT"] || process.env["PORT"] || 3000);
const DASHBOARD_TOKEN_TTL_MS = 8 * 60 * 60 * 1000;
const startedAt = new Date();

const tokens = new Map<string, number>();

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
  if (token) {
    const expiresAt = tokens.get(token);
    if (expiresAt && expiresAt > Date.now()) {
      req.__hermesAuth = true;
      return next();
    }
    tokens.delete(token);
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
    tokens.set(tok, Date.now() + DASHBOARD_TOKEN_TTL_MS);
    return res.json({ ok: true, token: tok });
  });

  app.use("/api", authMiddleware);

  /* ===== Status ===== */
  app.get("/api/status", (_req, res) => {
    const cfg = loadConfig();
    const anyWL = cfg.welcomeLeaveConfigs ?? [];
    const anyTts = cfg.ttsConfigs ?? [];
    const anyLogs = cfg.logsConfigs ?? [];
    const anyJoinRequests = cfg.joinRequestConfigs ?? [];
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
        joinRequests: anyJoinRequests.some((c) => c.enabled),
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

  app.get("/api/guilds/:id/members", async (req, res) => {
    try {
      const guild = discordClient.guilds.cache.get(req.params.id);
      if (!guild) return res.status(404).json({ error: "Guild non trovata" });
      const members = await guild.members.fetch().catch(() => null);
      const out: Array<{ id: string; username: string; displayName: string; avatarUrl: string }> = [];
      members?.forEach((m) => {
        if (m.user.bot) return;
        out.push({
          id: m.id,
          username: m.user.username,
          displayName: m.displayName,
          avatarUrl: m.user.displayAvatarURL({ extension: "png", size: 64 }),
        });
      });
      out.sort((a, b) => a.displayName.localeCompare(b.displayName, "it"));
      res.json(out);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/guilds/:id/activity", async (req, res) => {
    const guild = discordClient.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: "Guild non trovata" });
    const activity = getGuildActivity(req.params.id);
    const members = await guild.members.fetch().catch(() => null);
    const names = new Map<string, { username: string; displayName: string; avatarUrl: string }>();
    members?.forEach((member) => {
      if (!member.user.bot) names.set(member.id, {
        username: member.user.username,
        displayName: member.displayName,
        avatarUrl: member.user.displayAvatarURL({ extension: "png", size: 64 }),
      });
    });
    res.json({
      days: activity.days,
      users: activity.users.map((user) => ({ ...user, ...names.get(user.userId) })),
    });
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
  function ensureGuildJoinRequests(
    arr: undefined | GuildJoinRequestConfig[],
    guildId: string,
    guildName: string
  ): GuildJoinRequestConfig {
    const found = arr?.find((c) => c.guildId === guildId);
    if (found) return found;
    return { guildId, guildName, enabled: false, mentionRoleIds: [] };
  }

  function ensureGuildProfileCard(
    arr: undefined | GuildProfileCardConfig[],
    guildId: string,
    guildName: string
  ): GuildProfileCardConfig {
    const found = arr?.find((c) => c.guildId === guildId);
    if (found) return found;
    return { guildId, guildName };
  }

  function ensureGuildDaily(
    arr: undefined | GuildDailyConfig[],
    guildId: string,
    guildName: string
  ): GuildDailyConfig {
    const found = arr?.find((c) => c.guildId === guildId);
    if (found) return found;
    return {
      guildId,
      guildName,
      enabled: false,
      dailyTime: "20:00",
      hostMessage: "📅 Daily pronto: organizzate le lobby e preparatevi per le missioni.",
      missionsPrompt: "Rispondi a questo messaggio con la tua missione e il tuo nome, ad esempio: @Tuonome: farm 20 boss",
      participants: [],
    };
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

  /* ===== Module: Richieste clan (join requests) ===== */
  app.get("/api/module/join-requests/:guildId", async (req, res) => {
    const cfg = loadConfig();
    const gn = await getGuildName(req.params.guildId);
    res.json(ensureGuildJoinRequests(cfg.joinRequestConfigs, req.params.guildId, gn));
  });

  app.put("/api/module/join-requests/:guildId", async (req, res) => {
    const guildId = req.params.guildId;
    const gn = await getGuildName(guildId);
    const incoming = (req.body || {}) as Partial<GuildJoinRequestConfig>;
    const updated = patchConfig((c) => {
      const arr = Array.isArray(c.joinRequestConfigs) ? [...c.joinRequestConfigs] : [];
      const idx = arr.findIndex((x) => x.guildId === guildId);
      const current = idx >= 0 ? arr[idx] : ensureGuildJoinRequests(arr, guildId, gn);
      const next: GuildJoinRequestConfig = { ...current, guildId, guildName: gn, ...incoming };
      if (idx >= 0) arr[idx] = next;
      else arr.push(next);
      c.joinRequestConfigs = arr;
    });
    res.json(ensureGuildJoinRequests(updated.joinRequestConfigs, guildId, gn));
  });

  app.get("/api/clan/join-requests", (_req, res) => {
    const cfg = loadConfig();
    res.json({ history: (cfg.joinRequestHistory ?? []).slice(0, 300) });
  });

  /* ===== Module: Profile Card ===== */
  app.get("/api/module/profile-card/:guildId", async (req, res) => {
    const cfg = loadConfig();
    const gn = await getGuildName(req.params.guildId);
    res.json(ensureGuildProfileCard(cfg.profileCardConfigs, req.params.guildId, gn));
  });

  app.put("/api/module/profile-card/:guildId", async (req, res) => {
    const guildId = req.params.guildId;
    const gn = await getGuildName(guildId);
    const incoming = (req.body || {}) as Partial<GuildProfileCardConfig>;
    const updated = patchConfig((c) => {
      const arr = Array.isArray(c.profileCardConfigs) ? [...c.profileCardConfigs] : [];
      const idx = arr.findIndex((x) => x.guildId === guildId);
      const current = idx >= 0 ? arr[idx] : ensureGuildProfileCard(arr, guildId, gn);
      const next: GuildProfileCardConfig = { ...current, guildId, guildName: gn, ...incoming };
      if (idx >= 0) arr[idx] = next;
      else arr.push(next);
      c.profileCardConfigs = arr;
    });
    res.json(ensureGuildProfileCard(updated.profileCardConfigs, guildId, gn));
  });

  /* ===== Module: Daily ===== */
  app.get("/api/module/daily/:guildId", async (req, res) => {
    const cfg = loadConfig();
    const gn = await getGuildName(req.params.guildId);
    res.json(ensureGuildDaily(cfg.dailyConfigs, req.params.guildId, gn));
  });

  app.put("/api/module/daily/:guildId", async (req, res) => {
    const guildId = req.params.guildId;
    const gn = await getGuildName(guildId);
    const incoming = (req.body || {}) as Partial<GuildDailyConfig>;
    const updated = patchConfig((c) => {
      const arr = Array.isArray(c.dailyConfigs) ? [...c.dailyConfigs] : [];
      const idx = arr.findIndex((x) => x.guildId === guildId);
      const current = idx >= 0 ? arr[idx] : ensureGuildDaily(arr, guildId, gn);
      const next: GuildDailyConfig = {
        ...current,
        guildId,
        guildName: gn,
        ...incoming,
        participants: Array.isArray(incoming.participants) ? incoming.participants : current.participants ?? [],
      };
      if (idx >= 0) arr[idx] = next;
      else arr.push(next);
      c.dailyConfigs = arr;
    });
    res.json(ensureGuildDaily(updated.dailyConfigs, guildId, gn));
  });

  /* ===== Module: Birthday (lista + banner di mezzanotte) ===== */
  function ensureGuildBirthday(
    arr: undefined | GuildBirthdayConfig[],
    guildId: string,
    guildName: string
  ): GuildBirthdayConfig {
    const found = arr?.find((c) => c.guildId === guildId);
    if (found) return found;
    return { guildId, guildName, birthdays: [] };
  }

  app.get("/api/module/birthday/:guildId", async (req, res) => {
    const cfg = loadConfig();
    const gn = await getGuildName(req.params.guildId);
    res.json(ensureGuildBirthday(cfg.birthdayConfigs, req.params.guildId, gn));
  });

  app.put("/api/module/birthday/:guildId", async (req, res) => {
    const guildId = req.params.guildId;
    const gn = await getGuildName(guildId);
    const incoming = (req.body || {}) as Partial<GuildBirthdayConfig>;
    // La lista compleanni si gestisce solo con gli endpoint /entries dedicati, mai in blocco qui.
    delete (incoming as any).birthdays;
    const updated = patchConfig((c) => {
      const arr = Array.isArray(c.birthdayConfigs) ? [...c.birthdayConfigs] : [];
      const idx = arr.findIndex((x) => x.guildId === guildId);
      const current = idx >= 0 ? arr[idx] : ensureGuildBirthday(arr, guildId, gn);
      const next: GuildBirthdayConfig = { ...current, guildId, guildName: gn, ...incoming };
      if (idx >= 0) arr[idx] = next;
      else arr.push(next);
      c.birthdayConfigs = arr;
    });
    const result = ensureGuildBirthday(updated.birthdayConfigs, guildId, gn);
    // Se è stato impostato/cambiato il canale, pubblica o ricrea subito la lista lì.
    void refreshBirthdayListMessage(discordClient, guildId);
    res.json(result);
  });

  app.post("/api/module/birthday/:guildId/entries", async (req, res) => {
    const guildId = req.params.guildId;
    const gn = await getGuildName(guildId);
    const { userId, username, day, month } = (req.body || {}) as Partial<BirthdayEntry>;

    if (!userId || !day || !month) {
      return res.status(400).json({ error: "userId, day e month sono obbligatori" });
    }
    const maxDay = month >= 1 && month <= 12 ? new Date(Date.UTC(2000, month, 0)).getUTCDate() : 0;
    if (!Number.isInteger(day) || !Number.isInteger(month) || day < 1 || day > maxDay || month < 1 || month > 12) {
      return res.status(400).json({ error: "Data non valida" });
    }

    const updated = patchConfig((c) => {
      const arr = Array.isArray(c.birthdayConfigs) ? [...c.birthdayConfigs] : [];
      const idx = arr.findIndex((x) => x.guildId === guildId);
      const current = idx >= 0 ? { ...arr[idx] } : ensureGuildBirthday(arr, guildId, gn);
      const birthdays = [...(current.birthdays || [])];
      const entryIdx = birthdays.findIndex((b) => b.userId === userId);
      const entry: BirthdayEntry = {
        userId,
        username: username || "Sconosciuto",
        day,
        month,
        addedAt: new Date().toISOString(),
      };
      if (entryIdx >= 0) birthdays[entryIdx] = entry;
      else birthdays.push(entry);
      current.birthdays = birthdays;
      if (idx >= 0) arr[idx] = current;
      else arr.push(current);
      c.birthdayConfigs = arr;
    });

    void refreshBirthdayListMessage(discordClient, guildId);
    res.json(ensureGuildBirthday(updated.birthdayConfigs, guildId, gn));
  });

  app.delete("/api/module/birthday/:guildId/entries/:userId", async (req, res) => {
    const { guildId, userId } = req.params;
    const gn = await getGuildName(guildId);
    const updated = patchConfig((c) => {
      const arr = Array.isArray(c.birthdayConfigs) ? [...c.birthdayConfigs] : [];
      const idx = arr.findIndex((x) => x.guildId === guildId);
      if (idx < 0) return;
      const current = { ...arr[idx] };
      current.birthdays = (current.birthdays || []).filter((b) => b.userId !== userId);
      arr[idx] = current;
      c.birthdayConfigs = arr;
    });

    void refreshBirthdayListMessage(discordClient, guildId);
    res.json(ensureGuildBirthday(updated.birthdayConfigs, guildId, gn));
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
        daysOfWeek: Array.isArray(incoming.daysOfWeek) ? incoming.daysOfWeek : undefined,
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

  /* ===== Auto responses ===== */
  app.get("/api/auto-responses/:guildId", (req, res) => {
    const cfg = loadConfig();
    res.json((cfg.autoResponses || []).filter((response) => response.guildId === req.params.guildId));
  });

  app.put("/api/auto-responses/:guildId", (req, res) => {
    const guildId = req.params.guildId;
    const incoming = (req.body || {}) as Partial<AutoResponseConfig>;
    if (!incoming.id || !incoming.trigger?.trim()) return res.status(400).json({ error: "id e trigger required" });
    const updated = patchConfig((c) => {
      const arr = Array.isArray(c.autoResponses) ? [...c.autoResponses] : [];
      const idx = arr.findIndex((response) => response.id === incoming.id && response.guildId === guildId);
      const base: AutoResponseConfig = {
        id: incoming.id,
        guildId,
        trigger: incoming.trigger!.trim(),
        response: incoming.response ?? "",
        isRegex: incoming.isRegex ?? false,
        enabled: incoming.enabled ?? true,
        createdAt: incoming.createdAt ?? new Date().toISOString(),
      };
      if (idx >= 0) arr[idx] = { ...arr[idx], ...base };
      else arr.push(base);
      c.autoResponses = arr;
    });
    res.json(updated.autoResponses?.find((response) => response.id === incoming.id && response.guildId === guildId));
  });

  app.delete("/api/auto-responses/:guildId/:id", (req, res) => {
    patchConfig((c) => {
      c.autoResponses = (c.autoResponses || []).filter(
        (response) => !(response.guildId === req.params.guildId && response.id === req.params.id)
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
      const clan = await fetchClanById(clanId).catch((e) => {
        logger.error({ err: e }, "clan/overview: fetchClanById fallita");
        return null;
      });
      const members = await fetchClanMembers(clanId).catch((e) => {
        logger.error({ err: e }, "clan/overview: fetchClanMembers fallita");
        throw e;
      });
      const logs = await fetchClanLog(clanId).catch((e) => {
        logger.error({ err: e }, "clan/overview: fetchClanLog fallita");
        return [];
      });
      const ledger = await fetchClanLedger(clanId).catch((e) => {
        logger.error({ err: e }, "clan/overview: fetchClanLedger fallita");
        return [];
      });
      const cfg = loadConfig();
      const donations = (cfg.donationHistory ?? []).slice(0, 500);
      res.json({ clan, members, logs, ledger, donations });
    } catch (e: any) {
      logger.error({ err: e }, "clan/overview: errore generale");
      res.status(500).json({ error: e?.message || "Errore recupero dati clan" });
    }
  });

  app.get("/api/clan/donations", (_req, res) => {
    const cfg = loadConfig();
    const history = cfg.donationHistory ?? [];

    // Entry salvate prima dell'introduzione del tracciamento gemme non hanno
    // `currency`: le trattiamo come oro per compatibilità con lo storico.
    const currencyOf = (e: { currency?: "gold" | "gems" }) => e.currency ?? "gold";

    const totalGold = history.reduce((sum, e) => (currencyOf(e) === "gold" ? sum + (e.amount || 0) : sum), 0);
    const totalGems = history.reduce((sum, e) => (currencyOf(e) === "gems" ? sum + (e.amount || 0) : sum), 0);

    const donorMap = new Map<
      string,
      { username: string; totalGold: number; totalGems: number; count: number; lastTime: string }
    >();
    for (const d of history) {
      const key = d.playerId || d.playerUsername;
      const cur =
        donorMap.get(key) || { username: d.playerUsername, totalGold: 0, totalGems: 0, count: 0, lastTime: d.eventTime };
      if (currencyOf(d) === "gems") {
        cur.totalGems += d.amount || 0;
      } else {
        cur.totalGold += d.amount || 0;
      }
      cur.count += 1;
      if (new Date(d.eventTime).getTime() > new Date(cur.lastTime).getTime()) cur.lastTime = d.eventTime;
      donorMap.set(key, cur);
    }
    const leaderboard = Array.from(donorMap.values())
      .sort((a, b) => b.totalGold - a.totalGold)
      .slice(0, 100);
    res.json({
      entries: history.slice(0, 500),
      totalDonated: totalGold, // alias retrocompatibile (= totalGoldDonated)
      totalGoldDonated: totalGold,
      totalGemsDonated: totalGems,
      totalCount: history.length,
      leaderboard,
    });
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
