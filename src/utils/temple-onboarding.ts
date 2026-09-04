import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  type ButtonInteraction,
  type Guild,
  type GuildMember,
  type StringSelectMenuInteraction,
  type TextChannel,
} from "discord.js";
import crypto from "node:crypto";
import { loadConfig, saveConfig, type GuildTempleOnboardingConfig, type TempleOnboardingRequest } from "./storage.js";
import { TEMPLE_DEFINITIONS, countEffectiveTempleMembers } from "./temples.js";
import { logger } from "./logger.js";

export const TEMPLE_SELECT_PREFIX = "temple-onboarding:select:";
export const TEMPLE_SEND_FORM_PREFIX = "temple-onboarding:send-form:";
export const TEMPLE_CANCEL_FORM_PREFIX = "temple-onboarding:cancel-form:";
export const TEMPLE_APPROVE_PREFIX = "temple-onboarding:approve:";
export const TEMPLE_DENY_PREFIX = "temple-onboarding:deny:";

const defaultTempleAssets: Record<string, string> = {
  rinascita: "/assets/tempio-rinascita.png",
  abisso: "/assets/tempio-abissi.png",
  eclissi: "/assets/tempio-eclissi.png",
  folgori: "/assets/tempio-folgori.png",
};
const defaultTempleGeneralMessage = "🎉 {USER} è entrato nel {TEMPLE}!";

function getConfig(guildId: string): GuildTempleOnboardingConfig | undefined {
  return loadConfig().templeOnboardingConfigs?.find((c) => c.guildId === guildId);
}

export function defaultTempleOnboardingConfig(guildId: string, guildName: string): GuildTempleOnboardingConfig {
  return {
    guildId,
    guildName,
    enabled: false,
    selectionMessage: "🏛️ **Benvenuto/a!**\nScegli il Tempio nel quale desideri entrare. La disponibilità segue l'equilibrio tra i quattro Templi.",
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
      roleIds: [],
      welcomeMessage: "🏛️ Benvenuto/a {USER} nel {TEMPLE}!",
      templeMessage: "Benvenuto/a {USER}! Ora fai ufficialmente parte del {TEMPLE}.",
      generalMessage: defaultTempleGeneralMessage,
      routineEnabled: false,
      routineMessage: "",
    })),
    requests: [],
  };
}

function persistConfig(next: GuildTempleOnboardingConfig): void {
  const cfg = loadConfig();
  const all = [...(cfg.templeOnboardingConfigs ?? [])];
  const idx = all.findIndex((c) => c.guildId === next.guildId);
  if (idx >= 0) all[idx] = next; else all.push(next);
  saveConfig({ ...cfg, templeOnboardingConfigs: all });
}

export function getTemplePopulationSnapshot(guild: Guild, config: GuildTempleOnboardingConfig) {
  return TEMPLE_DEFINITIONS.map((definition) => {
    const tc = config.temples.find((t) => t.key === definition.key);
    const count = countEffectiveTempleMembers(guild, tc?.roleId, tc?.coLeaderRoleIds ?? []);
    return { key: definition.key, displayName: definition.displayName, count, enabled: tc?.enabled !== false, roleId: tc?.roleId };
  });
}

export function getSelectableTemples(guild: Guild, config: GuildTempleOnboardingConfig) {
  const snapshot = getTemplePopulationSnapshot(guild, config).filter((x) => x.enabled && x.roleId);
  if (!snapshot.length) return [];
  const min = Math.min(...snapshot.map((x) => x.count));
  return snapshot.filter((x) => x.count === min);
}

