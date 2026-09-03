import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  type ButtonInteraction,
  type Client,
  type Guild,
  type GuildMember,
  type StringSelectMenuInteraction,
  type TextChannel,
} from "discord.js";
import crypto from "node:crypto";
import { loadConfig, saveConfig, type GuildTempleOnboardingConfig, type TempleOnboardingRequest } from "./storage.js";
import { TEMPLE_DEFINITIONS, countEffectiveTempleMembers, templeIndexForKey } from "./temples.js";
import { logger } from "./logger.js";

export const TEMPLE_SELECT_PREFIX = "temple-onboarding:select:";
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
    assignXpRole: true,
    fetchXpFromWolvesville: true,
    temples: TEMPLE_DEFINITIONS.map((d) => ({
      key: d.key,
      assetUrl: defaultTempleAssets[d.key],
      enabled: true,
      coLeaderRoleIds: [],
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

function buildSelectionComponents(guild: Guild, config: GuildTempleOnboardingConfig) {
  const selectable = getSelectableTemples(guild, config);
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${TEMPLE_SELECT_PREFIX}${guild.id}`)
    .setPlaceholder(selectable.length === 1 ? "L'unico Tempio disponibile" : "Scegli il tuo Tempio")
    .addOptions(selectable.map((t) => ({ label: t.displayName, value: t.key, description: `${t.count} membri effettivi`, emoji: "🏛️" })));
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

function formatApprovalText(member: GuildMember, selected: string, snapshot: ReturnType<typeof getTemplePopulationSnapshot>): string {
  const chosen = TEMPLE_DEFINITIONS.find((d) => d.key === selected)?.displayName ?? selected;
  const counts = snapshot.map((s) => `• ${s.displayName}: **${s.count}**`).join("\n");
  return `👤 **Nuova richiesta di ingresso**\n\n${member} — **${member.displayName}**\n🏛️ Tempio richiesto: **${chosen}**\n\n⚖️ **Popolazione effettiva**\n${counts}`;
}

export async function sendTempleSelection(member: GuildMember): Promise<void> {
  const config = getConfig(member.guild.id);
  if (!config?.enabled || !config.selectionChannelId) return;
  const channel = await member.guild.channels.fetch(config.selectionChannelId).catch(() => null);
  if (!channel || !channel.isTextBased() || channel.isThread()) return;
  const selectable = getSelectableTemples(member.guild, config);
  if (!selectable.length) {
    await (channel as TextChannel).send("⚠️ Il sistema Templi è attivo ma non ci sono Templi configurati con un ruolo valido.").catch(() => null);
    return;
  }
  const text = config.selectionMessage
    ?.replace(/\{USER\}/gi, member.toString())
    .replace(/\{USERNAME\}/gi, member.displayName)
    .replace(/\{MIN\}/gi, String(selectable[0]?.count ?? 0))
    ?? "🏛️ Scegli il tuo Tempio.";
  await (channel as TextChannel).send({ content: text, components: [buildSelectionComponents(member.guild, config)] }).catch((err) => logger.error({ err, guildId: member.guild.id }, "Temple onboarding: invio selezione fallito"));
}

async function removeOtherTempleRoles(member: GuildMember, config: GuildTempleOnboardingConfig, selectedKey: string) {
  const roleIds = config.temples.map((t) => t.roleId).filter((id): id is string => Boolean(id));
  const toRemove = roleIds.filter((id) => id !== config.temples.find((t) => t.key === selectedKey)?.roleId && member.roles.cache.has(id));
  if (toRemove.length) await member.roles.remove(toRemove, "Temple onboarding: assegnazione tempio").catch(() => null);
}

export async function handleTempleSelection(interaction: StringSelectMenuInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  const config = getConfig(guild.id);
  if (!config?.enabled) return;
  const key = interaction.values[0];
  const selectable = getSelectableTemples(guild, config);
  if (!selectable.some((t) => t.key === key)) {
    await interaction.reply({ content: "❌ Questo Tempio non è più selezionabile: l'equilibrio è cambiato. Apri una nuova scelta.", ephemeral: true });
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
    const sent = await (approvalChannel as TextChannel).send({ content: mentions || undefined, embeds: [embed], components: [row], allowedMentions: { roles: config.approvalRoleIds ?? [] } }).catch(() => null);
    if (sent) {
      request.approvalMessageId = sent.id;
      request.approvalChannelId = approvalChannel.id;
      persistConfig(config);
    }
  }
  await interaction.reply({ content: `✅ Richiesta registrata per **${TEMPLE_DEFINITIONS.find((d) => d.key === key)?.displayName ?? key}**. Attendi l'autorizzazione dei co-capi.`, ephemeral: true });
}

function canResolve(member: GuildMember, config: GuildTempleOnboardingConfig, request: TempleOnboardingRequest): boolean {
  const global = new Set(config.approvalRoleIds ?? []);
  const temple = config.temples.find((t) => t.key === request.templeKey);
  for (const role of member.roles.cache.values()) if (global.has(role.id) || (temple?.coLeaderRoleIds ?? []).includes(role.id)) return true;
  return false;
}

function replaceMessage(template: string, member: GuildMember, templeName: string) {
  return template.replace(/\{USER\}/gi, member.toString()).replace(/\{USERNAME\}/gi, member.displayName).replace(/\{TEMPLE\}/gi, templeName);
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

  // Discord non permette al bot di assegnare ruoli uguali o superiori al proprio ruolo.
  // Recuperiamo il ruolo direttamente dalla cache/API e controlliamo la gerarchia prima
  // di chiudere la richiesta come approvata.
  if (config.assignTempleRole !== false) {
    if (!temple.roleId) {
      await interaction.reply({ content: "❌ Il ruolo di questo Tempio non è configurato nella dashboard.", ephemeral: true });
      return;
    }

    const templeRole = await guild.roles.fetch(temple.roleId).catch(() => null);
    if (!templeRole) {
      await interaction.reply({ content: "❌ Il ruolo configurato per questo Tempio non esiste più nel server.", ephemeral: true });
      return;
    }

    const me = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
    if (!me) {
      await interaction.reply({ content: "❌ Non riesco a verificare i permessi del bot.", ephemeral: true });
      return;
    }

    if (templeRole.managed) {
      await interaction.reply({ content: "❌ Il ruolo del Tempio è gestito da un'integrazione e non può essere assegnato da Hermes.", ephemeral: true });
      return;
    }

    if (templeRole.position >= me.roles.highest.position) {
      await interaction.reply({
        content: `❌ Hermes non può assegnare **${templeRole.name}** perché il suo ruolo è allo stesso livello o sotto il ruolo del Tempio. Sposta il ruolo di Hermes sopra quello del Tempio nella gerarchia Discord.`,
        ephemeral: true,
      });
      return;
    }

    try {
      await removeOtherTempleRoles(target, config, request.templeKey);
      if (!target.roles.cache.has(templeRole.id)) {
        await target.roles.add(templeRole, "Temple onboarding: tempio autorizzato");
      }
    } catch (err) {
      logger.error({ err, guildId: guild.id, userId: target.id, templeKey: request.templeKey, roleId: templeRole.id }, "Temple onboarding: impossibile assegnare il ruolo del Tempio");
      await interaction.reply({ content: `❌ Non sono riuscito ad assegnare **${templeRole.name}** a ${target}. Controlla la gerarchia dei ruoli e il permesso **Gestisci Ruoli** di Hermes.`, ephemeral: true });
      return;
    }
  }

  // La richiesta diventa APPROVED solo dopo che il ruolo del Tempio è stato assegnato.
  request.status = "approved";
  request.resolvedAt = new Date().toISOString();
  request.resolvedBy = interaction.user.id;
  persistConfig(config);

  const templeName = TEMPLE_DEFINITIONS.find((d) => d.key === request.templeKey)?.displayName ?? request.templeKey;
  const tc = templeMessageConfig(config, request.templeKey);

  // Il messaggio generale può essere personalizzato indipendentemente per ogni Tempio.
  const generalMessage = tc?.generalMessage && tc.generalMessage !== defaultTempleGeneralMessage
    ? tc.generalMessage
    : config.approvedGeneralMessage;
  if (config.sendGeneralMessage && config.generalChannelId) {
    await sendToChannel(
      guild,
      generalMessage,
      await guild.channels.fetch(config.generalChannelId).catch(() => null) as TextChannel | null,
      target,
      templeName
    );
  }

  if (config.sendTempleMessage && temple?.channelId) {
    await sendToChannel(
      guild,
      tc?.templeMessage || config.approvedTempleMessage,
      await guild.channels.fetch(temple.channelId).catch(() => null) as TextChannel | null,
      target,
      templeName
    );
  }

  await interaction.update({
    content: `✅ **Richiesta autorizzata** da ${interaction.user}.\n🏛️ Ruolo del Tempio assegnato a ${target}.`,
    embeds: interaction.message.embeds,
    components: [],
  });
}

function templeMessageConfig(config: GuildTempleOnboardingConfig, key: string) { return config.temples.find((t) => t.key === key); }

async function sendToChannel(_guild: Guild, template: string | undefined, channel: TextChannel | null | undefined, member: GuildMember, templeName: string) {
  if (!channel || !template) return;
  await channel.send(replaceMessage(template, member, templeName)).catch(() => null);
}

export function getTempleOnboardingConfig(guildId: string) { return getConfig(guildId); }
