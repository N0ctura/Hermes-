process.on("unhandledRejection", (reason: unknown, promise: Promise<unknown>) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    const code = (err as any)?.code;
    const name = err?.name;
    const msg = err?.message ?? "";
    const isNet =
        name === "ConnectTimeoutError" ||
        name === "TimeoutError" ||
        msg.includes("handshake") ||
        msg.includes("timeout") ||
        msg.includes("socket") ||
        msg.includes("ENOTFOUND") ||
        msg.includes("ETIMEDOUT") ||
        msg.includes("ECONN") ||
        code?.startsWith("UND_");
    if (isNet) {
        logger.warn({ code, name, msg: msg.slice(0, 300) }, "unhandledRejection: problema di rete (non fatale, attendi riconnessione)");
    } else {
        logger.error({ err, stack: err.stack?.slice(0, 800) }, "unhandledRejection: errore non gestito (non arresto il processo)");
    }
});

process.on("uncaughtException", (err: Error) => {
    const msg = err?.message ?? "";
    const isNet = msg.includes("handshake") || msg.includes("timeout") || msg.includes("socket") || msg.includes("ECONN");
    if (isNet) {
        logger.warn({ msg: msg.slice(0, 300) }, "uncaughtException: problema di rete (non fatale)");
    } else {
        logger.error({ err, stack: err.stack?.slice(0, 800) }, "uncaughtException: errore grave (non arresto il processo)");
    }
});

import { handleMessageForTTS, handleVoiceStateUpdate } from "./utils/tts.js";
import {
    Client,
    GatewayIntentBits,
    Partials,
    REST,
    Routes,
    Collection,
    AttachmentBuilder,
    EmbedBuilder,
    MessageFlags,
    type Interaction,
    type Message,
    type TextChannel,
    type GuildMember,
    type VoiceState,
    type ButtonInteraction,
} from "discord.js";
import { logger } from "./utils/logger.js";
import * as sondaggioCommand from "./commands/sondaggio.js";
import * as impostazioniCommand from "./commands/impostazioni.js";
import * as debugTempliCommand from "./commands/debug-templi.js";
import * as fineCommand from "./commands/fine.js";
import * as messaggioCondivisoCommand from "./commands/messaggio-condiviso.js";
import * as roseCommand from "./commands/rose.js";
import * as familyCommand from "./commands/family.js";
import * as donazioniCommand from "./commands/donazioni.js";
import * as addCommand from "./commands/add.js";
import * as entraCommand from "./commands/entra.js";
import * as esciCommand from "./commands/esci.js";
import * as entrataAutomaticaCommand from "./commands/entrata-automatica.js";
import { BOT_CONFIG } from "./utils/config.js";
import { loadConfig, saveConfig, initStorage, type ActivePoll, type DeletedModifiedAttachment, type DeletedModifiedLog, type GuildLogsConfig } from "./utils/storage.js";
import { closePoll, schedulePollClose } from "./utils/poll-timer.js";
import { fetchPlayerByUsername, fetchClanById } from "./utils/wolvesville.js";
import { generateProfileCard } from "./utils/profile-card.js";
import { handleMemberJoin, handleMemberLeave } from "./utils/welcome-leave.js";
import { setDiscordClient } from "./utils/discord-api.js";
import { startWebServer } from "./server.js";
import { startDonationTracker } from "./utils/donation-tracker.js";
import { startJoinRequestTracker } from "./utils/join-request-tracker.js";
import { startBirthdayScheduler } from "./utils/birthday-tracker.js";
import { trackMessageActivity, trackVoiceState } from "./utils/activity-tracker.js";

type BotCommand =
    | typeof sondaggioCommand
    | typeof impostazioniCommand
    | typeof debugTempliCommand
    | typeof fineCommand
    | typeof messaggioCondivisoCommand
    | typeof roseCommand
    | typeof familyCommand
    | typeof donazioniCommand
    | typeof addCommand
    | typeof entraCommand
    | typeof esciCommand
    | typeof entrataAutomaticaCommand;

