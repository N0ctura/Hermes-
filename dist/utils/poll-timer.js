import { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, AttachmentBuilder, } from "discord.js";
import { logger } from "./logger.js";
import { loadConfig, saveConfig, getMessages } from "./storage.js";
import { normalize } from "./normalize.js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let activeTimer = null;
let safetyInterval = null;
let closeInProgress = false;
export function schedulePollClose(client, closesAt) {
    if (activeTimer !== null) {
        clearTimeout(activeTimer);
        activeTimer = null;
    }
    if (safetyInterval !== null) {
        clearInterval(safetyInterval);
        safetyInterval = null;
    }
    const msLeft = new Date(closesAt).getTime() - Date.now();
    if (msLeft <= 0) {
        void closePoll(client);
        return;
    }
    logger.info({ closesAt, msLeft }, "Timer sondaggio programmato");
    activeTimer = setTimeout(() => { activeTimer = null; void closePoll(client); }, msLeft);
    safetyInterval = setInterval(() => {
        const config = loadConfig();
        if (!config.activePoll?.closesAt)
            return;
        const nowMs = Date.now();
        const targetMs = new Date(config.activePoll.closesAt).getTime();
        if (nowMs >= targetMs) {
            logger.warn({ diffSec: Math.floor((nowMs - targetMs) / 1000) }, "Safety-net: sondaggio scaduto rilevato, avvio chiusura");
            void closePoll(client);
        }
    }, 30_000);
}
export function cancelPollTimer() {
    if (activeTimer !== null) {
        clearTimeout(activeTimer);
        activeTimer = null;
    }
    if (safetyInterval !== null) {
        clearInterval(safetyInterval);
        safetyInterval = null;
    }
    logger.info("Timer sondaggio annullato");
}
const RIMESCOLO_IDX = -1;
const EMBED_COLOR = 0x8b0000;
const EMBED_FIELD_MAX = 1000;
const FIXED_TIE_MESSAGE = "⚖️ **Pareggio!** Le missioni {missioni} hanno lo stesso numero di voti.\n" +
    "⏳ Attendete un **Co-Capo** per il verdetto finale.";