function buildSelectionComponents(guild: Guild, config: GuildTempleOnboardingConfig, targetUserId: string) {
  const selectable = getSelectableTemples(guild, config);
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${TEMPLE_SELECT_PREFIX}${guild.id}:${targetUserId}`)
    .setPlaceholder(selectable.length === 1 ? "L'unico Tempio disponibile" : "Scegli il tuo Tempio")
    .addOptions(selectable.map((t) => ({ label: t.displayName, value: t.key, description: `${t.count} membri effettivi`, emoji: "🏛️" })));
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

function formatApprovalText(member: GuildMember, selected: string, snapshot: ReturnType<typeof getTemplePopulationSnapshot>): string {
  const chosen = TEMPLE_DEFINITIONS.find((d) => d.key === selected)?.displayName ?? selected;
  const counts = snapshot.map((s) => `• ${s.displayName}: **${s.count}**`).join("\n");
  return `👤 **Nuova richiesta di ingresso**\n\n${member} — **${member.displayName}**\n🏛️ Tempio richiesto: **${chosen}**\n\n⚖️ **Popolazione effettiva**\n${counts}`;
}

function canSendTempleForm(member: GuildMember, config: GuildTempleOnboardingConfig): boolean {
  const allowed = new Set(config.approvalRoleIds ?? []);
  if (!allowed.size) return false;
  return member.roles.cache.some((role) => allowed.has(role.id));
}

function replaceMessage(template: string, member: GuildMember, templeName: string) {
  return template
    .replace(/\{USER\}/gi, member.toString())
    .replace(/\{USERNAME\}/gi, member.displayName)
    .replace(/\{TEMPLE\}/gi, templeName);
}

async function sendToChannel(template: string | undefined, channel: TextChannel | null | undefined, member: GuildMember, templeName: string) {
  if (!channel || !template) return;
  await channel.send(replaceMessage(template, member, templeName)).catch((err) => logger.error({ err, channelId: channel.id, userId: member.id }, "Temple onboarding: invio messaggio fallito"));
}

/**
 * Dopo il welcome classico, chiede ai co-capi se vogliono inviare il modulo.
 * Il modulo NON viene più inviato automaticamente all'ingresso.
 */
export async function sendTempleFormConfirmation(member: GuildMember): Promise<void> {
  const config = getConfig(member.guild.id);
  if (!config?.enabled || !config.approvalChannelId || !config.selectionChannelId) return;

  // Il modulo viene proposto solo dopo il Welcome classico. Se il Welcome è disattivato
  // o non ha un canale configurato, non apriamo automaticamente l'onboarding Templi.
  const welcomeConfig = loadConfig().welcomeLeaveConfigs?.find((c) => c.guildId === member.guild.id);
  if (!welcomeConfig?.welcomeEnabled || !welcomeConfig.welcomeChannelId) return;

  const approvalChannel = await member.guild.channels.fetch(config.approvalChannelId).catch(() => null);
  if (!approvalChannel?.isTextBased() || approvalChannel.isThread()) return;

  const mentions = (config.approvalRoleIds ?? []).map((id) => `<@&${id}>`).join(" ");
  const embed = new EmbedBuilder()
    .setTitle("🏛️ Nuovo arrivo — modulo Templi")
    .setDescription(`👤 ${member} — **${member.displayName}**\n\nVuoi inviare a questo nuovo arrivato il modulo per la scelta del Tempio?`)
    .setColor(0xc9a227)
    .setTimestamp(new Date());
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`${TEMPLE_SEND_FORM_PREFIX}${member.id}`).setLabel("Invia modulo").setEmoji("📋").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`${TEMPLE_CANCEL_FORM_PREFIX}${member.id}`).setLabel("Non inviare").setEmoji("❌").setStyle(ButtonStyle.Secondary),
  );

  await (approvalChannel as TextChannel).send({
    content: mentions || undefined,
    embeds: [embed],
    components: [row],
    allowedMentions: { roles: config.approvalRoleIds ?? [] },
  }).catch((err) => logger.error({ err, guildId: member.guild.id, userId: member.id }, "Temple onboarding: invio conferma modulo fallito"));
}

export async function handleTempleFormConfirmation(interaction: ButtonInteraction, sendForm: boolean): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  const config = getConfig(guild.id);
  if (!config?.enabled) return;

  const prefix = sendForm ? TEMPLE_SEND_FORM_PREFIX : TEMPLE_CANCEL_FORM_PREFIX;
  const targetUserId = interaction.customId.slice(prefix.length);
  const resolver = interaction.member as GuildMember;
  if (!canSendTempleForm(resolver, config)) {
    await interaction.reply({ content: "⛔ Non hai un ruolo autorizzato a inviare il modulo Templi.", ephemeral: true });
    return;
  }

  const target = await guild.members.fetch(targetUserId).catch(() => null);
  if (!target) {
    await interaction.update({ content: "⚠️ Il nuovo arrivato non è più presente nel server.", embeds: interaction.message.embeds, components: [] });
    return;
  }

  if (!sendForm) {
    await interaction.update({ content: `❌ Modulo non inviato per ${target}.`, embeds: interaction.message.embeds, components: [] });
    return;
  }

  const selectable = getSelectableTemples(guild, config);
  if (!selectable.length) {
    await interaction.update({ content: "⚠️ Nessun Tempio è attualmente configurato come selezionabile.", embeds: interaction.message.embeds, components: [] });
    return;
  }

  const text = (config.selectionMessage || "🏛️ Scegli il tuo Tempio.")
    .replace(/\{USER\}/gi, target.toString())
    .replace(/\{USERNAME\}/gi, target.displayName)
    .replace(/\{MIN\}/gi, String(selectable[0]?.count ?? 0));

  const selectionChannel = await guild.channels.fetch(config.selectionChannelId!).catch(() => null);
  if (!selectionChannel?.isTextBased() || selectionChannel.isThread()) {
    await interaction.reply({ content: "❌ Il canale di selezione Templi non è valido.", ephemeral: true });
    return;
  }

  const sent = await (selectionChannel as TextChannel).send({ content: text, components: [buildSelectionComponents(guild, config, target.id)] }).catch((err) => {
    logger.error({ err, guildId: guild.id, userId: target.id }, "Temple onboarding: invio modulo fallito");
    return null;
  });
  if (!sent) {
    await interaction.reply({ content: "❌ Non sono riuscito a inviare il modulo.", ephemeral: true });
    return;
  }

  await interaction.update({ content: `✅ Modulo inviato a ${target}. Solo lui/lei può effettuare la scelta.`, embeds: interaction.message.embeds, components: [] });
}

export async function handleTempleSelection(interaction: StringSelectMenuInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  const config = getConfig(guild.id);
  if (!config?.enabled) return;

  const payload = interaction.customId.slice(TEMPLE_SELECT_PREFIX.length).split(":");
  const targetUserId = payload[1];
  if (!targetUserId || interaction.user.id !== targetUserId) {
    await interaction.reply({ content: "⛔ Questo modulo è riservato al nuovo arrivato indicato nel messaggio.", ephemeral: true });
    return;
  }

  const key = interaction.values[0];
  const selectable = getSelectableTemples(guild, config);
  if (!selectable.some((t) => t.key === key)) {
    await interaction.reply({ content: "❌ Questo Tempio non è più selezionabile: l'equilibrio è cambiato. Chiedi ai co-capi di reinviare il modulo.", ephemeral: true });
    return;
  }
  const existing = (config.requests ?? []).find((r) => r.userId === interaction.user.id && r.status === "pending");
  if (existing) {
    await interaction.reply({ content: "⏳ Hai già una richiesta di ingresso in attesa di approvazione.", ephemeral: true });
    return;
  }

  const request: TempleOnboardingRequest = {
    id: crypto.randomUUID(), guildId: guild.id, userId: interaction.user.id, username: interaction.user.username,
    templeKey: key, status: "pending", createdAt: new Date().toISOString(),
  };
  config.requests = [...(config.requests ?? []), request].slice(-200);
  persistConfig(config);

  const approvalChannel = config.approvalChannelId ? await guild.channels.fetch(config.approvalChannelId).catch(() => null) : null;
  if (approvalChannel?.isTextBased() && !approvalChannel.isThread()) {
    const mentions = (config.approvalRoleIds ?? []).map((id) => `<@&${id}>`).join(" ");
    const embed = new EmbedBuilder()
      .setTitle("🏛️ Richiesta ingresso Tempio")
      .setDescription(formatApprovalText(interaction.member as GuildMember, key, getTemplePopulationSnapshot(guild, config)))
      .setColor(0xc9a227)
      .setTimestamp(new Date());
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`${TEMPLE_APPROVE_PREFIX}${request.id}`).setLabel("Autorizza").setEmoji("✅").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`${TEMPLE_DENY_PREFIX}${request.id}`).setLabel("Nega").setEmoji("❌").setStyle(ButtonStyle.Danger),
    );
    const sent = await (approvalChannel as TextChannel).send({ content: mentions || undefined, embeds: [embed], components: [row], allowedMentions: { roles: config.approvalRoleIds ?? [] } }).catch((err) => {
      logger.error({ err, guildId: guild.id, userId: interaction.user.id }, "Temple onboarding: invio richiesta fallito");
      return null;
    });
    if (sent) {
      request.approvalMessageId = sent.id;
      request.approvalChannelId = approvalChannel.id;
      persistConfig(config);
    }
  }
  await interaction.update({ content: "✅ Scelta registrata. Ora attendi l'autorizzazione dei co-capi.", components: [] });
}

function canResolve(member: GuildMember, config: GuildTempleOnboardingConfig, request: TempleOnboardingRequest): boolean {
  const global = new Set(config.approvalRoleIds ?? []);
  const temple = config.temples.find((t) => t.key === request.templeKey);
  for (const role of member.roles.cache.values()) if (global.has(role.id) || (temple?.coLeaderRoleIds ?? []).includes(role.id)) return true;
  return false;
}

async function removeOtherTempleRoles(member: GuildMember, config: GuildTempleOnboardingConfig, selectedKey: string) {
  const selected = config.temples.find((t) => t.key === selectedKey);
  const allRoleIds = config.temples.flatMap((t) => [t.roleId, ...(t.roleIds ?? [])]).filter((id): id is string => Boolean(id));
  const selectedRoleIds = new Set([selected?.roleId, ...(selected?.roleIds ?? [])].filter((id): id is string => Boolean(id)));
  const toRemove = allRoleIds.filter((id) => !selectedRoleIds.has(id) && member.roles.cache.has(id));
  if (toRemove.length) await member.roles.remove(toRemove, "Temple onboarding: assegnazione tempio");
}

async function assignTempleRoles(target: GuildMember, config: GuildTempleOnboardingConfig, temple: NonNullable<GuildTempleOnboardingConfig["temples"]>[number]): Promise<string[]> {
  const roleIds = [temple.roleId, ...(temple.roleIds ?? [])].filter((id): id is string => Boolean(id));
  const uniqueRoleIds = [...new Set(roleIds)];
  if (!uniqueRoleIds.length) throw new Error("Nessun ruolo configurato per questo Tempio");

  const me = target.guild.members.me ?? await target.guild.members.fetchMe().catch(() => null);
  if (!me) throw new Error("Impossibile verificare il ruolo del bot");

  const roles = [];
  for (const id of uniqueRoleIds) {
    const role = await target.guild.roles.fetch(id).catch(() => null);
    if (!role) throw new Error(`Il ruolo ${id} non esiste più`);
    if (role.managed) throw new Error(`Il ruolo ${role.name} è gestito da un'integrazione`);
    if (role.position >= me.roles.highest.position) throw new Error(`Hermes non può assegnare il ruolo ${role.name}: sposta il ruolo di Hermes sopra di esso`);
    roles.push(role);
  }

  await removeOtherTempleRoles(target, config, temple.key);
  const missing = roles.filter((role) => !target.roles.cache.has(role.id));
  if (missing.length) await target.roles.add(missing, "Temple onboarding: ruoli Tempio autorizzati");
  return roles.map((r) => r.name);
}

