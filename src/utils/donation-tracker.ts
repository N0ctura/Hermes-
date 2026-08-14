import type { Client, Guild, TextChannel } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { logger } from "./logger.js";
import { loadConfig, saveConfig, type DonationEntry } from "./storage.js";
import { fetchClanLedger, fetchClanMembers, type ClanGoldTransaction, type WvClanMember } from "./wolvesville.js";
import { resolveNotifyChannelsByTemple, templeKeyFromFlair } from "./temples.js";

const POLL_INTERVAL_MS = 20_000;
const MEMBERS_CACHE_TTL_MS = 10 * 60 * 1000;
const HISTORY_MAX_ENTRIES = 1000;

const DONATION_TYPES: ReadonlySet<ClanGoldTransaction["type"]> = new Set([
  "DONATE",
  "GOLD_DONATION",
  "GOLD_DEPOSIT",
]);

let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollInFlight = false;

let lastMembersFetchAt = 0;
let cachedMembers: WvClanMember[] = [];
let cachedMembersById: Map<string, WvClanMember> = new Map();

type DonationCurrency = "gold" | "gems";

interface DonationAmount {
  currency: DonationCurrency;
  amount: number;
}

/**
 * Determina se una transazione è una donazione e in quale valuta.
 * Il ledger Wolvesville usa lo stesso `type` ("DONATE") sia per le
 * donazioni in oro che per quelle in gemme: a distinguerle è quale dei
 * due campi (`gold` / `gems`) è > 0. Non ci aspettiamo che siano
 * entrambi valorizzati sulla stessa transazione, ma per sicurezza, se
 * lo fossero, diamo priorità all'oro.
 */
function getDonationAmount(tx: ClanGoldTransaction): DonationAmount | null {
  if (!DONATION_TYPES.has(tx.type)) return null;
  const gold = typeof tx.gold === "number" ? tx.gold : 0;
  const gems = typeof tx.gems === "number" ? tx.gems : 0;
  if (gold > 0) return { currency: "gold", amount: gold };
  if (gems > 0) return { currency: "gems", amount: gems };
  return null;
}

function isDonation(tx: ClanGoldTransaction): boolean {
  return getDonationAmount(tx) !== null;
}

const MAX_COMMENT_LENGTH = 300;

/** Ripulisce il commento della donazione prima di salvarlo/mostrarlo. */
function sanitizeComment(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return trimmed.length > MAX_COMMENT_LENGTH
    ? `${trimmed.slice(0, MAX_COMMENT_LENGTH - 1)}…`
    : trimmed;
}

async function refreshMembersCache(clanId: string, force = false): Promise<Map<string, WvClanMember>> {
  const now = Date.now();
  if (!force && cachedMembers.length > 0 && now - lastMembersFetchAt < MEMBERS_CACHE_TTL_MS) {
    return cachedMembersById;
  }
  try {
    const members = await fetchClanMembers(clanId);
    cachedMembers = members;
    cachedMembersById = new Map(members.map((m) => [m.playerId, m]));
    lastMembersFetchAt = now;
    logger.info({ count: members.length }, "donation-tracker: cache membri Wolvesville aggiornata");
  } catch (err) {
    logger.error({ err }, "donation-tracker: aggiornamento cache membri fallito");
  }
  return cachedMembersById;
}

function resolvePrimaryGuild(client: Client): Guild | null {
  const config = loadConfig();
  const ids = new Set<string>();
  for (const id of config.notifyChannelIds ?? []) ids.add(id);
  if (config.pollChannelId) ids.add(config.pollChannelId);
  if (config.donationTracking?.fallbackChannelId) ids.add(config.donationTracking.fallbackChannelId);

  for (const [, guild] of client.guilds.cache) {
    for (const id of ids) {
      if (guild.channels.cache.has(id)) return guild;
    }
  }
  return client.guilds.cache.first() ?? null;
}

