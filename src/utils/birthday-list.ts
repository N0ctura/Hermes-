import { type Client, EmbedBuilder, type TextChannel } from "discord.js";
import { loadConfig, saveConfig, type GuildBirthdayConfig } from "./storage.js";
import { logger } from "./logger.js";

const MONTH_NAMES_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

/** Azzurrino, come richiesto. */
const LIST_EMBED_COLOR = 0x5dade2;

/** Costruisce il corpo della lista: un'unica riga per ogni giorno, raggruppando chi condivide la stessa data. */
function buildBirthdayListBody(birthdays: GuildBirthdayConfig["birthdays"]): string {
  if (!birthdays || birthdays.length === 0) {
    return "Nessun compleanno registrato ancora! Sii il primo a usare **/add compleanno** 🎉";
  }

  const sorted = [...birthdays].sort((a, b) => (a.month - b.month) || (a.day - b.day));

  const lines: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    const { day, month } = sorted[i];
    const names: string[] = [];
    while (i < sorted.length && sorted[i].day === day && sorted[i].month === month) {
      names.push(sorted[i].username);
      i++;
    }
    lines.push(`**${MONTH_NAMES_IT[month - 1]} ${day}**: ${names.join(", ")}`);
  }

  let body = lines.join("\n");

  // Limite di sicurezza per la description dell'embed (max 4096 caratteri Discord).
  if (body.length > 3800) {
    body = body.slice(0, 3800) + `\n… e altri compleanni non mostrati (${sorted.length} totali)`;
  }

  return body;
}

export function buildBirthdayListEmbed(config: GuildBirthdayConfig): EmbedBuilder {
  const body = buildBirthdayListBody(config.birthdays);

  return new EmbedBuilder()
    .setColor(LIST_EMBED_COLOR)
    .setTitle("🎂 Lista Compleanni")
    .setDescription(
      "I compleanni vengono festeggiati nel giorno e mese indicati, in base al fuso orario del server.\n\n" +
        body
    )
    .setFooter({ text: "Usa /add compleanno se vuoi aggiungere il tuo! 🎉" });
}

/**
 * Crea o modifica in-place l'unico messaggio "Lista Compleanni" del server.
 * Va richiamata ogni volta che la lista cambia (aggiunta/rimozione compleanno,
 * cambio canale) così il messaggio resta sempre uno solo, sempre aggiornato.
 */
export async function refreshBirthdayListMessage(client: Client, guildId: string): Promise<void> {
  const cfg = loadConfig();
  const arr = cfg.birthdayConfigs || [];
  const idx = arr.findIndex((c) => c.guildId === guildId);
  if (idx < 0) return;

  const guildConfig = { ...arr[idx] };
  if (!guildConfig.channelId) return;

  let guild;
  try {
    guild = await client.guilds.fetch(guildId);
  } catch (err) {
    logger.error({ err, guildId }, "Birthday list: impossibile recuperare il server");
    return;
  }

  let channel: TextChannel | null = null;
  try {
    const ch = await guild.channels.fetch(guildConfig.channelId);
    if (ch?.isTextBased()) channel = ch as TextChannel;
  } catch (err) {
    logger.error({ err, guildId }, "Birthday list: canale non trovato");
    return;
  }
  if (!channel) return;

  const embed = buildBirthdayListEmbed(guildConfig);

  try {
    if (guildConfig.listMessageId) {
      const existing = await channel.messages.fetch(guildConfig.listMessageId).catch(() => null);
      if (existing) {
        await existing.edit({ embeds: [embed] });
        return;
      }
    }

    const sent = await channel.send({ embeds: [embed] });
    guildConfig.listMessageId = sent.id;
    const nextArr = [...arr];
    nextArr[idx] = guildConfig;
    saveConfig({ ...cfg, birthdayConfigs: nextArr });
  } catch (err) {
    logger.error({ err, guildId }, "Birthday list: impossibile inviare/modificare il messaggio");
  }
}