const commands = new Collection<string, BotCommand>();
commands.set(sondaggioCommand.data.name, sondaggioCommand);
commands.set(impostazioniCommand.data.name, impostazioniCommand);
commands.set(debugTempliCommand.data.name, debugTempliCommand);
commands.set(fineCommand.data.name, fineCommand);
commands.set(messaggioCondivisoCommand.data.name, messaggioCondivisoCommand);
commands.set(roseCommand.data.name, roseCommand);
commands.set(familyCommand.data.name, familyCommand);
commands.set(donazioniCommand.data.name, donazioniCommand);
commands.set(addCommand.data.name, addCommand);
commands.set(entraCommand.data.name, entraCommand);
commands.set(esciCommand.data.name, esciCommand);
commands.set(entrataAutomaticaCommand.data.name, entrataAutomaticaCommand);

const NETWORK_ERROR_CODES = new Set([
    "ENOTFOUND", "ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "ECONNABORTED",
    "EHOSTUNREACH", "ENETUNREACH", "ENETDOWN", "EAI_AGAIN", "ESOCKET",
    "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET", "UND_ERR_HEADERS_TIMEOUT",
    "UND_ERR_BODY_TIMEOUT", "UND_ERR_RESPONSE_STATUS_CODE", "AbortError",
]);

function isNetworkError(err: Error | null | undefined): boolean {
    if (!err) return false;
    const anyErr = err as any;
    const code: string | undefined = anyErr.code;
    if (code && NETWORK_ERROR_CODES.has(code)) return true;
    if (anyErr.name === "ConnectTimeoutError" || anyErr.name === "TimeoutError") return true;
    if (anyErr.constructor?.name === "AggregateError" && Array.isArray((anyErr as any).aggregateErrors)) {
        return (anyErr as any).aggregateErrors.some((e: any) => isNetworkError(e));
    }
    const msg = (err.message ?? "").toLowerCase();
    if (msg.includes("getaddrinfo") || msg.includes("socket hang up") || msg.includes("network") ||
        msg.includes("timeout") || msg.includes("connect") || msg.includes("econn") || msg.includes("dns")) {
        return true;
    }
    return false;
}

async function safeReplyEphemeral(interaction: any, content: string): Promise<void> {
    if (!interaction || typeof interaction.reply !== "function" || interaction.replied || interaction.deferred) return;
    try {
        await interaction.reply({ content, flags: "Ephemeral" });
    } catch (err) {
        const code = (err as any)?.code ?? 0;
        if (code === 10062 || code === 40060 || isNetworkError(err as Error)) {
            logger.debug({ code }, "safeReplyEphemeral: interazione già gestita, scaduta o rete down");
        } else {
            logger.warn({ err }, "safeReplyEphemeral: risposta fallita");
        }
    }
}

function safeExecute(fn: () => Promise<void>, label: string) {
    Promise.resolve()
        .then(fn)
        .catch((err) => {
            if (isNetworkError(err as Error)) {
                logger.warn({ label }, "Interazione interrotta: problema di rete");
            } else {
                const code = (err as any)?.code ?? 0;
                if (code === 10062) {
                    logger.debug({ label }, "Interazione scaduta (Unknown interaction)");
                } else {
                    logger.error({ err, label }, "Errore interazione");
                }
            }
        });
}

function timeAgo(dateStr: string | null | undefined): string {
    if (!dateStr) return "Sconosciuto";
    const ms = Date.now() - new Date(dateStr).getTime();
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec} secondi fa`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} minuti fa`;
    const hours = Math.floor(min / 60);
    if (hours < 24) return `${hours} ore fa`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} giorni fa`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} mesi fa`;
    return `${Math.floor(months / 12)} anni fa`;
}

function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return "Sconosciuta";
    return new Date(dateStr).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function redactSensitiveContent(content: string | undefined): string | undefined {
    if (!content) return content;
    return content
        .replace(/(DISCORD_BOT_TOKEN|WOLVESVILLE_API_KEY|WOLVESVILLE_PERSONAL_API_KEY|DASHBOARD_PASSWORD)\s*[:=]\s*[^\s\r\n]+/gi, "$1=[REDACTED]")
        .replace(/\b\d{17,20}\.[A-Za-z0-9_-]{4,8}\.[A-Za-z0-9_-]{20,}\b/g, "[DISCORD_TOKEN_REDACTED]");
}

