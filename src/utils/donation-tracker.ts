import type { Client, TextChannel } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { logger } from "./logger.js";
import { loadConfig, saveConfig } from "./storage.js";
import { fetchClanLog, type WvClanLogEntry } from "./wolvesville.js";
import { normalize } from "./normalize.js";
import { resolveTempleKeyForMember, resolveTempleRoles, TEMPLE_DEFINITIONS } from "./temples.js";

const POLL_INTERVAL_MS = 60_000;
const EMBED_COLOR = 0xf1c40f; // oro

// ⚠️ Segnaposto — va confermato osservando il payload reale (vedi wolvesville.ts).
// Metti qui il/i valore/i esatto/i che identifica una donazione di monete,
// per DISTINGUERLA dall'evento XP collegato che la accompagna.
const DONATION_EVENT_TYPES = ["CLAN_GOLD_DONATED", "GOLD_DONATION"];

let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollInFlight = false;

function isDonationEvent(entry: WvClanLogEntry): boolean {
  // Confronto case-insensitive sul campo `action` (confermato empiricamente,
  // vedi wolvesville.ts). I valori in DONATION_EVENT_TYPES restano un
  // segnaposto: non è ancora stata osservata una donazione reale nel log.
  const rawAction = String(entry.action ?? "").toUpperCase();
  return DONATION_EVENT_TYPES.some((t) => rawAction === t.toUpperCase());
}

/**
 * L'API non restituisce un id univoco per entry: lo sintetizziamo per poter
 * deduplicare tra un giro di polling e l'altro.
 */
function syntheticEntryId(entry: WvClanLogEntry): string {
  return `${entry.creationTime}|${entry.action}|${entry.playerId ?? ""}|${entry.targetPlayerId ?? ""}`;
}

