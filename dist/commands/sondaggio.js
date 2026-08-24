import { SlashCommandBuilder, AttachmentBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags, } from "discord.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, saveConfig } from "../utils/storage.js";
import { fetchAvailableQuests } from "../utils/wolvesville.js";
import { addNumberBadge } from "../utils/image-badge.js";
import { normalize } from "../utils/normalize.js";
import { logger } from "../utils/logger.js";
const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(process.cwd(), "assets");
export const data = new SlashCommandBuilder()
    .setName("sondaggio")
    .setDescription("Crea un sondaggio con le missioni disponibili del clan")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) => opt.setName("data_fine").setDescription("Data fine sondaggio (es: 30 Giugno 2025) — ignorato se il timer automatico è attivo").setRequired(false));
export const VOTE_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
function questLabel(quest, globalIdx) {
    const emoji = VOTE_EMOJIS[globalIdx] ?? `${globalIdx + 1}`;
    return `${emoji} — ${quest.purchasableWithGems ? "Gem Quest" : "Gold Quest"}`;
}
export async function publishPoll(pollChannel, quests, dataFine, closesAt, hideRimescolo, pingRoleId) {
    const sorted = [
        ...quests.filter((q) => q.purchasableWithGems),
        ...quests.filter((q) => !q.purchasableWithGems),
    ];
    const labels = sorted.map((q, i) => questLabel(q, i));
    const imageUrls = sorted.map((q) => q.promoImageUrl);
    const badgeBuffers = await Promise.all(sorted.map((quest, idx) => addNumberBadge(quest.promoImageUrl, idx + 1)));
    const imageFiles = badgeBuffers.map((buf, idx) => new AttachmentBuilder(buf, { name: `mission_${idx + 1}.png` }));
    const caption = sorted
        .map((q, i) => `${q.purchasableWithGems ? "💎" : "🪙"} ${VOTE_EMOJIS[i] ?? i + 1}`)
        .join("  ·  ");
    const missionOptions = sorted.map((quest, idx) => new StringSelectMenuOptionBuilder()
        .setLabel(`${quest.purchasableWithGems ? "Gemme" : "Monete"} — Missione ${idx + 1}`)
        .setEmoji(VOTE_EMOJIS[idx] ?? `${idx + 1}`)
        .setValue(String(idx)));
    const allOptions = [...missionOptions];
    if (!hideRimescolo) {
        const rimescoloOption = new StringSelectMenuOptionBuilder()
            .setLabel("Rimescolo — voglio missioni diverse")
            .setEmoji("🔀")
            .setValue("rimescolo");
        allOptions.push(rimescoloOption);
    }
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("vote_mission")
        .setPlaceholder("Seleziona la missione che vuoi fare...")
        .addOptions(allOptions);
    const selectRow = new ActionRowBuilder().addComponents(selectMenu);
    let timerLine = "";
    if (closesAt) {
        const unixTs = Math.floor(closesAt.getTime() / 1000);
        timerLine = `⏳ Votazioni aperte — chiudono <t:${unixTs}:R> (<t:${unixTs}:f>)`;
    }
    else if (dataFine) {
        timerLine = `⏳ Sondaggio aperto fino al **${dataFine}**`;
    }
    // Il ruolo membri (impostato una sola volta da /impostazioni) viene taggato qui in
    // testa al messaggio, così la notifica del sondaggio arriva davvero a tutti — non
    // solo a chi ha già visto il canale sondaggi.
    const roleMentionLine = pingRoleId ? `<@&${pingRoleId}>` : "";
    const introLines = [
        roleMentionLine,
        `🐺 **Ecco le missioni di questa settimana!**`,
        `Usa il menu qui sotto per votare. Puoi cambiare voto in qualsiasi momento.`,
        timerLine,
        ``,
        caption,
    ].filter((l, i, arr) => l !== `` || arr[i - 1] !== ``);
    const pollMsg = await pollChannel.send({
        content: introLines.filter(Boolean).join("\n"),
        files: imageFiles,
        components: [selectRow],
        allowedMentions: pingRoleId ? { roles: [pingRoleId] } : undefined,
    });
    const summaryLines = [
        `📊 **Conteggio voti (live)** — votanti: **0**`,
        `ℹ️ Ancora nessun voto registrato.`,
    ];
    const summaryMsg = await pollChannel.send({ content: summaryLines.join("\n") });
    return {
        introMessageId: pollMsg.id,
        messageIds: [pollMsg.id, summaryMsg.id],
        questLabels: labels,
        questImageUrls: imageUrls,
    };
}
export async function execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const guild = interaction.guild;
    if (!guild) {
        await interaction.editReply({ content: "❌ Questo comando funziona solo in un server." });
        return;
    }
    const config = loadConfig();
    if (!config.pollChannelId && config.pollChannelName) {
        const oldPollChannel = guild.channels.cache.find((c) => c.isTextBased() && !c.isThread() && c.name === config.pollChannelName);
        if (oldPollChannel) {
            config.pollChannelId = oldPollChannel.id;
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
    if (!config.pollChannelId) {
        await interaction.editReply({ content: "❌ Il canale sondaggi non è configurato. Usa `/impostazioni`." });
        return;
    }
    const clanId = process.env["WOLVESVILLE_CLAN_ID"] ?? config.clanId ?? "";
    if (!clanId) {
        await interaction.editReply({ content: "❌ ID clan Wolvesville non configurato." });
        return;
    }
    let quests;
    try {
        quests = await fetchAvailableQuests(clanId);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.startsWith("401_UNAUTHORIZED")) {
            await interaction.editReply({
                content: "❌ **Bot non autorizzato nel clan Wolvesville!** (non è Discord)\n\n" +
                    "Vai nel GIOCO Wolvesville → **Clan → Impostazioni → Bot**\n" +
                    "e aggiungi/autorizza il bot Hermes al clan.\n\n" +
                    "Wolvesville API Key usata: `" + (process.env["WOLVESVILLE_API_KEY"]?.slice(0, 10) ?? "non impostata") + "...`",
            });
        }
        else {
            await interaction.editReply({ content: `❌ Errore API Wolvesville: ${msg}` });
        }
        return;
    }
    if (quests.length === 0) {
        await interaction.editReply({ content: "ℹ️ Nessuna missione disponibile al momento." });
        return;
    }
    const pollChannel = guild.channels.cache.get(config.pollChannelId);
    if (!pollChannel) {
        await interaction.editReply({
            content: `❌ Canale non trovato. Usa \`/impostazioni\`.`,
        });
        return;
    }
    const durationHours = config.pollDurationHours ?? 0;
    const closesAtDate = durationHours > 0
        ? new Date(Date.now() + durationHours * 60 * 60 * 1000)
        : undefined;
    const dataFine = interaction.options.getString("data_fine") ?? "";
    const hideRimescolo = config.lastPollWasShuffled ?? false;
    if (hideRimescolo) {
        logger.info("🔀 Bottone rimescolo NASCOSTO in questo sondaggio (lastPollWasShuffled=true). Resetto il flag per i sondaggi successivi.");
    }
    else {
        logger.info("Bottone rimescolo VISIBILE nel prossimo sondaggio.");
    }
    config.lastPollWasShuffled = false;
    if (!config.pingRoleId && config.pingRoleName) {
        const oldRole = guild.roles.cache.find((r) => r.name === config.pingRoleName);
        if (oldRole) {
            config.pingRoleId = oldRole.id;
        }
    }
    const { introMessageId, messageIds, questLabels, questImageUrls } = await publishPoll(pollChannel, quests, dataFine, closesAtDate, hideRimescolo, config.pingRoleId);
    const closesAt = closesAtDate?.toISOString();
    config.activePoll = {
        channelId: pollChannel.id,
        introMessageId,
        messageIds,
        summaryMessageId: messageIds[1],
        questCount: quests.length,
        questLabels,
        questImageUrls,
        createdAt: new Date().toISOString(),
        closesAt,
        votes: {},
    };
    saveConfig(config);
    if (closesAt) {
        const { schedulePollClose } = await import("../utils/poll-timer.js");
        schedulePollClose(interaction.client, closesAt);
    }
    const roleByNorm = new Map(guild.roles.cache
        .filter((r) => r.name !== "@everyone")
        .map((r) => [normalize(r.name), r]));
    const notifyResults = [];
    for (const channelId of config.notifyChannelIds) {
        if (channelId === config.pollChannelId)
            continue;
        const notifyChannel = guild.channels.cache.get(channelId);
        if (!notifyChannel) {
            notifyResults.push(`⚠️ Canale non trovato`);
            continue;
        }
        const matchingRole = roleByNorm.get(normalize(notifyChannel.name));
        const roleMention = matchingRole ? `<@&${matchingRole.id}>` : undefined;
        const allowedRoles = matchingRole ? [matchingRole.id] : [];
        const embed = new EmbedBuilder()
            .setTitle("🐺 Sono usciti i nuovi sondaggi missione!")
            .setDescription(`Vai in <#${config.pollChannelId}>, vota la missione che vuoi fare e comunicalo al clan! 💪`)
            .setColor(0x8b0000);
        await notifyChannel.send({
            content: roleMention,
            embeds: [embed],
            allowedMentions: { roles: allowedRoles },
        });
        notifyResults.push(`✅ <#${channelId}>${matchingRole ? ` (ping @${matchingRole.name})` : ""}`);
    }
    const replyLines = [
        `✅ **Sondaggio pubblicato!**`,
        `📊 Canale: <#${config.pollChannelId}>`,
        `🎯 Missioni: **${quests.length}**`,
        closesAt
            ? `⏱️ Chiusura automatica: **${new Date(closesAt).toLocaleString("it-IT")}**`
            : `⏱️ Nessun timer impostato`,
        hideRimescolo
            ? `🔀 **Rimescolo NASCOSTO** (l'ultima volta ha vinto il rimescolo — non puoi farne 2 di fila!)`
            : `🔀 Rimescolo abilitato`,
        config.pingRoleId
            ? `📣 Ruolo taggato nel messaggio: <@&${config.pingRoleId}>`
            : `📣 Nessun ruolo taggato (impostalo con \`/impostazioni\`)`,
    ];
    if (notifyResults.length > 0)
        replyLines.push("", "**Notifiche:**", ...notifyResults);
    await interaction.editReply({ content: replyLines.join("\n") });
}
//# sourceMappingURL=sondaggio.js.map