async function resolveDonationChannel(
  client: Client,
  templeKey: string | null
): Promise<{ channel: TextChannel | null; templeResolved: string | null }> {
  const guild = resolvePrimaryGuild(client);
  const config = loadConfig();

  if (guild) {
    const notifyMap = resolveNotifyChannelsByTemple(guild);
    if (templeKey) {
      const direct = notifyMap.get(templeKey) ?? null;
      if (direct) return { channel: direct, templeResolved: templeKey };
    }
  }

  const fallbackId = config.donationTracking?.fallbackChannelId;
  if (fallbackId) {
    const ch = client.channels.cache.get(fallbackId);
    if (ch && ch.isTextBased()) return { channel: ch as TextChannel, templeResolved: templeKey };
  }

  if (guild && templeKey === null) {
    const anyNotify = (config.notifyChannelIds ?? []).find((id) => guild.channels.cache.has(id));
    if (anyNotify) {
      const ch = guild.channels.cache.get(anyNotify);
      if (ch && ch.isTextBased()) return { channel: ch as TextChannel, templeResolved: null };
    }
  }

  return { channel: null, templeResolved: templeKey };
}

const CURRENCY_META: Record<DonationCurrency, { emoji: string; label: string; color: number }> = {
  gold: { emoji: "💰", label: "monete", color: 0xf1c40f },
  gems: { emoji: "💎", label: "gemme", color: 0x3498db },
};