function extractDonationAmount(entry: WvClanLogEntry): number | null {
  // ⚠️ Segnaposto — prova i nomi di campo più plausibili; sostituisci con
  // quello reale una volta ispezionato il payload.
  const candidates = ["amount", "goldAmount", "gold", "value"];
  for (const key of candidates) {
    const v = entry[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

function extractDonorUsername(entry: WvClanLogEntry): string | null {
  return entry.playerUsername ?? null;
}

/**
 * Trova il GuildMember Discord corrispondente a uno username Wolvesville,
 * confrontando in modo case/accent-insensitive sia lo username Discord
 * sia il displayName (nickname del server), riusando la stessa funzione
 * normalize() già usata per il match dei nomi canale in debug-templi.ts.
 */
function findDiscordMemberByWolvesvilleName(client: Client, wvUsername: string) {
  const target = normalize(wvUsername);
  if (!target) return null;

  for (const [, guild] of client.guilds.cache) {
    const match = guild.members.cache.find(
      (m) => normalize(m.user.username) === target || normalize(m.displayName) === target
    );
    if (match) return match;
  }
  return null;
}

async function resolveTargetChannel(client: Client, donorMember: ReturnType<typeof findDiscordMemberByWolvesvilleName>) {
  const config = loadConfig();

  if (donorMember) {
    const templeKey = resolveTempleKeyForMember(donorMember);
    if (templeKey) {
      const templeRoles = resolveTempleRoles(donorMember.guild);
      const templeRole = templeRoles.get(templeKey);
      const definition = TEMPLE_DEFINITIONS.find((t) => t.key === templeKey);
      // Il canale del tempio si ricava per nome-canale normalizzato che
      // combacia con l'alias del tempio — stesso approccio di debug-templi.ts.
      if (definition) {
        const channel = donorMember.guild.channels.cache.find(
          (ch) =>
            ch.isTextBased() &&
            !ch.isThread() &&
            definition.aliases.some((alias) => normalize(ch.name).includes(normalize(alias)))
        ) as TextChannel | undefined;
        if (channel) return channel;
      }
      void templeRole; // riservato per usi futuri (es. menzionare il ruolo)
    }
  }

  const fallbackId = config.donationTracking?.fallbackChannelId;
  if (fallbackId) {
    const channel = client.channels.cache.get(fallbackId);
    if (channel && channel.isTextBased()) return channel as TextChannel;
  }

  return null;
}

async function sendDonationNotification(
  client: Client,
  channel: TextChannel,
  wvUsername: string,
  amount: number | null,
  donorMember: ReturnType<typeof findDiscordMemberByWolvesvilleName>
) {
  const mention = donorMember ? `<@${donorMember.id}>` : `**${wvUsername}**`;
  const amountText = amount !== null ? `**${amount.toLocaleString("it-IT")}** monete` : "monete";

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setDescription(`💰 ${mention} ha appena donato ${amountText} al clan!`);

  try {
    await channel.send({ embeds: [embed] });
  } catch (err) {
    logger.error({ err, wvUsername, channelId: channel.id }, "donation-tracker: invio notifica fallito");
  }
}

async function pollOnce(client: Client): Promise<void> {
  if (pollInFlight) return; // evita sovrapposizioni se un giro precedente è ancora in corso
  pollInFlight = true;

  try {
    const config = loadConfig();
    const tracking = config.donationTracking;
    if (!tracking?.enabled) return;

    const clanId = process.env["WOLVESVILLE_CLAN_ID"];
    if (!clanId) {
      logger.warn("donation-tracker: WOLVESVILLE_CLAN_ID non impostato, salto il giro");
      return;
    }

    const since = tracking.lastProcessedAt;
    const entries = await fetchClanLog(clanId, since);

    if (entries.length === 0) return;

    // Ordina per timestamp crescente così processiamo in ordine cronologico
    // e l'ultimo processato diventa correttamente il "più recente".
    const sorted = [...entries].sort(
      (a, b) => new Date(a.creationTime).getTime() - new Date(b.creationTime).getTime()
    );

    const alreadySeen = new Set(tracking.recentEventIds ?? []);
    const sinceMs = since ? new Date(since).getTime() : 0;

    let newestProcessedAt = since;
    const newSeenIds: string[] = [];

    for (const entry of sorted) {
      const entryMs = new Date(entry.creationTime).getTime();
      if (Number.isNaN(entryMs) || entryMs < sinceMs) continue;
      const entryId = syntheticEntryId(entry);
      if (alreadySeen.has(entryId)) continue;

      newSeenIds.push(entryId);
      newestProcessedAt = entry.creationTime;

      if (!isDonationEvent(entry)) continue;

      const wvUsername = extractDonorUsername(entry);
      if (!wvUsername) {
        logger.warn({ entry }, "donation-tracker: evento donazione senza username giocatore");
        continue;
      }

      const amount = extractDonationAmount(entry);
      const donorMember = findDiscordMemberByWolvesvilleName(client, wvUsername);
      if (!donorMember) {
        logger.info({ wvUsername }, "donation-tracker: nessun membro Discord corrispondente trovato");
      }

      const channel = await resolveTargetChannel(client, donorMember);
      if (!channel) {
        logger.warn({ wvUsername }, "donation-tracker: nessun canale tempio/fallback risolto, notifica saltata");
        continue;
      }

      await sendDonationNotification(client, channel, wvUsername, amount, donorMember);
      logger.info({ wvUsername, amount, channelId: channel.id }, "donation-tracker: notifica inviata");
    }

    // Manteniamo solo gli ID dell'ultimo minuto di finestra per evitare che
    // l'array cresca indefinitamente, ma coprendo il caso limite in cui due
    // giri consecutivi vedano lo stesso istante di confine.
    saveConfig({
      ...config,
      donationTracking: {
        ...tracking,
        lastProcessedAt: newestProcessedAt,
        recentEventIds: [...alreadySeen, ...newSeenIds].slice(-500),
      },
    });
  } catch (err) {
    logger.error({ err }, "donation-tracker: errore durante il polling");
  } finally {
    pollInFlight = false;
  }
}

export function startDonationTracker(client: Client): void {
  if (pollTimer !== null) return;
  logger.info("donation-tracker: avviato (polling ogni 60s)");
  pollTimer = setInterval(() => void pollOnce(client), POLL_INTERVAL_MS);
  void pollOnce(client); // primo giro immediato, non aspettare 60s
}

export function stopDonationTracker(): void {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
    logger.info("donation-tracker: fermato");
  }
}
