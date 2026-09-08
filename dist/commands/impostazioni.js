import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits, ChannelType, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags, } from "discord.js";
import { logger } from "../utils/logger.js";
import { loadConfig, saveConfig, DEFAULT_MESSAGES } from "../utils/storage.js";
export const data = new SlashCommandBuilder()
    .setName("impostazioni")
    .setDescription("Configura il bot: canale sondaggi, notifiche, durata, ruoli e messaggi")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
const COLOR = 0x8b0000;
const IDLE_MS = 180_000; // 3 minuti di inattività
const MAX_TOTAL_MS = 900_000; // 15 minuti di sessione massima, come rete di sicurezza
const DURATION_OPTIONS = [
    { label: "12 ore", value: "12" },
    { label: "24 ore (1 giorno)", value: "24" },
    { label: "36 ore", value: "36" },
    { label: "48 ore (2 giorni)", value: "48" },
    { label: "72 ore (3 giorni)", value: "72" },
    { label: "96 ore (4 giorni)", value: "96" },
    { label: "120 ore (5 giorni)", value: "120" },
    { label: "168 ore (7 giorni)", value: "168" },
    { label: "Nessun timer", value: "0" },
];
const MESSAGE_KEYS = [
    { key: "missioneVinta", label: "Missione vinta", emoji: "🏆", hint: "Variabile: {missione}" },
    { key: "pareggio", label: "Pareggio", emoji: "⚖️", hint: "Variabile: {missioni}" },
    { key: "nessunVoto", label: "Nessun voto", emoji: "🗳️", hint: "Nessuna variabile disponibile" },
    { key: "rimescolo", label: "Rimescolo", emoji: "🔀", hint: "Nessuna variabile disponibile" },
];
const MAIN_SECTIONS = [
    { value: "poll_channel", label: "Canale sondaggi", emoji: "📊" },
    { value: "notify_channels", label: "Canali notifica", emoji: "🔔" },
    { value: "duration", label: "Durata sondaggio", emoji: "⏱️" },
    { value: "ping_role", label: "Ruolo da pingare", emoji: "🔔" },
    { value: "pilgrim_role", label: "Ruolo pellegrini", emoji: "🚶" },
    { value: "messages", label: "Messaggi", emoji: "💬" },
];
function backRow(customId = "menu_back") {
    return new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(customId).setLabel("⬅️ Indietro").setStyle(ButtonStyle.Secondary));
}
function summarize(config, guild) {
    const validNotifyChannelIds = (config.notifyChannelIds ?? []).filter((id) => guild.channels.cache.has(id));
    const validPollChannelId = config.pollChannelId && guild.channels.cache.has(config.pollChannelId) ? config.pollChannelId : null;
    const validPingRoleId = config.pingRoleId && guild.roles.cache.has(config.pingRoleId) ? config.pingRoleId : undefined;
    const validPilgrimRoleId = config.pilgrimRoleId && guild.roles.cache.has(config.pilgrimRoleId) ? config.pilgrimRoleId : undefined;
    const durLabel = config.pollDurationHours && config.pollDurationHours > 0 ? `${config.pollDurationHours} ore` : "Nessun timer";
    return [
        `📊 **Canale sondaggi:** ${validPollChannelId ? `<#${validPollChannelId}>` : "❌ non impostato"}`,
        `🔔 **Canali notifica:** ${validNotifyChannelIds.length > 0 ? validNotifyChannelIds.map((id) => `<#${id}>`).join(", ") : "❌ nessuno"}`,
        `⏱️ **Durata sondaggio:** ${durLabel}`,
        `🔔 **Ruolo da pingare:** ${validPingRoleId ? `<@&${validPingRoleId}>` : "❌ non impostato"}`,
        `🚶 **Ruolo pellegrini:** ${validPilgrimRoleId ? `<@&${validPilgrimRoleId}>` : "❌ non impostato"}`,
    ].join("\n");
}
function buildMainMenu(config, guild) {
    const embed = new EmbedBuilder()
        .setTitle("⚙️ Impostazioni Bot Wolvesville")
        .setDescription(`**Configurazione attuale:**\n${summarize(config, guild)}\n\nScegli cosa modificare dal menu qui sotto.`)
        .setColor(COLOR)
        .setFooter({ text: "Solo gli admin possono usare questo comando · ogni modifica si salva subito" });
    const select = new StringSelectMenuBuilder()
        .setCustomId("menu_main")
        .setPlaceholder("Cosa vuoi modificare?")
        .addOptions(MAIN_SECTIONS.map((s) => new StringSelectMenuOptionBuilder().setLabel(s.label).setValue(s.value).setEmoji(s.emoji)));
    const closeRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("menu_close").setLabel("✅ Chiudi").setStyle(ButtonStyle.Success));
    return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select), closeRow] };
}
function buildPollChannelScreen(config) {
    const embed = new EmbedBuilder()
        .setTitle("📊 Canale sondaggi")
        .setDescription("Scegli il canale dove appariranno i sondaggi.")
        .setColor(COLOR);
    const select = new ChannelSelectMenuBuilder()
        .setCustomId("select_poll_channel")
        .setPlaceholder("Scegli il canale…")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);
    if (config.pollChannelId)
        select.setDefaultChannels(config.pollChannelId);
    return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select), backRow()] };
}
function buildNotifyChannelsScreen(config) {
    const embed = new EmbedBuilder()
        .setTitle("🔔 Canali notifica")
        .setDescription("Scegli i canali dove mandare la notifica quando escono nuovi sondaggi. Puoi selezionarne più d'uno.")
        .setColor(COLOR);
    const select = new ChannelSelectMenuBuilder()
        .setCustomId("select_notify_channels")
        .setPlaceholder("Scegli i canali… (max 10)")
        .setMinValues(1)
        .setMaxValues(10)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);
    if (config.notifyChannelIds?.length)
        select.setDefaultChannels(...config.notifyChannelIds.slice(0, 10));
    return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select), backRow()] };
}
function buildDurationScreen(config) {
    const embed = new EmbedBuilder()
        .setTitle("⏱️ Durata sondaggio")
        .setDescription("Per quanto tempo deve restare aperto il sondaggio prima di chiudersi automaticamente?\nScegli **Nessun timer** per disabilitare la chiusura automatica.")
        .setColor(COLOR);
    const currentValue = String(config.pollDurationHours ?? 0);
    const select = new StringSelectMenuBuilder()
        .setCustomId("select_duration")
        .setPlaceholder("Scegli la durata…")
        .addOptions(DURATION_OPTIONS.map((o) => new StringSelectMenuOptionBuilder().setLabel(o.label).setValue(o.value).setDefault(o.value === currentValue)));
    return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select), backRow()] };
}
function buildPingRoleScreen(config) {
    const embed = new EmbedBuilder()
        .setTitle("🔔 Ruolo da pingare")
        .setDescription("Quale ruolo deve essere menzionato quando i sondaggi si chiudono?")
        .setColor(COLOR);
    const select = new RoleSelectMenuBuilder().setCustomId("select_role").setPlaceholder("Scegli il ruolo…");
    if (config.pingRoleId)
        select.setDefaultRoles(config.pingRoleId);
    return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select), backRow()] };
}
function buildPilgrimRoleScreen(config) {
    const embed = new EmbedBuilder()
        .setTitle("🚶 Ruolo pellegrini")
        .setDescription("Quale ruolo identifica i pellegrini/ospiti nel server?")
        .setColor(COLOR);
    const select = new RoleSelectMenuBuilder().setCustomId("select_pilgrim_role").setPlaceholder("Scegli il ruolo…");
    if (config.pilgrimRoleId)
        select.setDefaultRoles(config.pilgrimRoleId);
    return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select), backRow()] };
}
function buildMessagesScreen(config) {
    const msgs = { ...DEFAULT_MESSAGES, ...config.messages };
    const lines = MESSAGE_KEYS.map((m) => {
        const isCustom = config.messages?.[m.key] !== undefined;
        const text = msgs[m.key];
        return `${m.emoji} **${m.label}**${isCustom ? " *(personalizzato)*" : " *(default)*"}\n> ${text.slice(0, 100)}${text.length > 100 ? "…" : ""}`;
    });
    const embed = new EmbedBuilder()
        .setTitle("💬 Messaggi")
        .setDescription("Personalizza i messaggi che il bot invia.\n\n" +
        lines.join("\n\n") +
        "\n\n✏️ per modificare, ♻️ per tornare al testo di default.")
        .setColor(COLOR);
    const rows = MESSAGE_KEYS.map((m) => new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`msgedit_${m.key}`).setLabel(`Modifica ${m.label}`).setEmoji("✏️").setStyle(ButtonStyle.Primary), new ButtonBuilder()
        .setCustomId(`msgreset_${m.key}`)
        .setLabel("Ripristina default")
        .setEmoji("♻️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(config.messages?.[m.key] === undefined)));
    return { embeds: [embed], components: [...rows, backRow("menu_back_from_messages")] };
}
export async function execute(interaction) {
    try {
        const guild = interaction.guild;
        if (!guild) {
            await interaction.reply({ content: "❌ Questo comando funziona solo in un server.", flags: MessageFlags.Ephemeral });
            return;
        }
        let config = loadConfig();
        const mainMenu = buildMainMenu(config, guild);
        await interaction.reply({ ...mainMenu, flags: MessageFlags.Ephemeral });
        const reply = await interaction.fetchReply();
        const collector = reply.createMessageComponentCollector({
            filter: (i) => i.user.id === interaction.user.id,
            idle: IDLE_MS,
            time: MAX_TOTAL_MS,
        });
        let screen = "main";
        collector.on("collect", async (i) => {
            try {
                config = loadConfig(); // ricarica per evitare di sovrascrivere modifiche fatte altrove nel frattempo
                // ---- Menu principale (select) ----
                if (i.isStringSelectMenu() && i.customId === "menu_main") {
                    const section = i.values[0];
                    screen = section === "messages" ? "messages" : "main";
                    const screenData = section === "poll_channel" ? buildPollChannelScreen(config)
                        : section === "notify_channels" ? buildNotifyChannelsScreen(config)
                            : section === "duration" ? buildDurationScreen(config)
                                : section === "ping_role" ? buildPingRoleScreen(config)
                                    : section === "pilgrim_role" ? buildPilgrimRoleScreen(config)
                                        : buildMessagesScreen(config);
                    await i.update(screenData);
                    return;
                }
                // ---- Torna al menu principale ----
                if (i.isButton() && (i.customId === "menu_back" || i.customId === "menu_back_from_messages")) {
                    screen = "main";
                    await i.update(buildMainMenu(config, guild));
                    return;
                }
                // ---- Chiudi ----
                if (i.isButton() && i.customId === "menu_close") {
                    collector.stop("done");
                    await i.update({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle("✅ Impostazioni chiuse")
                                .setDescription(`**Configurazione attuale:**\n${summarize(config, guild)}\n\nUsa \`/impostazioni\` in qualsiasi momento per modificarle di nuovo.`)
                                .setColor(0x00aa44),
                        ],
                        components: [],
                    });
                    return;
                }
                // ---- Canale sondaggi ----
                if (i.isChannelSelectMenu() && i.customId === "select_poll_channel") {
                    config.pollChannelId = i.values[0] ?? null;
                    saveConfig(config);
                    await i.update(buildMainMenu(config, guild));
                    return;
                }
                // ---- Canali notifica ----
                if (i.isChannelSelectMenu() && i.customId === "select_notify_channels") {
                    config.notifyChannelIds = i.values;
                    saveConfig(config);
                    await i.update(buildMainMenu(config, guild));
                    return;
                }
                // ---- Durata ----
                if (i.isStringSelectMenu() && i.customId === "select_duration") {
                    config.pollDurationHours = parseInt(i.values[0] ?? "0", 10);
                    saveConfig(config);
                    await i.update(buildMainMenu(config, guild));
                    return;
                }
                // ---- Ruolo da pingare ----
                if (i.isRoleSelectMenu() && i.customId === "select_role") {
                    config.pingRoleId = i.values[0];
                    saveConfig(config);
                    await i.update(buildMainMenu(config, guild));
                    return;
                }
                // ---- Ruolo pellegrini ----
                if (i.isRoleSelectMenu() && i.customId === "select_pilgrim_role") {
                    config.pilgrimRoleId = i.values[0];
                    saveConfig(config);
                    await i.update(buildMainMenu(config, guild));
                    return;
                }
                // ---- Ripristina messaggio al default ----
                if (i.isButton() && i.customId.startsWith("msgreset_")) {
                    const msgKey = i.customId.replace("msgreset_", "");
                    if (config.messages && msgKey in config.messages) {
                        delete config.messages[msgKey];
                        saveConfig(config);
                    }
                    screen = "messages";
                    await i.update(buildMessagesScreen(config));
                    return;
                }
                // ---- Modifica messaggio (apre modal) ----
                if (i.isButton() && i.customId.startsWith("msgedit_")) {
                    const msgKey = i.customId.replace("msgedit_", "");
                    const msgMeta = MESSAGE_KEYS.find((m) => m.key === msgKey);
                    if (!msgMeta)
                        return;
                    const currentText = config.messages?.[msgKey] ?? DEFAULT_MESSAGES[msgKey];
                    const modal = new ModalBuilder().setCustomId(`modal_${msgKey}`).setTitle(`${msgMeta.emoji} ${msgMeta.label}`);
                    const textInput = new TextInputBuilder()
                        .setCustomId("message_text")
                        .setLabel(msgMeta.hint)
                        .setStyle(TextInputStyle.Paragraph)
                        .setValue(currentText)
                        .setMaxLength(500)
                        .setRequired(true);
                    modal.addComponents(new ActionRowBuilder().addComponents(textInput));
                    await i.showModal(modal);
                    try {
                        const submitted = await i.awaitModalSubmit({
                            filter: (m) => m.user.id === interaction.user.id && m.customId === `modal_${msgKey}`,
                            time: 120_000,
                        });
                        const newText = submitted.fields.getTextInputValue("message_text").trim();
                        config = loadConfig();
                        if (!config.messages)
                            config.messages = {};
                        config.messages[msgKey] = newText;
                        saveConfig(config);
                        screen = "messages";
                        if (submitted.isFromMessage()) {
                            await submitted.update(buildMessagesScreen(config));
                        }
                        else {
                            await interaction.editReply(buildMessagesScreen(config));
                        }
                    }
                    catch {
                        // Timeout della modal (nessun testo inviato): non facciamo nulla,
                        // il pannello messaggi resta quello di prima al prossimo aggiornamento.
                    }
                    return;
                }
            }
            catch (err) {
                logger.warn({ err, screen, customId: i.customId }, "Errore durante collect impostazioni");
                const code = err?.code ?? err?.status ?? 0;
                if (code === 10062) {
                    collector.stop("unknown_interaction");
                    try {
                        await interaction.editReply({
                            embeds: [new EmbedBuilder().setTitle("⚠️ Interazione scaduta").setDescription("Usa `/impostazioni` per ricominciare.").setColor(0xffaa00)],
                            components: [],
                        });
                    }
                    catch { /* ignorato */ }
                }
                else {
                    try {
                        await i.deferUpdate().catch(() => null);
                    }
                    catch { /* ignorato */ }
                    try {
                        await interaction.editReply({
                            embeds: [new EmbedBuilder().setTitle("❌ Errore").setDescription("Si è verificato un errore. Le modifiche già fatte restano salvate. Usa `/impostazioni` per continuare.").setColor(0xed4245)],
                            components: [],
                        });
                        collector.stop("error");
                    }
                    catch { /* ignorato */ }
                }
            }
        });
        collector.on("end", async (_, reason) => {
            if (reason !== "done" && reason !== "unknown_interaction" && reason !== "error") {
                try {
                    await interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle("⏰ Sessione scaduta")
                                .setDescription(`Tutte le modifiche fatte finora restano salvate.\n\n**Configurazione attuale:**\n${summarize(config, guild)}\n\nUsa \`/impostazioni\` per continuare a modificare.`)
                                .setColor(0xffaa00),
                        ],
                        components: [],
                    });
                }
                catch { /* il messaggio potrebbe non esistere più */ }
            }
        });
    }
    catch (error) {
        logger.error({ err: error }, "ERRORE COMANDO /IMPOSTAZIONI");
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: "❌ Si è verificato un errore. Riprova più tardi.", flags: MessageFlags.Ephemeral });
            }
            else {
                await interaction.editReply({ content: "❌ Si è verificato un errore. Riprova più tardi.", embeds: [], components: [] });
            }
        }
        catch { /* nothing we can do */ }
    }
}
//# sourceMappingURL=impostazioni.js.map