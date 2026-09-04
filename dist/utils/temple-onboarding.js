import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, } from "discord.js";
import crypto from "node:crypto";
import { loadConfig, saveConfig } from "./storage.js";
import { TEMPLE_DEFINITIONS, countEffectiveTempleMembers } from "./temples.js";
import { logger } from "./logger.js";
export const TEMPLE_SELECT_PREFIX = "temple-onboarding:select:";
export const TEMPLE_APPROVE_PREFIX = "temple-onboarding:approve:";
export const TEMPLE_DENY_PREFIX = "temple-onboarding:deny:";
export const TEMPLE_OFFER_SEND_PREFIX = "temple-onboarding:offer-send:";
export const TEMPLE_OFFER_DENY_PREFIX = "temple-onboarding:offer-deny:";
const defaultTempleAssets = {
    rinascita: "/assets/tempio-rinascita.png",
    abisso: "/assets/tempio-abissi.png",
    eclissi: "/assets/tempio-eclissi.png",
    folgori: "/assets/tempio-folgori.png",
};
const defaultTempleGeneralMessage = "🎉 {USER} è entrato nel {TEMPLE}!";
const defaultSelectionMessage = `Eccoci, {USER}! 🏛️\n\nOra che sei giunto qui, ti chiedo di scegliere uno tra questi Templi, ognuno dei quali è governato da diversi Dei.\n\nIn base a quello che sceglierai, farai affidamento agli Dei del tuo Tempio, dai quali erediterai le loro maestose qualità e molto altro.\n\n**A te la scelta!**\n\n{TEMPLE_DETAILS}\n\n**Scegli con attenzione. Il Tempio che sceglierai sarà la tua nuova casa.**`;
const defaultForcedSelectionMessage = `Eccoci, {USER}! 🏛️\n\nPer mantenere l'equilibrio tra i quattro Templi, al momento solamente un Tempio è disponibile ad accoglierti.\n\n{TEMPLE_DETAILS}\n\n**La scelta è obbligata per mantenere l'equilibrio tra i Templi.**`;
const defaultModuleOfferMessage = `🛡️ **Nuovo ingresso**\n\n{USER} è appena entrato nel server.\n\nVuoi inviargli il modulo per la scelta del Tempio?`;
const defaultTempleDetails = {
    eclissi: `☀️🌙 **{TEMPLE}**\nGovernato da {GODS}\n→ caccia, luna, natura selvaggia e protezione; sole, musica, profezia e luce`,
    abisso: `🔱 **{TEMPLE}**\nGovernato da {GODS}\n→ mare, tempeste, terremoti e cavalli`,
    rinascita: `🐍🥀 **{TEMPLE}**\nGovernato da {GODS}\n→ agricoltura, stagioni, raccolto e rigenerazione`,
    folgori: `⚡ **{TEMPLE}**\nGovernato da {GODS}\n→ fulmini, cielo, giustizia, autorità e sovranità divina`,
};
function getConfig(guildId) {
    return loadConfig().templeOnboardingConfigs?.find((c) => c.guildId === guildId);
}
export function defaultTempleOnboardingConfig(guildId, guildName) {
    return {
        guildId,
        guildName,
        enabled: false,
        selectionMessage: defaultSelectionMessage,
        forcedSelectionMessage: defaultForcedSelectionMessage,
        moduleOfferMessage: defaultModuleOfferMessage,
        approvalMessage: "Nuova richiesta di ingresso al Tempio.",
        approvedGeneralMessage: "🎉 {USER} è entrato nel **{TEMPLE}**! Benvenuto/a nella famiglia!",
        approvedTempleMessage: "🏛️ Benvenuto/a {USER} nel **{TEMPLE}**!",
        sendGeneralMessage: true,
        sendTempleMessage: true,
        assignTempleRole: true,
        assignXpRole: false,
        fetchXpFromWolvesville: false,
        temples: TEMPLE_DEFINITIONS.map((d) => ({
            key: d.key,
            assetUrl: defaultTempleAssets[d.key],
            enabled: true,
            coLeaderRoleIds: [],
            godRoleIds: [],
            roleIds: [],
            selectionDescription: defaultTempleDetails[d.key],
            welcomeMessage: "🏛️ Benvenuto/a {USER} nel {TEMPLE}!",
            templeMessage: "Benvenuto/a {USER}! Ora fai ufficialmente parte del {TEMPLE}.",
            generalMessage: defaultTempleGeneralMessage,
            routineEnabled: false,
            routineMessage: "",
        })),
        requests: [],
    };
}
function persistConfig(next) {
    const cfg = loadConfig();
    const all = [...(cfg.templeOnboardingConfigs ?? [])];
    const idx = all.findIndex((c) => c.guildId === next.guildId);
    if (idx >= 0)
        all[idx] = next;
    else
        all.push(next);
    saveConfig({ ...cfg, templeOnboardingConfigs: all });
}
export function getTemplePopulationSnapshot(guild, config) {
    return TEMPLE_DEFINITIONS.map((definition) => {
        const tc = config.temples.find((t) => t.key === definition.key);
        const count = countEffectiveTempleMembers(guild, tc?.roleId, tc?.coLeaderRoleIds ?? []);
        return { key: definition.key, displayName: definition.displayName, count, enabled: tc?.enabled !== false, roleId: tc?.roleId };
    });
}
export function getSelectableTemples(guild, config) {
    const snapshot = getTemplePopulationSnapshot(guild, config).filter((x) => x.enabled && x.roleId);
    if (!snapshot.length)
        return [];
    const min = Math.min(...snapshot.map((x) => x.count));
    return snapshot.filter((x) => x.count === min);
}
function buildSelectionComponents(guild, config, memberId) {
    const selectable = getSelectableTemples(guild, config);
    const menu = new StringSelectMenuBuilder()
        .setCustomId(`${TEMPLE_SELECT_PREFIX}${guild.id}:${memberId}`)
        .setPlaceholder(selectable.length === 1 ? "L'unico Tempio disponibile" : "Scegli il tuo Tempio")
        .addOptions(selectable.map((t) => ({ label: t.displayName, value: t.key, description: `${t.count} membri effettivi`, emoji: "🏛️" })));
    return new ActionRowBuilder().addComponents(menu);
}
function roleMentions(guild, roleIds) {
    return (roleIds ?? []).map((id) => guild.roles.cache.has(id) ? `<@&${id}>` : null).filter(Boolean).join(" e ");
}
function buildTempleDetails(guild, config, selectableKeys) {
    return config.temples
        .filter((t) => selectableKeys.has(t.key))
        .map((t) => {
        const def = TEMPLE_DEFINITIONS.find((d) => d.key === t.key);
        const template = t.selectionDescription || defaultTempleDetails[t.key] || `🏛️ **{TEMPLE}**\nGovernato da {GODS}`;
        return template
            .replace(/\{TEMPLE\}/gi, def?.displayName ?? t.key)
            .replace(/\{GODS\}/gi, roleMentions(guild, t.godRoleIds));
    })
        .join("\n\n");
}
function buildSelectionMessage(template, member, details, min) {
    const hasDetailsPlaceholder = /\{TEMPLE_DETAILS\}/i.test(template);
    const replaced = replaceSelectionVariables(template, member, details, min);
    // La descrizione dei Templi deve comparire anche se l'amministratore ha
    // scritto un messaggio personalizzato senza inserire manualmente la variabile.
    // Se invece {TEMPLE_DETAILS} è presente, rispettiamo esattamente la posizione
    // scelta nella dashboard.
    return hasDetailsPlaceholder
        ? replaced
        : `${replaced.trim()}\n\n${details}`;
}
function replaceSelectionVariables(template, member, details, min) {
    return template
        .replace(/\{USER\}/gi, member.toString())
        .replace(/\{USERNAME\}/gi, member.displayName)
        .replace(/\{TEMPLE_DETAILS\}/gi, details)
        .replace(/\{MIN\}/gi, String(min));
}
function formatApprovalText(member, selected, snapshot) {
    const chosen = TEMPLE_DEFINITIONS.find((d) => d.key === selected)?.displayName ?? selected;
    const counts = snapshot.map((s) => `• ${s.displayName}: **${s.count}**`).join("\n");
    return `👤 **Nuova richiesta di ingresso**\n\n${member} — **${member.displayName}**\n🏛️ Tempio richiesto: **${chosen}**\n\n⚖️ **Popolazione effettiva**\n${counts}`;
}
export async function sendTempleModuleOffer(member) {
    const config = getConfig(member.guild.id);
    if (!config?.enabled || !config.approvalChannelId)
        return;
    const channel = await member.guild.channels.fetch(config.approvalChannelId).catch(() => null);
    if (!channel || !channel.isTextBased() || channel.isThread())
        return;
    const text = (config.moduleOfferMessage || defaultModuleOfferMessage).replace(/\{USER\}/gi, member.toString()).replace(/\{USERNAME\}/gi, member.displayName);
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`${TEMPLE_OFFER_SEND_PREFIX}${member.id}`).setLabel("Invia modulo").setEmoji("🏛️").setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(`${TEMPLE_OFFER_DENY_PREFIX}${member.id}`).setLabel("Non inviare").setEmoji("❌").setStyle(ButtonStyle.Secondary));
    await channel.send({ content: text, components: [row] }).catch((err) => logger.error({ err, guildId: member.guild.id, userId: member.id }, "Temple onboarding: invio offerta modulo fallito"));
}
export async function handleTempleModuleOffer(interaction, send) {
    const guild = interaction.guild;
    if (!guild)
        return;
    const config = getConfig(guild.id);
    if (!config?.enabled)
        return;
    const prefix = send ? TEMPLE_OFFER_SEND_PREFIX : TEMPLE_OFFER_DENY_PREFIX;
    const memberId = interaction.customId.slice(prefix.length);
    const resolver = interaction.member;
    const authorized = (config.approvalRoleIds ?? []).some((id) => resolver.roles.cache.has(id));
    if (!authorized) {
        await interaction.reply({ content: "⛔ Non hai un ruolo autorizzato a gestire l'onboarding dei Templi.", ephemeral: true });
        return;
    }
    const target = await guild.members.fetch(memberId).catch(() => null);
    if (!target) {
        await interaction.update({ content: "⚠️ Il nuovo membro non è più presente nel server.", components: [], embeds: interaction.message.embeds });
        return;
    }
    if (!send) {
        await interaction.update({ content: `❌ Modulo non inviato a ${target}.`, components: [], embeds: interaction.message.embeds });
        return;
    }
    const pending = (config.requests ?? []).some((r) => r.userId === target.id && r.status === "pending");
    if (pending) {
        await interaction.update({ content: `⏳ ${target} ha già una richiesta di Tempio in attesa.`, components: [], embeds: interaction.message.embeds });
        return;
    }
    const selectionChannel = config.selectionChannelId ? await guild.channels.fetch(config.selectionChannelId).catch(() => null) : null;
    if (!selectionChannel?.isTextBased() || selectionChannel.isThread()) {
        await interaction.reply({ content: "❌ Il canale del modulo Templi non è configurato correttamente nella dashboard.", ephemeral: true });
        return;
    }
    const selectable = getSelectableTemples(guild, config);
    if (!selectable.length) {
        await interaction.reply({ content: "❌ Non ci sono Templi configurati e disponibili.", ephemeral: true });
        return;
    }
    const details = buildTempleDetails(guild, config, new Set(selectable.map((x) => x.key)));
    const template = selectable.length === 1 ? (config.forcedSelectionMessage || defaultForcedSelectionMessage) : (config.selectionMessage || defaultSelectionMessage);
    const text = buildSelectionMessage(template, target, details, selectable[0]?.count ?? 0);
    await selectionChannel.send({ content: text, components: [buildSelectionComponents(guild, config, target.id)] }).catch((err) => logger.error({ err, guildId: guild.id, userId: target.id }, "Temple onboarding: invio modulo fallito"));
    await interaction.update({ content: `🏛️ Modulo per la scelta del Tempio inviato a ${target}.`, components: [], embeds: interaction.message.embeds });
}
export async function sendTempleSelection(member) {
    // Mantenuta come compatibilità per eventuali chiamanti esistenti: il modulo ora
    // viene inviato solo dopo l'approvazione dei co-capi tramite sendTempleModuleOffer.
    void member;
}
async function removeOtherTempleRoles(member, config, selectedKey) {
    const roleIds = config.temples.flatMap((t) => [t.roleId, ...(t.roleIds ?? [])]).filter((id) => Boolean(id));
    const selected = config.temples.find((t) => t.key === selectedKey);
    const selectedIds = new Set([selected?.roleId, ...(selected?.roleIds ?? [])].filter((id) => Boolean(id)));
    const toRemove = roleIds.filter((id) => !selectedIds.has(id) && member.roles.cache.has(id));
    if (toRemove.length)
        await member.roles.remove(toRemove, "Temple onboarding: pulizia ruoli altri Templi").catch(() => null);
}
async function addConfiguredTempleRoles(member, config, templeKey) {
    const temple = config.temples.find((t) => t.key === templeKey);
    if (!temple)
        throw new Error("Configurazione Tempio non trovata");
    const ids = [temple.roleId, ...(temple.roleIds ?? [])].filter((id) => Boolean(id));
    if (config.assignTempleRole !== false && !temple.roleId)
        throw new Error("Ruolo principale del Tempio non configurato");
    if (!ids.length)
        return [];
    const me = member.guild.members.me ?? await member.guild.members.fetchMe().catch(() => null);
    if (!me)
        throw new Error("Impossibile recuperare il membro Hermes");
    const roles = (await Promise.all(ids.map((id) => member.guild.roles.fetch(id).catch(() => null)))).filter((r) => Boolean(r));
    if (roles.length !== ids.length)
        throw new Error("Uno o più ruoli configurati non esistono più");
    for (const role of roles) {
        if (role.managed)
            throw new Error(`Il ruolo ${role.name} è gestito da un'integrazione`);
        if (role.position >= me.roles.highest.position)
            throw new Error(`Hermes non può assegnare ${role.name}: sposta il ruolo di Hermes sopra questo ruolo`);
    }
    await removeOtherTempleRoles(member, config, templeKey);
    await member.roles.add(roles, "Temple onboarding: ruoli Tempio autorizzati");
    return roles.map((r) => r.id);
}
export async function handleTempleSelection(interaction) {
    const guild = interaction.guild;
    if (!guild)
        return;
    const config = getConfig(guild.id);
    if (!config?.enabled)
        return;
    const [, , , expectedMemberId] = interaction.customId.split(":");
    if (interaction.user.id !== expectedMemberId) {
        await interaction.reply({ content: "⛔ Questo modulo è riservato al nuovo arrivato indicato nel messaggio.", ephemeral: true });
        return;
    }
    const key = interaction.values[0];
    const selectable = getSelectableTemples(guild, config);
    if (!selectable.some((t) => t.key === key)) {
        await interaction.reply({ content: "❌ Questo Tempio non è più selezionabile: l'equilibrio è cambiato. Chiedi ai co-capi di inviare un nuovo modulo.", ephemeral: true });
        return;
    }
    const existing = (config.requests ?? []).find((r) => r.userId === interaction.user.id && r.status === "pending");
    if (existing) {
        await interaction.reply({ content: "⏳ Hai già una richiesta di ingresso in attesa di approvazione.", ephemeral: true });
        return;
    }
    const request = { id: crypto.randomUUID(), guildId: guild.id, userId: interaction.user.id, username: interaction.user.username, templeKey: key, status: "pending", createdAt: new Date().toISOString() };
    config.requests = [...(config.requests ?? []), request].slice(-200);
    persistConfig(config);
    const approvalChannel = config.approvalChannelId ? await guild.channels.fetch(config.approvalChannelId).catch(() => null) : null;
    if (approvalChannel?.isTextBased() && !approvalChannel.isThread()) {
        const mentions = (config.approvalRoleIds ?? []).map((id) => `<@&${id}>`).join(" ");
        const embed = new EmbedBuilder().setTitle("🏛️ Richiesta ingresso Tempio").setDescription(formatApprovalText(interaction.member, key, getTemplePopulationSnapshot(guild, config))).setColor(0xc9a227).setTimestamp(new Date());
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`${TEMPLE_APPROVE_PREFIX}${request.id}`).setLabel("Autorizza").setEmoji("✅").setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`${TEMPLE_DENY_PREFIX}${request.id}`).setLabel("Nega").setEmoji("❌").setStyle(ButtonStyle.Danger));
        const sent = await approvalChannel.send({ content: mentions || undefined, embeds: [embed], components: [row], allowedMentions: { roles: config.approvalRoleIds ?? [] } }).catch(() => null);
        if (sent) {
            request.approvalMessageId = sent.id;
            request.approvalChannelId = approvalChannel.id;
            persistConfig(config);
        }
    }
    await interaction.reply({ content: `✅ Richiesta registrata per **${TEMPLE_DEFINITIONS.find((d) => d.key === key)?.displayName ?? key}**. Attendi l'autorizzazione dei co-capi.`, ephemeral: true });
}
function canResolve(member, config, request) {
    const global = new Set(config.approvalRoleIds ?? []);
    const temple = config.temples.find((t) => t.key === request.templeKey);
    for (const role of member.roles.cache.values())
        if (global.has(role.id) || (temple?.coLeaderRoleIds ?? []).includes(role.id))
            return true;
    return false;
}
function replaceMessage(template, member, templeName) {
    return template.replace(/\{USER\}/gi, member.toString()).replace(/\{USERNAME\}/gi, member.displayName).replace(/\{TEMPLE\}/gi, templeName);
}
export async function handleTempleApproval(interaction, approve) {
    const guild = interaction.guild;
    if (!guild)
        return;
    const config = getConfig(guild.id);
    if (!config?.enabled)
        return;
    const prefix = approve ? TEMPLE_APPROVE_PREFIX : TEMPLE_DENY_PREFIX;
    const requestId = interaction.customId.slice(prefix.length);
    const request = (config.requests ?? []).find((r) => r.id === requestId);
    if (!request || request.status !== "pending") {
        await interaction.reply({ content: "❌ Questa richiesta non è più disponibile.", ephemeral: true });
        return;
    }
    const resolver = interaction.member;
    if (!canResolve(resolver, config, request)) {
        await interaction.reply({ content: "⛔ Non hai un ruolo autorizzato a gestire questa richiesta.", ephemeral: true });
        return;
    }
    const target = await guild.members.fetch(request.userId).catch(() => null);
    if (!approve) {
        request.status = "denied";
        request.resolvedAt = new Date().toISOString();
        request.resolvedBy = interaction.user.id;
        persistConfig(config);
        await interaction.update({ content: "❌ **Richiesta negata.**", embeds: interaction.message.embeds, components: [] });
        return;
    }
    if (!target) {
        await interaction.update({ content: "⚠️ L'utente non è più presente nel server.", embeds: interaction.message.embeds, components: [] });
        return;
    }
    const currentSelectable = getSelectableTemples(guild, config);
    if (!currentSelectable.some((t) => t.key === request.templeKey)) {
        request.status = "denied";
        request.resolvedAt = new Date().toISOString();
        request.resolvedBy = interaction.user.id;
        persistConfig(config);
        await interaction.update({ content: "⚠️ La richiesta non può essere autorizzata perché nel frattempo l'equilibrio dei Templi è cambiato.", embeds: interaction.message.embeds, components: [] });
        return;
    }
    const temple = config.temples.find((t) => t.key === request.templeKey);
    if (!temple) {
        await interaction.reply({ content: "❌ Configurazione del Tempio non trovata.", ephemeral: true });
        return;
    }
    let assignedNames = [];
    try {
        assignedNames = await addConfiguredTempleRoles(target, config, request.templeKey);
    }
    catch (err) {
        logger.error({ err, guildId: guild.id, userId: target.id, templeKey: request.templeKey }, "Temple onboarding: impossibile assegnare i ruoli");
        await interaction.reply({ content: `❌ Non sono riuscito ad assegnare i ruoli del Tempio a ${target}. ${err instanceof Error ? err.message : "Controlla Gestisci Ruoli e la gerarchia dei ruoli di Hermes."}`, ephemeral: true });
        return;
    }
    request.status = "approved";
    request.resolvedAt = new Date().toISOString();
    request.resolvedBy = interaction.user.id;
    persistConfig(config);
    const templeName = TEMPLE_DEFINITIONS.find((d) => d.key === request.templeKey)?.displayName ?? request.templeKey;
    const tc = config.temples.find((t) => t.key === request.templeKey);
    const generalMessage = tc?.generalMessage && tc.generalMessage !== defaultTempleGeneralMessage ? tc.generalMessage : config.approvedGeneralMessage;
    if (config.sendGeneralMessage && config.generalChannelId)
        await sendToChannel(generalMessage, await guild.channels.fetch(config.generalChannelId).catch(() => null), target, templeName);
    if (config.sendTempleMessage && temple.channelId)
        await sendToChannel(tc?.templeMessage || config.approvedTempleMessage, await guild.channels.fetch(temple.channelId).catch(() => null), target, templeName);
    await interaction.update({ content: `✅ **Richiesta autorizzata** da ${interaction.user}.\n🏛️ ${target} ha ricevuto ${assignedNames.length} ruolo/i configurato/i.`, embeds: interaction.message.embeds, components: [] });
}
async function sendToChannel(template, channel, member, templeName) {
    if (!channel || !template)
        return;
    await channel.send(replaceMessage(template, member, templeName)).catch((err) => logger.error({ err, channelId: channel.id, userId: member.id }, "Temple onboarding: invio messaggio post-approvazione fallito"));
}
export function getTempleOnboardingConfig(guildId) { return getConfig(guildId); }
//# sourceMappingURL=temple-onboarding.js.map