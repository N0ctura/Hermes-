import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import { logger } from "./logger.js";
import { loadConfig, saveConfig, DEFAULT_JOIN_REQUEST_MESSAGE_TEMPLATE } from "./storage.js";
import { fetchClanLog, fetchPlayerByUsername, JOIN_REQUEST_LOG_ACTION } from "./wolvesville.js";
import { generateProfileCard } from "./profile-card.js";
const POLL_INTERVAL_MS = 30_000;
const HISTORY_MAX_ENTRIES = 500;
const RECENT_IDS_MAX = 300;
let pollTimer = null;
let pollInFlight = false;
/**
 * Le entry del log Wolvesville non hanno un `id` univoco: costruiamo un
 * pseudo-id combinando timestamp + username, sufficiente per deduplicare
 * (due richieste diverse dello stesso utente nello stesso millisecondo
 * sono impossibili nella pratica).
 */
function pseudoId(entry, username) {
    return `${entry.creationTime}|${username}`;
}
function requesterUsername(entry) {
    return entry.playerUsername || entry.targetPlayerUsername || undefined;
}
function requesterPlayerId(entry) {
    return entry.playerId || entry.targetPlayerId || undefined;
}
function buildMessageContent(template, username, mentionRoleIds) {
    const rolesText = (mentionRoleIds ?? []).filter(Boolean).map((id) => `<@&${id}>`).join(" ");
    const base = template && template.trim() ? template : DEFAULT_JOIN_REQUEST_MESSAGE_TEMPLATE;
    return base.replace(/\{ROLES\}/g, rolesText).replace(/\{USERNAME\}/g, username).trim();
}
async function buildProfileCardAttachment(username, guildId) {
    try {
        const player = await fetchPlayerByUsername(username);
        if (!player) {
            // Nessun match esatto (es. username con maiuscole diverse o giocatore
            // non trovabile tramite ricerca pubblica): mandiamo comunque la
            // notifica testuale, solo senza scheda.
            return null;
        }
        // Carica la config della profile card per questo server
        const cfg = loadConfig();
        const profileCardConfig = cfg.profileCardConfigs?.find((pc) => pc.guildId === guildId)?.card;
        const p = player;
        const stats = player.gameStats;
        const statsValues = stats ? Object.values(stats) : [];
        const statsHidden = !stats || statsValues.some((value) => typeof value === "number" && value < 0);
        const totalWins = stats?.totalWinCount ?? 0;
        const totalLosses = stats?.totalLoseCount ?? 0;
        const totalTies = stats?.totalTieCount ?? 0;
        const gamesPlayed = totalWins + totalLosses + totalTies;
        const villageWins = stats?.villageWinCount ?? 0;
        const wolfWins = stats?.werewolfWinCount ?? 0;
        const winRate = gamesPlayed > 0 ? ((totalWins / gamesPlayed) * 100).toFixed(1) : null;
        const avatarRaw = p.equippedAvatar;
        const avatarUrl = typeof avatarRaw === "string"
            ? avatarRaw
            : avatarRaw?.imageUrl ?? avatarRaw?.url;
        const profileIconUrl = p.profileIconId
            ? `https://cdn.wolvesville.com/profileIcons/${p.profileIconId}.png`
            : undefined;
        const cardBuffer = await generateProfileCard({
            username: player.username,
            level: player.level,
            personalMessage: player.personalMessage,
            avatarUrl,
            gamesPlayed,
            totalWins,
            villageWins,
            wolfWins,
            winRate,
            rosesReceived: p.receivedRosesCount,
            rosesSent: p.sentRosesCount,
            statsHidden,
        }, profileCardConfig);
        const fileName = `recluta_${player.username}.png`;
        const attachment = new AttachmentBuilder(cardBuffer, { name: fileName });
        const embed = new EmbedBuilder()
            .setColor(0x8b0000)
            .setTitle(`🆕 Nuova richiesta d'ingresso — ${player.username}`)
            .setImage(`attachment://${fileName}`);
        if (profileIconUrl)
            embed.setThumbnail(profileIconUrl);
        if (player.personalMessage)
            embed.setDescription(`*"${player.personalMessage}"*`);
        embed.addFields({ name: "🆔 ID", value: `\`${player.id}\``, inline: false });
        return { attachment, embed };
    }
    catch (err) {
        logger.error({ err, username }, "join-request-tracker: generazione scheda giocatore fallita");
        return null;
    }
}
async function pollOnce(client) {
    if (pollInFlight)
        return;
    pollInFlight = true;
    try {
        const config = loadConfig();
        const guildConfigs = (config.joinRequestConfigs ?? []).filter((c) => c.enabled && c.channelId);
        if (guildConfigs.length === 0)
            return;
        const clanId = process.env["WOLVESVILLE_CLAN_ID"];
        if (!clanId) {
            logger.warn("join-request-tracker: WOLVESVILLE_CLAN_ID non impostato, salto il giro");
            return;
        }
        const logs = await fetchClanLog(clanId).catch((err) => {
            logger.error({ err }, "join-request-tracker: fetchClanLog fallita");
            return [];
        });
        if (logs.length === 0)
            return;
        const joinEntries = logs.filter((e) => e.action === JOIN_REQUEST_LOG_ACTION);
        if (joinEntries.length === 0)
            return;
        const tracking = config.joinRequestTracking ?? {};
        const alreadyNotified = new Set(tracking.recentEventIds ?? []);
        const lastProcessedAt = tracking.lastProcessedAt;
        // Prima attivazione in assoluto (nessun cursore, nessuno storico
        // notificato): NON dobbiamo notificare tutte le richieste passate
        // presenti nel log, solo sincronizzare il cursore da qui in avanti.
        const isFirstRun = !lastProcessedAt && alreadyNotified.size === 0;
        const sorted = [...joinEntries].sort((a, b) => new Date(a.creationTime).getTime() - new Date(b.creationTime).getTime());
        const newHistory = [];
        const newNotifiedIds = [];
        let newestEventAt = lastProcessedAt;
        for (const entry of sorted) {
            const entryMs = new Date(entry.creationTime).getTime();
            if (Number.isNaN(entryMs))
                continue;
            const username = requesterUsername(entry);
            if (!username) {
                logger.warn({ entry }, "join-request-tracker: entry senza username del richiedente");
                continue;
            }
            const id = pseudoId(entry, username);
            if (lastProcessedAt && entryMs < new Date(lastProcessedAt).getTime())
                continue;
            if (alreadyNotified.has(id))
                continue;
            if (!newestEventAt || entryMs > new Date(newestEventAt).getTime()) {
                newestEventAt = entry.creationTime;
            }
            if (isFirstRun) {
                // Sincronizza silenziosamente: segna come già processato senza
                // inviare alcuna notifica per lo storico pregresso.
                newNotifiedIds.push(id);
                newHistory.push({
                    id,
                    eventTime: entry.creationTime,
                    processedAt: new Date().toISOString(),
                    playerId: requesterPlayerId(entry),
                    playerUsername: username,
                });
                continue;
            }
            let notificationMessageId;
            let notificationChannelId;
            for (const guildConfig of guildConfigs) {
                const channel = client.channels.cache.get(guildConfig.channelId);
                if (!channel || !channel.isTextBased()) {
                    logger.warn({ guildId: guildConfig.guildId, channelId: guildConfig.channelId }, "join-request-tracker: canale configurato non trovato o non testuale");
                    continue;
                }
                // Carica la card specifica per questo guild (può avere una config diversa per ogni server)
                const card = await buildProfileCardAttachment(username, guildConfig.guildId);
                const content = buildMessageContent(guildConfig.messageTemplate, username, guildConfig.mentionRoleIds);
                try {
                    const sendPayload = {
                        content,
                        allowedMentions: { roles: guildConfig.mentionRoleIds ?? [] },
                    };
                    if (card) {
                        sendPayload.embeds = [card.embed];
                        sendPayload.files = [card.attachment];
                    }
                    const msg = await channel.send(sendPayload);
                    notificationMessageId = msg.id;
                    notificationChannelId = channel.id;
                    logger.info({ username, guildId: guildConfig.guildId, channelId: channel.id }, "join-request-tracker: notifica inviata");
                }
                catch (err) {
                    logger.error({ err, username, guildId: guildConfig.guildId, channelId: guildConfig.channelId }, "join-request-tracker: invio notifica fallito");
                }
            }
            newNotifiedIds.push(id);
            newHistory.push({
                id,
                eventTime: entry.creationTime,
                processedAt: new Date().toISOString(),
                playerId: requesterPlayerId(entry),
                playerUsername: username,
                notificationMessageId,
                notificationChannelId,
            });
        }
        if (newHistory.length === 0 && newestEventAt === lastProcessedAt) {
            return;
        }
        if (isFirstRun && newHistory.length > 0) {
            logger.info({ syncedCount: newHistory.length }, "join-request-tracker: primo avvio — cursore sincronizzato senza notificare lo storico pregresso");
        }
        const mergedHistory = [...newHistory, ...(config.joinRequestHistory ?? [])].slice(0, HISTORY_MAX_ENTRIES);
        const mergedNotified = [...alreadyNotified, ...newNotifiedIds].slice(-RECENT_IDS_MAX);
        saveConfig({
            ...config,
            joinRequestHistory: mergedHistory,
            joinRequestTracking: {
                lastProcessedAt: newestEventAt ?? lastProcessedAt,
                recentEventIds: mergedNotified,
            },
        });
    }
    catch (err) {
        logger.error({ err }, "join-request-tracker: errore durante il polling");
    }
    finally {
        pollInFlight = false;
    }
}
export function startJoinRequestTracker(client) {
    if (pollTimer !== null)
        return;
    logger.info("join-request-tracker: avviato (polling ogni 30s via /clans/{id}/logs)");
    pollTimer = setInterval(() => void pollOnce(client), POLL_INTERVAL_MS);
    void pollOnce(client);
}
export function stopJoinRequestTracker() {
    if (pollTimer !== null) {
        clearInterval(pollTimer);
        pollTimer = null;
        logger.info("join-request-tracker: fermato");
    }
}
//# sourceMappingURL=join-request-tracker.js.map