export async function handleTempleApproval(interaction: ButtonInteraction, approve: boolean): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  const config = getConfig(guild.id);
  if (!config?.enabled) return;
  const prefix = approve ? TEMPLE_APPROVE_PREFIX : TEMPLE_DENY_PREFIX;
  const requestId = interaction.customId.slice(prefix.length);
  const request = (config.requests ?? []).find((r) => r.id === requestId);
  if (!request || request.status !== "pending") {
    await interaction.reply({ content: "❌ Questa richiesta non è più disponibile.", ephemeral: true });
    return;
  }
  const resolver = interaction.member as GuildMember;
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

  let assignedRoleNames: string[] = [];
  if (config.assignTempleRole !== false) {
    try {
      assignedRoleNames = await assignTempleRoles(target, config, temple);
    } catch (err) {
      logger.error({ err, guildId: guild.id, userId: target.id, templeKey: request.templeKey }, "Temple onboarding: impossibile assegnare i ruoli del Tempio");
      const message = err instanceof Error ? err.message : "errore sconosciuto";
      await interaction.reply({ content: `❌ Non sono riuscito ad assegnare i ruoli del Tempio. ${message}`, ephemeral: true });
      return;
    }
  }

  request.status = "approved";
  request.resolvedAt = new Date().toISOString();
  request.resolvedBy = interaction.user.id;
  persistConfig(config);

  const templeName = TEMPLE_DEFINITIONS.find((d) => d.key === request.templeKey)?.displayName ?? request.templeKey;
  const tc = config.temples.find((t) => t.key === request.templeKey);
  const specificGeneral = tc?.generalMessage?.trim();
  const generalMessage = specificGeneral && specificGeneral !== defaultTempleGeneralMessage ? specificGeneral : config.approvedGeneralMessage;

  if (config.sendGeneralMessage && config.generalChannelId) {
    await sendToChannel(generalMessage, await guild.channels.fetch(config.generalChannelId).catch(() => null) as TextChannel | null, target, templeName);
  }
  if (config.sendTempleMessage && temple?.channelId) {
    await sendToChannel(tc?.templeMessage?.trim() || config.approvedTempleMessage, await guild.channels.fetch(temple.channelId).catch(() => null) as TextChannel | null, target, templeName);
  }

  const rolesText = assignedRoleNames.length ? `\n🎖️ Ruoli assegnati: ${assignedRoleNames.map((n) => `**${n}**`).join(", ")}` : "";
  await interaction.update({ content: `✅ **Richiesta autorizzata** da ${interaction.user}.\n🏛️ ${target} è entrato nel **${templeName}**.${rolesText}`, embeds: interaction.message.embeds, components: [] });
}

export function getTempleOnboardingConfig(guildId: string) { return getConfig(guildId); }