const RIMESCOLO_NAMES = ["rimescolo.jpeg", "rimescolo.png", "rimescolo.webp"];
const RIMESCOLO_ATTACHMENT_BASENAME = "rimescolo_img";
function findRimescoloFileRuntime() {
    const fallbacks = [];
    if (process.cwd())
        fallbacks.push(resolve(process.cwd(), "assets"));
    try {
        const here = fileURLToPath(import.meta.url);
        fallbacks.push(resolve(dirname(here), "..", "..", "assets"));
    }
    catch { }
    if (process.env["HERMES_ASSETS_DIR"])
        fallbacks.push(resolve(process.env["HERMES_ASSETS_DIR"]));
    for (const assetsDir of fallbacks) {
        for (const name of RIMESCOLO_NAMES) {
            const p = join(assetsDir, name);
            if (existsSync(p))
                return p;
        }
    }
    return null;
}
let _rimescoloCachedPath = undefined;
function getRimescoloPath() {
    if (_rimescoloCachedPath !== undefined)
        return _rimescoloCachedPath;
    _rimescoloCachedPath = findRimescoloFileRuntime();
    if (_rimescoloCachedPath) {
        logger.info({ path: _rimescoloCachedPath }, "✅ Immagine rimescolo caricata");
    }
    else {
        logger.warn("⚠️ Immagine rimescolo NON TROVATA in assets/ — alla vittoria rimescolo non ci sarà la foto. " +
            "Metti un file rimescolo.jpeg / .png / .webp in " + resolve(process.cwd(), "assets"));
    }
    return _rimescoloCachedPath;
}
function getRimescoloExt() {
    const p = getRimescoloPath();
    return p ? (p.split(".").pop()?.toLowerCase() ?? "jpeg") : "jpeg";
}
function getRimescoloAttachmentFullName() {
    return `${RIMESCOLO_ATTACHMENT_BASENAME}.${getRimescoloExt()}`;
}
function getRimescoloAttachmentUrl() {
    return `attachment://${getRimescoloAttachmentFullName()}`;
}
function hasRimescoloImage() {
    return !!getRimescoloPath();
}
function buildRimescoloAttachment() {
    const p = getRimescoloPath();
    if (!p)
        return null;
    try {
        const data = readFileSync(p);
        const att = new AttachmentBuilder(data, { name: getRimescoloAttachmentFullName() });
        logger.info({ name: getRimescoloAttachmentFullName(), bytes: data.length }, "📎 Allegato rimescolo creato");
        return att;
    }
    catch (err) {
        logger.warn({ err, path: p }, "Impossibile caricare immagine rimescolo");
        return null;
    }
}
function countVotes(poll) {
    const votes = poll.votes ?? {};
    const voteCounts = new Array(poll.questCount + 1).fill(0);
    const voterMap = new Map();
    for (const [userId, v] of Object.entries(votes)) {
        const questIdx = v;
        if (questIdx === RIMESCOLO_IDX) {
            voteCounts[poll.questCount] = (voteCounts[poll.questCount] ?? 0) + 1;
            voterMap.set(userId, "🔀 Rimescolo");
        }
        else if (questIdx >= 0 && questIdx < poll.questCount) {
            voteCounts[questIdx] = (voteCounts[questIdx] ?? 0) + 1;
            voterMap.set(userId, poll.questLabels[questIdx] ?? `Missione ${questIdx + 1}`);
        }
    }
    const maxVotes = Math.max(...voteCounts, 0);
    if (maxVotes === 0)
        return { winners: [], maxVotes: 0, voterMap };
    const winners = [];
    for (let i = 0; i <= poll.questCount; i++) {
        if ((voteCounts[i] ?? 0) === maxVotes) {
            winners.push(i === poll.questCount ? RIMESCOLO_IDX : i);
        }
    }
    return { winners, maxVotes, voterMap };
}
async function disableSelectMenu(client, channelId, messageId) {
    try {
        const channel = await client.channels.fetch(channelId);
        const msg = await channel.messages.fetch(messageId);
        const disabledMenu = new StringSelectMenuBuilder()
            .setCustomId("vote_mission")
            .setPlaceholder("Sondaggio chiuso")
            .setDisabled(true)
            .addOptions([{ label: "Sondaggio chiuso", value: "closed" }]);
        await msg.edit({ components: [new ActionRowBuilder().addComponents(disabledMenu)] });
    }
    catch (err) {
        logger.warn({ err }, "Impossibile disabilitare il select menu");
    }
}
function applyTemplate(template, vars) {
    return Object.entries(vars).reduce((str, [k, v]) => str.replaceAll(`{${k}}`, v), template);
}
function splitFieldValue(lines, maxLen = EMBED_FIELD_MAX) {
    const chunks = [];
    let current = "";
    for (const line of lines) {
        if (current.length + line.length + 1 > maxLen) {
            if (current)
                chunks.push(current);
            current = line;
        }
        else {
            current += (current ? "\n" : "") + line;
        }
    }
    if (current)
        chunks.push(current);
    return chunks.length > 0 ? chunks : ["—"];
}
async function sendTempleSummaries(guild, voterMap, pollChannelId, resultText, winnerImageUrl, extraFiles) {
    logger.info("Avvio riepilogo templi...");
    // Ciclo di Retry con Backoff per il fetch dei membri (evita il blocco GatewayRateLimitError)
    let membersFetched = false;
    let attempts = 0;
    const maxAttempts = 3;
    while (!membersFetched && attempts < maxAttempts) {
        try {
            attempts++;
            logger.info({ attempt: attempts }, "Tentativo di fetch dei membri della gilda...");
            await guild.members.fetch();
            membersFetched = true;
            logger.info({ memberCount: guild.members.cache.size }, "✅ Membri fetchati con successo");
        }
        catch (err) {
            if (err.name === "GatewayRateLimitError" || err.message?.includes("rate limited")) {
                // Estrae il tempo di retry fornito da Discord (in secondi) o imposta 2.5s di default
                const retryAfter = err.data?.retry_after ?? 2.5;
                const waitTime = (retryAfter * 1000) + 200;
                logger.warn({ waitTime, attempt: attempts }, `Rate limit rilevato dall'Opcode 8. Attesa in corso...`);
                await new Promise((resolve) => setTimeout(resolve, waitTime));
            }
            else {
                logger.error({ err }, `Errore imprevisto al tentativo ${attempts} di fetch membri`);
                if (attempts >= maxAttempts)
                    break;
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }
    }
    // Se dopo 3 tentativi fallisce, non facciamo "return" ma proviamo a usare la cache locale esistente
    if (!membersFetched) {
        logger.warn({ cacheSize: guild.members.cache.size }, "⚠️ Fetch fallito definitivamente. Tento il calcolo templi usando la cache parziale dei membri.");
    }
    const config = loadConfig();
    const templeRoleNorms = new Set((config.templeRoleNames ?? []).map((n) => normalize(n)));
    const hasTempleFilter = templeRoleNorms.size > 0;
    const channelByNorm = new Map();
    for (const [, ch] of guild.channels.cache) {
        if (ch.isTextBased() && !ch.isThread() && ch.id !== pollChannelId) {
            channelByNorm.set(normalize(ch.name), ch);
        }
    }
    const roles = guild.roles.cache.filter((r) => r.name !== "@everyone");
    let matchCount = 0;
    for (const [, role] of roles) {
        const normRole = normalize(role.name);
        if (hasTempleFilter && !templeRoleNorms.has(normRole))
            continue;
        const templeChannel = channelByNorm.get(normRole);
        if (!templeChannel || role.members.size === 0)
            continue;
        matchCount++;
        logger.info({ role: role.name, channel: templeChannel.name, members: role.members.size }, "Match trovato, invio riepilogo");
        const voted = [];
        const notVoted = [];
        for (const [memberId, member] of role.members) {
            const label = voterMap.get(memberId);
            if (label)
                voted.push(`${member.displayName} → ${label}`);
            else
                notVoted.push(member.displayName);
        }
        const embed = new EmbedBuilder()
            .setTitle("🏁 I sondaggi sono chiusi!")
            .setDescription(`${resultText}\n\n` +
            `💬 **Questa è la missione che ha vinto il sondaggio — chi partecipa?**`)
            .setColor(EMBED_COLOR)
            .setTimestamp()
            .setFooter({ text: role.name });
        if (winnerImageUrl) {
            embed.setImage(winnerImageUrl);
        }
        const votedChunks = splitFieldValue(voted.map((l) => `• ${l}`));
        embed.addFields({
            name: `✅ Hanno votato (${voted.length})`,
            value: votedChunks[0] ?? "—",
            inline: false,
        });
        for (const extra of votedChunks.slice(1)) {
            embed.addFields({ name: "\u200b", value: extra, inline: false });
        }
        if (notVoted.length > 0) {
            const notVotedChunks = splitFieldValue(notVoted.map((l) => `• ${l}`));
            embed.addFields({
                name: `❌ Non hanno votato (${notVoted.length})`,
                value: notVotedChunks[0] ?? "—",
                inline: false,
            });
            for (const extra of notVotedChunks.slice(1)) {
                embed.addFields({ name: "\u200b", value: extra, inline: false });
            }
        }
        else {
            embed.addFields({
                name: "🎉 Tutti hanno votato!",
                value: "Ottimo lavoro al clan! 💪",
                inline: false,
            });
        }
        try {
            const payload = { embeds: [embed] };
            if (extraFiles?.length)
                payload.files = extraFiles;
            await templeChannel.send(payload);
            logger.info({ role: role.name, channel: templeChannel.name, voted: voted.length, notVoted: notVoted.length }, "Riepilogo inviato");
        }
        catch (err) {
            logger.warn({ err, role: role.name, channel: templeChannel.name }, "Impossibile inviare riepilogo nel canale tempio — controlla i permessi del bot");
        }
    }
    if (matchCount === 0) {
        logger.warn("Nessun match ruolo↔canale trovato. Usa /debug-templi per diagnosticare.");
    }
    else {
        logger.info({ matchCount }, "Riepilogo templi completato");
    }
}
export async function closePoll(client) {
    if (closeInProgress) {
        logger.debug("closePoll già in esecuzione — salto");
        return;
    }
    closeInProgress = true;
    try {
        const config = loadConfig();
        const poll = config.activePoll;
        if (!poll) {
            logger.warn("closePoll chiamato ma nessun sondaggio attivo");
            return;
        }
        logger.info({ poll }, "Chiusura sondaggio in corso...");
        const { winners, maxVotes, voterMap } = countVotes(poll);
        const messages = getMessages(config);
        if (poll.messageIds[0]) {
            await disableSelectMenu(client, poll.channelId, poll.messageIds[0]);
        }
        let resultText;
        let winnerImageUrl;
        let tieMissions;
        const wasRimescolo = winners.length === 1 && winners[0] === RIMESCOLO_IDX;
        logger.info({ winners, wasRimescolo, questImageUrls: poll.questImageUrls }, "Dettagli vincitore");
        if (winners.length === 0) {
            resultText = messages.nessunVoto;
        }
        else if (wasRimescolo) {
            resultText = `🔀 **Il clan ha votato per il Rimescolo!** Ricordati di rimescolare le missioni manualmente nel gioco, poi pubblica un nuovo sondaggio.`;
            const hasImg = hasRimescoloImage();
            logger.info({
                wasRimescolo,
                hasImage: hasImg,
                imagePath: getRimescoloPath(),
                attachmentName: hasImg ? getRimescoloAttachmentFullName() : null,
                attachmentUrl: hasImg ? getRimescoloAttachmentUrl() : null,
            }, "🎯 Vincitore RIMESCOLO — stato foto");
            if (hasImg) {
                winnerImageUrl = getRimescoloAttachmentUrl();
            }
        }
        else if (winners.length > 1) {
            const tiedLabels = winners
                .map((i) => (i === RIMESCOLO_IDX ? "🔀 Rimescolo" : (poll.questLabels[i] ?? `Missione ${i + 1}`)))
                .join(", ");
            resultText = applyTemplate(FIXED_TIE_MESSAGE, { missioni: tiedLabels });
            const missionIdxs = winners.filter((i) => i !== RIMESCOLO_IDX && i >= 0 && i < poll.questCount);
            if (missionIdxs.length === 2) {
                const a = missionIdxs[0];
                const b = missionIdxs[1];
                const aUrl = poll.questImageUrls?.[a];
                const bUrl = poll.questImageUrls?.[b];
                if (aUrl && bUrl) {
                    tieMissions = [
                        { idx: a, label: poll.questLabels[a] ?? `Missione ${a + 1}`, imageUrl: aUrl },
                        { idx: b, label: poll.questLabels[b] ?? `Missione ${b + 1}`, imageUrl: bUrl },
                    ];
                }
            }
        }
        else {
            const winnerIdx = winners[0];
            const winnerLabel = poll.questLabels[winnerIdx] ?? `Missione ${winnerIdx + 1}`;
            resultText = applyTemplate(messages.missioneVinta, { missione: winnerLabel });
            winnerImageUrl = poll.questImageUrls?.[winnerIdx];
            logger.info({ winnerIdx, winnerImageUrl }, "URL immagine vincitore");
        }
        const rimescoloAttachment = wasRimescolo ? buildRimescoloAttachment() : null;
        const extraFiles = [];
        if (rimescoloAttachment)
            extraFiles.push(rimescoloAttachment);
        for (const [, guild] of client.guilds.cache) {
            const pollChannel = guild.channels.cache.get(poll.channelId);
            if (!pollChannel)
                continue;
            if (!config.pingRoleId && config.pingRoleName) {
                const oldRole = guild.roles.cache.find((r) => r.name === config.pingRoleName);
                if (oldRole) {
                    config.pingRoleId = oldRole.id;
                }
            }
            if (!config.notifyChannelIds.length && config.notifyChannelNames?.length) {
                config.notifyChannelIds = config.notifyChannelNames
                    .map(name => {
                    const ch = guild.channels.cache.find((c) => c.isTextBased() && !c.isThread() && c.name === name);
                    return ch?.id;
                })
                    .filter((id) => !!id);
            }
            let roleMention = "";
            let roleId = "";
            if (config.pingRoleId) {
                const role = guild.roles.cache.get(config.pingRoleId);
                if (role) {
                    roleId = role.id;
                    roleMention = `<@&${role.id}>`;
                }
            }
            const closeEmbed = new EmbedBuilder()
                .setTitle("🏁 I sondaggi sono chiusi!")
                .setDescription(resultText)
                .setColor(EMBED_COLOR)
                .setTimestamp();
            if (winnerImageUrl) {
                closeEmbed.setThumbnail(winnerImageUrl);
            }
            await pollChannel.send({
                content: roleMention || undefined,
                embeds: [
                    closeEmbed,
                    ...(tieMissions
                        ? tieMissions.map((m, i) => new EmbedBuilder()
                            .setTitle(`⚖️ Missione in pareggio ${i + 1}/2`)
                            .setDescription(m.label)
                            .setImage(m.imageUrl)
                            .setColor(EMBED_COLOR))
                        : []),
                ],
                files: extraFiles.length ? extraFiles : undefined,
                allowedMentions: { roles: roleId ? [roleId] : [] },
            });
            await sendTempleSummaries(guild, voterMap, poll.channelId, resultText, winnerImageUrl, extraFiles);
        }
        config.activePoll = undefined;
        config.lastPollWasShuffled = wasRimescolo;
        saveConfig(config);
        cancelPollTimer();
        if (wasRimescolo) {
            logger.info("🔀 FLAG ATTIVATO: lastPollWasShuffled = true — nel PROSSIMO sondaggio nasconderò il bottone rimescolo");
        }
        else {
            logger.info("lastPollWasShuffled = false — nel prossimo sondaggio il bottone rimescolo ci sarà");
        }
        logger.info({ winners, maxVotes, wasRimescolo }, "Sondaggio chiuso");
    }
    finally {
        closeInProgress = false;
    }
}
//# sourceMappingURL=poll-timer.js.map