function buildPollSummaryText(poll: ActivePoll): string {
    const votes = poll.votes ?? {};
    const counts = new Array<number>(poll.questCount).fill(0);
    let rimescoloCount = 0;
    for (const v of Object.values(votes)) {
        if (v === -1) rimescoloCount++;
        else if (v >= 0 && v < poll.questCount) counts[v] = (counts[v] ?? 0) + 1;
    }
    const totalVoters = Object.keys(votes).length;
    const lines: string[] = [`📊 **Conteggio voti (live)** — votanti: **${totalVoters}**`];

    if (totalVoters === 0) {
        lines.push("ℹ️ Ancora nessun voto registrato.");
        return lines.join("\n");
    }

    for (let i = 0; i < poll.questCount; i++) {
        const c = counts[i] ?? 0;
        if (c <= 0) continue;
        lines.push(`• Missione ${i + 1}: **${c}** ${c === 1 ? "voto" : "voti"}`);
    }
    if (rimescoloCount > 0) {
        lines.push(`• 🔀 Rimescolo: **${rimescoloCount}** ${rimescoloCount === 1 ? "voto" : "voti"}`);
    }
    return lines.join("\n");
}

async function updatePollSummaryMessage(client: Client, poll: ActivePoll): Promise<void> {
    const summaryMessageId = poll.summaryMessageId ?? poll.messageIds[1];
    if (!summaryMessageId) return;
    const channel = await client.channels.fetch(poll.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;
    const msg = await channel.messages.fetch(summaryMessageId).catch(() => null);
    if (!msg) return;
    await msg.edit({ content: buildPollSummaryText(poll) });
}

export async function startBot(): Promise<void> {
    const token = BOT_CONFIG.token;
    if (!token) {
        logger.warn("DISCORD_BOT_TOKEN non impostato — bot Discord non avviato (modalità risparmio energetico)");
        return;
    }

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildVoiceStates,
        ],
        partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
    });

    let webServerStarted = false;
    const ensureWebServer = async () => {
        if (webServerStarted) return;
        webServerStarted = true;
        await startWebServer(client).catch((err) => logger.error({ err }, "Errore avvio server dashboard"));
    };
    await initStorage();
    await ensureWebServer();

    client.once("clientReady", async (c) => {
        logger.info({ tag: c.user.tag }, "Bot Discord connesso");
        setDiscordClient(c);
        await ensureWebServer();
        startDonationTracker(c);
        startJoinRequestTracker(c);
        startBirthdayScheduler(c);

        setInterval(async () => {
            const config = loadConfig();
            const now = new Date();
            let updated = false;

            for (const msg of config.scheduledMessages || []) {
                if (!msg.enabled) continue;

                const scheduledDate = new Date(msg.scheduledTime);

                if (msg.isRecurring) {
                    const lastSent = msg.lastSent ? new Date(msg.lastSent) : null;
                    let shouldSend = false;

                    if (Array.isArray(msg.daysOfWeek) && msg.daysOfWeek.length > 0) {
                        const alreadySentToday = lastSent && new Date(lastSent).toDateString() === now.toDateString();
                        shouldSend = now >= scheduledDate && msg.daysOfWeek.includes(now.getDay()) && !alreadySentToday;
                    } else if (!lastSent) {
                        shouldSend = now >= scheduledDate;
                    } else {
                        const timeDiff = now.getTime() - lastSent.getTime();
                        const oneDay = 24 * 60 * 60 * 1000;

                        if (msg.recurrenceInterval === 'daily') {
                            shouldSend = timeDiff >= oneDay;
                        } else if (msg.recurrenceInterval === 'weekly') {
                            shouldSend = timeDiff >= 7 * oneDay;
                        } else if (msg.recurrenceInterval === 'monthly') {
                            const nextMonthly = new Date(lastSent);
                            nextMonthly.setMonth(nextMonthly.getMonth() + 1);
                            shouldSend = now >= nextMonthly;
                        }
                    }

                    if (shouldSend) {
                        const channel = c.channels.cache.get(msg.channelId) as TextChannel;
                        if (channel) {
                            try {
                                await channel.send(msg.message);
                                msg.lastSent = now.toISOString();
                                updated = true;
                                logger.info({ guildId: msg.guildId, channelId: msg.channelId }, "Recurring message sent");
                            } catch (err) {
                                logger.error({ err, msgId: msg.id }, "Error sending recurring message");
                            }
                        }
                    }
                } else {
                    if (!msg.lastSent && now >= scheduledDate) {
                        const channel = c.channels.cache.get(msg.channelId) as TextChannel;
                        if (channel) {
                            try {
                                await channel.send(msg.message);
                                msg.lastSent = now.toISOString();
                                msg.enabled = false;
                                updated = true;
                                logger.info({ guildId: msg.guildId, channelId: msg.channelId }, "One-time message sent");
                            } catch (err) {
                                logger.error({ err, msgId: msg.id }, "Error sending one-time message");
                            }
                        }
                    }
                }
            }

            if (updated) {
                saveConfig(config);
            }
        }, 60000);

        const rest = new REST().setToken(token);
        const commandsData = [
            sondaggioCommand.data.toJSON(),
            impostazioniCommand.data.toJSON(),
            debugTempliCommand.data.toJSON(),
            fineCommand.data.toJSON(),
            messaggioCondivisoCommand.data.toJSON(),
            roseCommand.data.toJSON(),
            familyCommand.data.toJSON(),
            donazioniCommand.data.toJSON(),
            addCommand.data.toJSON(),
            entraCommand.data.toJSON(),
            esciCommand.data.toJSON(),
            entrataAutomaticaCommand.data.toJSON(),
        ];

        try {
            await rest.put(Routes.applicationCommands(c.application.id), { body: [] });
        } catch (err) {
            logger.warn({ err }, "Impossibile rimuovere comandi globali");
        }

        for (const [guildId] of c.guilds.cache) {
            try {
                await rest.put(Routes.applicationGuildCommands(c.application.id, guildId), { body: commandsData });
                logger.info({ guildId }, "Comandi slash registrati");
            } catch (err) {
                logger.error({ err, guildId }, "Errore registrazione comandi");
            }
        }

        const config = loadConfig();
        if (config.activePoll?.closesAt) {
            schedulePollClose(client, config.activePoll.closesAt);
        }
    });

    client.on("guildMemberAdd", async (member) => {
        if (member.partial) {
            try {
                await member.fetch();
            } catch (err) {
                logger.error({ err }, "Error fetching partial member");
                return;
            }
        }
        try {
            await handleMemberJoin(member as GuildMember);
        } catch (err) {
            logger.error({ err }, "Error in guildMemberAdd");
        }
    });

    client.on("guildMemberRemove", async (member) => {
        if (member.partial) {
            try {
                await member.fetch();
            } catch (err) {
                logger.error({ err }, "Error fetching partial member");
                return;
            }
        }
        try {
            await handleMemberLeave(member as GuildMember);
        } catch (err) {
            logger.error({ err }, "Error in guildMemberRemove");
        }
    });

    client.on("voiceStateUpdate", (oldState: VoiceState, newState: VoiceState) => {
        void handleVoiceStateUpdate(oldState, newState);
        if (newState.member?.user.bot) return;
        if (oldState.channelId === newState.channelId) return;
        if (oldState.channelId && newState.channelId) {
            trackVoiceState({ guildId: newState.guild.id, userId: newState.id, channelId: null });
            trackVoiceState({ guildId: newState.guild.id, userId: newState.id, channelId: newState.channelId });
            return;
        }
        trackVoiceState({ guildId: newState.guild.id, userId: newState.id, channelId: newState.channelId });
    });

    client.on("interactionCreate", async (interaction: Interaction) => {
        if (interaction.isStringSelectMenu() && interaction.customId === "vote_mission") {
            const value = interaction.values[0] ?? "";
            const config = loadConfig();
            const poll = config.activePoll;

            if (!poll || !poll.messageIds.includes(interaction.message.id)) {
                await safeReplyEphemeral(interaction, "❌ Questo sondaggio non è più attivo.");
                return;
            }

            if (poll.closesAt && Date.now() >= new Date(poll.closesAt).getTime()) {
                await safeReplyEphemeral(interaction, "❌ Questo sondaggio non è più attivo.");
                void closePoll(client);
                return;
            }

            poll.votes = poll.votes ?? {};
            const isChange = interaction.user.id in poll.votes;

            if (value === "rimescolo") {
                poll.votes[interaction.user.id] = -1;
                saveConfig(config);
                await updatePollSummaryMessage(client, poll).catch(() => null);
                const verb = isChange ? "🔄 **Voto aggiornato!** Hai votato per il" : "🔀 **Voto registrato!** Hai votato per il";
                await safeReplyEphemeral(interaction, `${verb} **Rimescolo**.`);
                return;
            }

            const selectedIdx = parseInt(value, 10);
            if (isNaN(selectedIdx) || selectedIdx < 0 || selectedIdx >= poll.questCount) {
                await safeReplyEphemeral(interaction, "❌ Scelta non valida.");
                return;
            }

            poll.votes[interaction.user.id] = selectedIdx;
            saveConfig(config);
            await updatePollSummaryMessage(client, poll).catch(() => null);
            const label = poll.questLabels[selectedIdx] ?? `Missione ${selectedIdx + 1}`;
            const msg = isChange
                ? `🔄 **Voto aggiornato!** Hai cambiato voto: **${label}**`
                : `✅ **Voto registrato!** Hai votato: **${label}**`;
            await safeReplyEphemeral(interaction, msg);
            return;
        }

        if (interaction.isButton()) {
            const customId = interaction.customId;
            if (customId.startsWith("sharedmsg:edit:")) {
                safeExecute(async () => {
                    await messaggioCondivisoCommand.handleButtonInteraction(interaction as ButtonInteraction);
                }, `button:${customId}`);
                return;
            }
            if (customId === "rose_join" || customId === "rose_reserve" || customId === "rose_leave") {
                safeExecute(async () => {
                    await roseCommand.handleButtonInteraction(interaction as ButtonInteraction);
                }, `button:${customId}`);
                return;
            }
        }

        if (interaction.isModalSubmit() && interaction.customId.startsWith("sharedmsg:modal:")) {
            safeExecute(async () => {
                await messaggioCondivisoCommand.handleModalSubmit(interaction);
            }, `modal:${interaction.customId}`);
            return;
        }

        if (!interaction.isAutocomplete() && !interaction.isChatInputCommand()) return;

        const command = commands.get(interaction.commandName);

        if (interaction.isAutocomplete()) {
            const autocompleteCommand = command as (BotCommand & {
                handleAutocomplete?: (interaction: any) => Promise<void>;
            }) | undefined;
            if (autocompleteCommand?.handleAutocomplete) {
                try {
                    await autocompleteCommand.handleAutocomplete(interaction);
                } catch (err) {
                    if (isNetworkError(err as Error)) {
                        logger.debug({ command: interaction.commandName }, "Autocomplete interrotto da errore rete");
                    } else {
                        logger.error({ err, command: interaction.commandName }, "Errore autocomplete");
                    }
                }
            }
            return;
        }
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (err) {
            const cmdName = interaction.commandName;
            if (isNetworkError(err as Error)) {
                logger.warn({ command: cmdName, err }, "Errore comando: problema di rete");
            } else {
                logger.error({ err, command: cmdName }, "Errore comando");
            }
            const errorMsg = { content: "❌ Si è verificato un errore. Riprova più tardi.", flags: "Ephemeral" as const };
            try {
                if (interaction.isChatInputCommand()) {
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp(errorMsg);
                    } else {
                        await interaction.reply(errorMsg);
                    }
                }
            } catch (replyErr) {
                const code = (replyErr as any)?.code ?? (replyErr as any)?.status ?? 0;
                if (code === 10062) {
                    logger.debug({ command: cmdName }, "Catch-all: interazione scaduta durante errore rete");
                } else if (isNetworkError(replyErr as Error)) {
                    logger.debug({ command: cmdName }, "Catch-all: impossibile inviare messaggio errore (rete down)");
                } else {
                    logger.warn({ err: replyErr, command: cmdName }, "Catch-all: errore secondario durante risposta errore");
                }
            }
        }
    });

    client.on("messageCreate", async (message: Message) => {
        if (message.author.bot) return;
        if (message.guild) trackMessageActivity(message.guild.id, message.author.id);
        const content = message.content.trim();
        const guildId = message.guild?.id;

        if (guildId && message.member) {
            await handleMessageForTTS({
                guildId,
                channelId: message.channel.id,
                content,
                attachments: message.attachments.values(),
                member: message.member as GuildMember,
                client,
            });
        }

        if (guildId) {
            const config = loadConfig();
            const autoResponses = (config.autoResponses || []).filter(r => r.guildId === guildId && r.enabled);

            for (const response of autoResponses) {
                let matched = false;

                if (response.isRegex) {
                    try {
                        const regex = new RegExp(response.trigger, 'i');
                        matched = regex.test(content);
                    } catch (err) {
                        logger.error({ err, trigger: response.trigger }, "Invalid regex in auto response");
                        continue;
                    }
                } else {
                    matched = content.toLowerCase().includes(response.trigger.toLowerCase());
                }

                if (matched) {
                    try {
                        await message.reply(response.response);
                        logger.info({ guildId, trigger: response.trigger }, "Auto response sent");
                    } catch (err) {
                        logger.error({ err, responseId: response.id }, "Error sending auto response");
                    }
                    break;
                }
            }
        }

        const trimmed = content.trim();
        const lower = trimmed.toLowerCase();

        if (!trimmed.startsWith(".")) return;
        if (trimmed === ".") return;
        if (trimmed.startsWith("./") || trimmed.startsWith("..")) return;

        let username: string | null = null;
        if (lower === ".nickname") {
            username = null;
        } else if (lower.startsWith(".nickname")) {
            username = trimmed.slice(".nickname".length).trim() || null;
        } else {
            username = trimmed.slice(1).trim() || null;
        }

        if (!username) return;

        try {
            if (message.channel.isTextBased() && 'sendTyping' in message.channel) {
                await message.channel.sendTyping();
            }
            const player = await fetchPlayerByUsername(username);

            if (!player) {
                await message.reply({ content: `❌ Nessun giocatore trovato con il nome **${username}**.` });
                return;
            }

            const p = player as any;
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

            let clanName: string | undefined;
            if (player.clanId) {
                const clan = await fetchClanById(player.clanId);
                clanName = clan?.name;
            }

            // Bug reale: il codice leggeva `avatarRaw?.url`, ma il tipo WvPlayer
            // dichiara `imageUrl` — l'avatar vero non veniva mai mostrato, solo
            // l'emoji 🐺 di fallback. Corretto qui sotto.
                        const avatarRaw = p.equippedAvatar;
                        const avatarUrl: string | undefined = typeof avatarRaw === "string"
                            ? avatarRaw
                            : avatarRaw?.imageUrl ?? avatarRaw?.url;
            
            if (!avatarUrl) {
                            logger.info({ username: player.username, avatarRaw }, "Avatar non trovato nel profilo del giocatore");
            }

            const profileIconUrl = p.profileIconId
                ? `https://cdn.wolvesville.com/profileIcons/${p.profileIconId as string}.png`
                : undefined;

            const cfg = loadConfig();
            const profileCardConfig = guildId ? cfg.profileCardConfigs?.find((pc) => pc.guildId === guildId)?.card : undefined;

            const cardBuffer = await generateProfileCard({
                username: player.username,
                level: player.level,
                personalMessage: player.personalMessage,
                clanName,
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

            const fileName = `profilo_${player.username}.png`;
            const attachment = new AttachmentBuilder(cardBuffer, { name: fileName });

            const embed = new EmbedBuilder()
                .setColor(0x8b0000)
                .setTitle(`🔎 ${player.username}`)
                .setImage(`attachment://${fileName}`);

            if (profileIconUrl) embed.setThumbnail(profileIconUrl);

            if (player.personalMessage) {
                embed.setDescription(`*"${player.personalMessage}"*`);
            }

            embed.addFields(
                { name: "🆔 ID", value: `\`${player.id}\``, inline: false },
                { name: "🏰 Clan", value: clanName ?? "Nessuno", inline: true },
                { name: "🕐 Ultimo accesso", value: timeAgo(p.lastOnline), inline: true },
                { name: "📅 Creato", value: formatDate(p.creationTime), inline: true },
            );

            await message.reply({ embeds: [embed], files: [attachment] });
            logger.info({ username: player.username, avatarUrl }, "Scheda giocatore inviata");
        } catch (err) {
            logger.error({ err, username }, "Errore ricerca giocatore");
            await message.reply({ content: "❌ Errore durante la ricerca del giocatore. Riprova più tardi." });
        }
    });

    function getGuildLogsConfig(guildId: string): GuildLogsConfig {
        const config = loadConfig();
        return (
            config.logsConfigs?.find((c) => c.guildId === guildId) ?? {
                guildId,
                guildName: "Unknown",
                enabled: false,
                channelId: undefined,
                interceptApps: true,
                interceptUsers: true,
            }
        );
    }

    function collectImageAttachments(message: Message | any): DeletedModifiedAttachment[] {
        const attachments = message.attachments?.values?.() ?? [];
        return Array.from(attachments)
            .filter((attachment: any) => {
                const contentType = attachment.contentType?.toLowerCase();
                if (contentType?.startsWith("image/")) return true;
                return /\.(avif|gif|jpe?g|png|webp)$/i.test((attachment.name ?? attachment.url ?? "").split("?")[0]);
            })
            .map((attachment: any) => ({
                name: attachment.name || "immagine",
                url: attachment.url,
                contentType: attachment.contentType,
                size: attachment.size,
            }))
            .filter((attachment) => Boolean(attachment.url));
    }

    function boldChangedPart(oldText: string, newText: string): string {
        let prefixLength = 0;
        while (prefixLength < oldText.length && prefixLength < newText.length && oldText[prefixLength] === newText[prefixLength]) {
            prefixLength++;
        }
        let suffixLength = 0;
        while (
            suffixLength < oldText.length - prefixLength &&
            suffixLength < newText.length - prefixLength &&
            oldText[oldText.length - 1 - suffixLength] === newText[newText.length - 1 - suffixLength]
        ) {
            suffixLength++;
        }
        const prefix = newText.slice(0, prefixLength);
        const changedEnd = newText.length - suffixLength;
        const changed = newText.slice(prefixLength, changedEnd);
        const suffix = newText.slice(changedEnd);
        return changed ? `${prefix}**${changed}**${suffix}` : newText;
    }

    async function handleLog(logEntry: DeletedModifiedLog) {
        const safeLogEntry: DeletedModifiedLog = {
            ...logEntry,
            oldContent: redactSensitiveContent(logEntry.oldContent),
            newContent: redactSensitiveContent(logEntry.newContent),
            deletedContent: redactSensitiveContent(logEntry.deletedContent),
        };
        const config = loadConfig();
        const logsConfig = getGuildLogsConfig(safeLogEntry.guildId);

        const logs = config.deletedModifiedLogs ?? [];
        logs.unshift(safeLogEntry);
        const trimmedLogs = logs.slice(0, 100);
        saveConfig({ ...config, deletedModifiedLogs: trimmedLogs });

        if (logsConfig.enabled && logsConfig.channelId) {
            const channel = client.channels.cache.get(logsConfig.channelId) as TextChannel;
            if (channel) {
                try {
                    const embed = new EmbedBuilder()
                        .setColor(safeLogEntry.type === "deleted" ? 0xed4245 : 0xfee75c)
                        .setTitle(safeLogEntry.type === "deleted" ? "🗑️ Messaggio Eliminato" : "✏️ Messaggio Modificato")
                        .setAuthor({
                            name: safeLogEntry.author.username,
                            iconURL: safeLogEntry.author.avatar,
                        })
                        .addFields(
                            { name: "Canale", value: `<#${safeLogEntry.channelId}>`, inline: true },
                            { name: "Data", value: `<t:${Math.floor(new Date(safeLogEntry.timestamp).getTime() / 1000)}:F>`, inline: true }
                        )
                        .setTimestamp();

                    if (safeLogEntry.type === "deleted" && safeLogEntry.deletedContent) {
                        embed.addFields({ name: "Contenuto Eliminato", value: safeLogEntry.deletedContent.length > 1024 ? safeLogEntry.deletedContent.substring(0, 1021) + "..." : safeLogEntry.deletedContent });
                    } else if (safeLogEntry.type === "modified") {
                        if (safeLogEntry.oldContent) {
                            embed.addFields({ name: "Prima", value: safeLogEntry.oldContent.length > 1024 ? safeLogEntry.oldContent.substring(0, 1021) + "..." : safeLogEntry.oldContent });
                        }
                        if (safeLogEntry.newContent) {
                            const afterText = boldChangedPart(safeLogEntry.oldContent || "", safeLogEntry.newContent);
                            embed.addFields({ name: "Dopo", value: afterText.length > 1024 ? afterText.substring(0, 1021) + "..." : afterText });
                        }
                    }

                    const attachments = safeLogEntry.type === "deleted"
                        ? safeLogEntry.deletedAttachments ?? []
                        : safeLogEntry.newAttachments ?? [];
                    await channel.send({
                        embeds: [embed],
                        files: attachments.map((attachment) => ({ attachment: attachment.url, name: attachment.name })),
                    });
                } catch (err) {
                    logger.error({ err, guildId: logEntry.guildId }, "Errore invio log nel canale");
                }
            }
        }
    }

    client.on("messageDelete", async (message) => {
        if (!message.guildId) return;

        const logsConfig = getGuildLogsConfig(message.guildId);
        if (!logsConfig.enabled) return;
        if (logsConfig.ignoredChannelIds?.includes(message.channelId)) return;

        const isBot = message.author?.bot || false;
        if (isBot && !logsConfig.interceptApps) return;
        if (!isBot && !logsConfig.interceptUsers) return;

        const logEntry: DeletedModifiedLog = {
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            guildId: message.guildId,
            timestamp: new Date().toISOString(),
            type: "deleted",
            author: message.author ? {
                id: message.author.id,
                username: message.author.tag,
                avatar: message.author.displayAvatarURL(),
                isBot: message.author.bot,
            } : {
                id: "unknown",
                username: "Unknown",
                avatar: "",
                isBot: false,
            },
            channelId: message.channelId,
            channelName: (message.channel as any)?.name || "Unknown",
            deletedContent: message.content ?? undefined,
            deletedAttachments: collectImageAttachments(message),
        };

        await handleLog(logEntry);
    });

    client.on("messageUpdate", async (oldMessage, newMessage) => {
        if (!oldMessage.guildId) return;

        const logsConfig = getGuildLogsConfig(oldMessage.guildId);
        if (!logsConfig.enabled) return;
        if (logsConfig.ignoredChannelIds?.includes(oldMessage.channelId)) return;

        const isBot = oldMessage.author?.bot || false;
        if (isBot && !logsConfig.interceptApps) return;
        if (!isBot && !logsConfig.interceptUsers) return;

        const oldAttachments = collectImageAttachments(oldMessage);
        const newAttachments = collectImageAttachments(newMessage);
        if (oldMessage.content === newMessage.content && JSON.stringify(oldAttachments) === JSON.stringify(newAttachments)) return;

        const logEntry: DeletedModifiedLog = {
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            guildId: oldMessage.guildId,
            timestamp: new Date().toISOString(),
            type: "modified",
            author: oldMessage.author ? {
                id: oldMessage.author.id,
                username: oldMessage.author.tag,
                avatar: oldMessage.author.displayAvatarURL(),
                isBot: oldMessage.author.bot,
            } : {
                id: "unknown",
                username: "Unknown",
                avatar: "",
                isBot: false,
            },
            channelId: oldMessage.channelId,
            channelName: (oldMessage.channel as any)?.name || "Unknown",
            oldContent: oldMessage.content ?? undefined,
            newContent: newMessage.content ?? undefined,
            oldAttachments,
            newAttachments,
        };

        await handleLog(logEntry);
    });

    client.on("error", (err) => {
        if (isNetworkError(err)) {
            logger.warn({ msg: (err as Error).message, code: (err as any).code }, "Client Discord: interruzione di rete");
        } else {
            logger.error({ err }, "Errore client Discord");
        }
    });

    client.on("warn", (info: string) => {
        logger.warn({ info }, "Client Discord: warning");
    });

    client.on("shardDisconnect", (_event: any, shardId: number) => {
        logger.warn({ shardId }, "Shard Discord: disconnesso — discord.js riproverà a riconnettersi");
    });

    client.on("shardResume", (replayed: number, shardId: number) => {
        logger.info({ shardId, replayed }, "Shard Discord: riconnesso con successo");
    });

    client.on("shardError", (err: Error, shardId: number) => {
        if (isNetworkError(err) || err.message.includes("handshake") || err.message.includes("timeout")) {
            logger.warn({ shardId, msg: err.message.slice(0, 200) }, "Shard Discord errore rete: pausa e attendi riconnessione");
        } else {
            logger.error({ err, shardId }, "Shard Discord errore");
        }
    });

    client.on("ready", () => {
        logger.debug("Evento ready ricevuto (deprecato, usare clientReady)");
    });

    let loginAttempts = 0;
    const MAX_LOGIN_ATTEMPTS = 10;
    while (true) {
        loginAttempts++;
        try {
            await client.login(token);
            break;
        } catch (err) {
            if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
                logger.error({ err, attempts: loginAttempts }, "Login Discord fallito dopo molti tentativi — arresto");
                throw err;
            }
            const waitSec = Math.min(5 * loginAttempts, 30);
            logger.warn({ attempts: loginAttempts, waitSec, msg: (err as Error).message.slice(0, 200) },
                "Login Discord fallito — riprovo tra poco");
            await new Promise((r) => setTimeout(r, waitSec * 1000));
        }
    }
}

startBot().catch((err) => {
    logger.error({ err }, "Avvio bot fallito");
    process.exit(1);
});