async function sendDonationNotification(
  channel: TextChannel,
  wvUsername: string,
  amount: number,
  currency: DonationCurrency,
  templeLabel: string | null,
  comment: string | undefined
): Promise<string | undefined> {
  const header = templeLabel ? `[${templeLabel}] ` : "";
  const meta = CURRENCY_META[currency];
  const amountText = `**${amount.toLocaleString("it-IT")}** ${meta.label}`;

  let description = `${meta.emoji} ${header}**${wvUsername}** ha appena donato ${amountText} al clan!`;
  if (comment) {
    // Il commento è testo libero inserito dal giocatore su Wolvesville: lo
    // trattiamo come dato, non come Markdown, per evitare che rompa l'embed.
    const safeComment = comment.replace(/`/g, "'");
    description += `\n💬 *"${safeComment}"*`;
  }

  const embed = new EmbedBuilder().setColor(meta.color).setDescription(description);

  try {
    const msg = await channel.send({ embeds: [embed] });
    return msg.id;
  } catch (err) {
    logger.error({ err, wvUsername, channelId: channel.id }, "donation-tracker: invio notifica fallito");
    return undefined;
  }
}

function transactionToDonationEntry(
  tx: ClanGoldTransaction,
  donation: DonationAmount,
  notificationMessageId?: string,
  notificationChannelId?: string
): DonationEntry | null {
  if (!tx.playerUsername) return null;
  return {
    id: tx.id,
    eventTime: tx.creationTime,
    processedAt: new Date().toISOString(),
    playerId: tx.playerId,
    playerUsername: tx.playerUsername,
    amount: donation.amount,
    currency: donation.currency,
    comment: sanitizeComment(tx.comment),
    rawAction: tx.type,
    notificationMessageId,
    notificationChannelId,
  };
}

async function pollOnce(client: Client): Promise<void> {
  if (pollInFlight) return;
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

    const [ledger, membersById] = await Promise.all([
      fetchClanLedger(clanId),
      refreshMembersCache(clanId),
    ]);
    if (ledger.length === 0) return;

    const existingIds = new Set((config.donationHistory ?? []).map((e) => e.id));
    const alreadyNotified = new Set(tracking.recentEventIds ?? []);

    const sorted = [...ledger].sort(
      (a, b) => new Date(a.creationTime).getTime() - new Date(b.creationTime).getTime()
    );

    const newHistory: DonationEntry[] = [];
    const newNotifiedIds: string[] = [];
    let newestEventAt = tracking.lastProcessedAt;

    for (const tx of sorted) {
      const txMs = new Date(tx.creationTime).getTime();
      if (Number.isNaN(txMs)) continue;
      if (newestEventAt && txMs < new Date(newestEventAt).getTime()) continue;

      if (!newestEventAt || txMs > new Date(newestEventAt).getTime()) {
        newestEventAt = tx.creationTime;
      }

      const donation = getDonationAmount(tx);
      if (!donation) continue;
      if (existingIds.has(tx.id)) continue;

      const wvUsername = tx.playerUsername;
      if (!wvUsername) {
        logger.warn({ tx }, "donation-tracker: transazione donazione senza username");
        continue;
      }

      const wvMember = tx.playerId ? membersById.get(tx.playerId) : undefined;
      const flair = wvMember?.flair;
      const templeKey = templeKeyFromFlair(flair);

      if (!wvMember) {
        logger.info(
          { wvUsername, playerId: tx.playerId },
          "donation-tracker: membro non trovato nella lista clan (flair non disponibile, temple via fallback)"
        );
      } else {
        logger.info(
          { wvUsername, flair, templeKey },
          "donation-tracker: flair -> tempio risolto"
        );
      }

      let notificationMessageId: string | undefined;
      let notificationChannelId: string | undefined;
      const comment = sanitizeComment(tx.comment);

      if (!alreadyNotified.has(tx.id)) {
        const { channel, templeResolved } = await resolveDonationChannel(client, templeKey);
        if (channel) {
          const templeLabel = templeResolved
            ? (TEMPLE_DISPLAY_NAME.get(templeResolved) ?? templeResolved.toUpperCase())
            : null;
          notificationMessageId = await sendDonationNotification(
            channel,
            wvUsername,
            donation.amount,
            donation.currency,
            templeLabel,
            comment
          );
          notificationChannelId = channel.id;
          logger.info(
            {
              wvUsername,
              amount: donation.amount,
              currency: donation.currency,
              hasComment: Boolean(comment),
              channelId: channel.id,
              temple: templeResolved,
            },
            "donation-tracker: notifica inviata"
          );
        } else {
          logger.warn(
            { wvUsername, templeKey },
            "donation-tracker: nessun canale tempio/fallback risolto, notifica saltata"
          );
        }
        newNotifiedIds.push(tx.id);
      }

      const entry = transactionToDonationEntry(tx, donation, notificationMessageId, notificationChannelId);
      if (entry) newHistory.push(entry);
    }

    if (newHistory.length === 0 && newestEventAt === tracking.lastProcessedAt) {
      return;
    }

    const mergedHistory = [...newHistory, ...(config.donationHistory ?? [])]
      .sort(
        (a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime()
      )
      .slice(0, HISTORY_MAX_ENTRIES);

    const mergedNotified = [...alreadyNotified, ...newNotifiedIds].slice(-500);

    saveConfig({
      ...config,
      donationHistory: mergedHistory,
      donationTracking: {
        ...tracking,
        lastProcessedAt: newestEventAt ?? tracking.lastProcessedAt,
        recentEventIds: mergedNotified,
      },
    });
  } catch (err) {
    logger.error({ err }, "donation-tracker: errore durante il polling");
  } finally {
    pollInFlight = false;
  }
}

const TEMPLE_DISPLAY_NAME = new Map<string, string>([
  ["rinascita", "Rinascita"],
  ["abisso", "Abissi"],
  ["eclissi", "Eclissi"],
  ["folgori", "Folgori"],
]);

export function startDonationTracker(client: Client): void {
  if (pollTimer !== null) return;
  logger.info("donation-tracker: avviato (polling ogni 20s via /ledger, routing per flair Wolvesville)");
  pollTimer = setInterval(() => void pollOnce(client), POLL_INTERVAL_MS);
  void pollOnce(client);
}

export function stopDonationTracker(): void {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
    logger.info("donation-tracker: fermato");
  }
}
