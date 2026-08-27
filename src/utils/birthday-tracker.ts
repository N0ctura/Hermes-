import { type Client, type TextChannel } from "discord.js";
import { logger } from "./logger.js";
import { loadConfig, saveConfig, DEFAULT_BIRTHDAY_MESSAGE_TEMPLATE, type GuildBirthdayConfig } from "./storage.js";
import { generateBirthdayAttachment, substituteBirthdayPlaceholders } from "./birthday-card.js";

const CHECK_INTERVAL_MS = 60_000; // controlla ogni minuto, scatta al cambio di giornata
const TIMEZONE = "Europe/Rome";

/** Data odierna (YYYY-MM-DD) nel fuso italiano, indipendentemente da dove gira il server. */
function todayKeyRome(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

function romeDayMonth(): { day: number; month: number; year: number } {
  const [year, month, day] = todayKeyRome().split("-").map((n) => parseInt(n, 10));
  return { day, month, year };
}

async function celebrateGuild(
  client: Client,
  guildConfig: GuildBirthdayConfig,
  day: number,
  month: number,
  year: number
): Promise<{ completed: boolean; celebrated: boolean }> {
  if (!guildConfig.enabled || !guildConfig.channelId) return { completed: true, celebrated: false };

  const todaysBirthdays = (guildConfig.birthdays || []).filter(
    (b) => b.day === day && b.month === month && b.lastCelebratedYear !== year
  );
  if (todaysBirthdays.length === 0) return { completed: true, celebrated: false };

  let guild;
  try {
    guild = await client.guilds.fetch(guildConfig.guildId);
  } catch (err) {
    logger.error({ err, guildId: guildConfig.guildId }, "Birthday: impossibile recuperare il server");
    return { completed: false, celebrated: false };
  }

  let channel: TextChannel | null = null;
  try {
    const ch = await guild.channels.fetch(guildConfig.channelId);
    if (ch?.isTextBased()) channel = ch as TextChannel;
  } catch (err) {
    logger.error({ err, guildId: guildConfig.guildId }, "Birthday: canale non trovato");
    return { completed: false, celebrated: false };
  }
  if (!channel) return { completed: false, celebrated: false };

  let anyCelebrated = false;

  for (const entry of todaysBirthdays) {
    try {
      const member = await guild.members.fetch(entry.userId).catch(() => null);
      if (!member) {
        // L'utente non è più nel server: segna comunque come festeggiato per l'anno
        // così non si ritenta all'infinito, ma non invia nulla.
        entry.lastCelebratedYear = year;
        anyCelebrated = true;
        continue;
      }

      const avatarUrl = member.user.displayAvatarURL({ extension: "png", size: 256 });
      const cardData = {
        username: member.displayName,
        avatarUrl,
        serverName: guild.name,
        day: entry.day,
        month: entry.month,
      };

      const attachment = await generateBirthdayAttachment(cardData, guildConfig.card);
      const template = guildConfig.messageTemplate || DEFAULT_BIRTHDAY_MESSAGE_TEMPLATE;
      // Nel messaggio Discord (a differenza del canvas) {USERNAME} diventa una menzione reale.
      const wishText = substituteBirthdayPlaceholders(
        template.replaceAll("{USERNAME}", `<@${entry.userId}>`),
        cardData
      );

      // Ruoli da avvisare (es. "Membri"), impostabili dalla dashboard, così l'augurio
      // arriva a tutti e non solo a chi ha già il canale compleanni sott'occhio.
      const configuredRoleIds = guildConfig.mentionRoleIds || [];
      if (configuredRoleIds.length > 0) {
        await guild.roles.fetch().catch((err) => {
          logger.warn({ err, guildId: guildConfig.guildId }, "Compleanno: impossibile aggiornare la cache dei ruoli");
        });
      }
      const validRoleIds = configuredRoleIds.filter((id) => guild.roles.cache.has(id));
      const roleMentions = validRoleIds.map((id) => `<@&${id}>`).join(" ");
      const content = roleMentions ? `${roleMentions}\n${wishText}` : wishText;

      await channel.send({
        content,
        files: [attachment],
        allowedMentions: { roles: validRoleIds },
      });

      entry.lastCelebratedYear = year;
      anyCelebrated = true;
      logger.info({ guildId: guildConfig.guildId, userId: entry.userId }, "Auguri di compleanno inviati");
    } catch (err) {
      logger.error({ err, guildId: guildConfig.guildId, userId: entry.userId }, "Errore invio auguri di compleanno");
    }
  }

  return { completed: true, celebrated: anyCelebrated };
}

async function runBirthdayCheck(client: Client): Promise<boolean> {
  const { day, month, year } = romeDayMonth();
  const config = loadConfig();
  const guildConfigs = config.birthdayConfigs || [];
  if (guildConfigs.length === 0) return;

  let changed = false;
  let completed = true;
  for (const gc of guildConfigs) {
    const result = await celebrateGuild(client, gc, day, month, year);
    if (result.celebrated) changed = true;
    if (!result.completed) completed = false;
  }

  if (changed) {
    saveConfig({ ...loadConfig(), birthdayConfigs: guildConfigs });
  }
  return completed;
}

export function startBirthdayScheduler(client: Client): void {
  const today = todayKeyRome();
  const config = loadConfig();

  // Se il bot riparte in un giorno diverso dall'ultimo controllo, recupera subito gli auguri di oggi.
  if (config.birthdayLastCheckedDate !== today) {
    void runBirthdayCheck(client).then((completed) => {
      if (completed) saveConfig({ ...loadConfig(), birthdayLastCheckedDate: today });
    });
  }

  setInterval(() => {
    const key = todayKeyRome();
    const cfg = loadConfig();
    if (cfg.birthdayLastCheckedDate === key) return;

    void runBirthdayCheck(client).then((completed) => {
      if (completed) saveConfig({ ...loadConfig(), birthdayLastCheckedDate: key });
    });
  }, CHECK_INTERVAL_MS);

  logger.info("Scheduler compleanni avviato (controllo ogni minuto, fuso Europe/Rome)");
}
