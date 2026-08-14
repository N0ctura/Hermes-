import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags,
  type Guild,
  type GuildMember,
  type Role,
} from "discord.js";
import { normalize } from "../utils/normalize.js";
import { DEFAULT_THRESHOLD_TIERS, loadConfig } from "../utils/storage.js";
import { TEMPLE_DEFINITIONS, resolveTempleRoles, isTempleMemberRole } from "../utils/temples.js";

const FAMILY_MENU_ID = "family_view";
const EMBED_COLOR = 0x8b0000;

type FamilyView =
  | { type: "overview" }
  | { type: "all-members" }
  | { type: "pilgrims" }
  | { type: "temple"; templeKey: string };

type TempleData = {
  key: string;
  label: string;
  role: Role | null;
  coLeaders: GuildMember[];
  members: GuildMember[];
};

type SectionData = {
  name: string;
  lines: string[];
  emptyText: string;
};

export const data = new SlashCommandBuilder()
  .setName("family")
  .setDescription("Mostra membri, pellegrini e composizione dei templi")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

function getTierForMember(member: GuildMember): { name: string; xpRequired: number } | null {
  for (const tier of DEFAULT_THRESHOLD_TIERS) {
    if (tier.roleIds.some((roleId) => member.roles.cache.has(roleId))) {
      return { name: tier.name, xpRequired: tier.xpRequired };
    }
  }

  return null;
}

function compareMembers(a: GuildMember, b: GuildMember): number {
  const tierA = getTierForMember(a)?.xpRequired ?? -1;
  const tierB = getTierForMember(b)?.xpRequired ?? -1;
  if (tierA !== tierB) return tierB - tierA;
  return a.displayName.localeCompare(b.displayName, "it");
}

function formatMemberLine(member: GuildMember): string {
  const tier = getTierForMember(member);
  return `• <@${member.id}> — ${tier?.name ?? "Nessuna soglia"}`;
}

function chunkLines(lines: string[], maxLength = 1000): string[] {
  if (lines.length === 0) return [];

  const chunks: string[] = [];
  let current = "";

  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length > maxLength && current) {
      chunks.push(current);
      current = line;
    } else if (line.length > maxLength) {
      chunks.push(line.slice(0, maxLength - 1) + "…");
      current = "";
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function buildEmbeds(title: string, description: string, sections: SectionData[]): EmbedBuilder[] {
  const embeds: EmbedBuilder[] = [];
  let embed = new EmbedBuilder().setColor(EMBED_COLOR).setTitle(title).setDescription(description);
  let fieldCount = 0;

  for (const section of sections) {
    const lines = section.lines.length > 0 ? section.lines : [section.emptyText];
    const chunks = chunkLines(lines);

    chunks.forEach((chunk, index) => {
      if (fieldCount === 25) {
        embeds.push(embed);
        embed = new EmbedBuilder().setColor(EMBED_COLOR).setTitle(`${title} (cont.)`);
        fieldCount = 0;
      }

      embed.addFields({
        name: index === 0 ? section.name : `${section.name} (cont.)`,
        value: chunk,
        inline: false,
      });
      fieldCount++;
    });
  }

  embeds.push(embed);
  return embeds;
}

function buildTempleData(guild: Guild, humans: GuildMember[]): TempleData[] {
  const templeRoles = resolveTempleRoles(guild);

  return TEMPLE_DEFINITIONS.map((definition) => {
    const templeRole = templeRoles.get(definition.key) ?? null;
    const coLeaderRoleIds = guild.roles.cache
      .filter((role) =>
        definition.coLeaderRoleNames.some((coLeaderRoleName) => normalize(role.name) === normalize(coLeaderRoleName))
      )
      .map((role) => role.id);

    const membersInTemple = humans
      .filter((member) => member.roles.cache.some((role) => isTempleMemberRole(role, definition)))
      .sort(compareMembers);

    const coLeaderIdSet = new Set(
      membersInTemple
        .filter((member) => coLeaderRoleIds.some((roleId) => member.roles.cache.has(roleId)))
        .map((member) => member.id)
    );

    const coLeaders = membersInTemple.filter((member) => coLeaderIdSet.has(member.id));
    const members = membersInTemple.filter((member) => !coLeaderIdSet.has(member.id));

    return {
      key: definition.key,
      label: templeRole?.name ?? definition.displayName,
      role: templeRole,
      coLeaders,
      members,
    };
  }).filter((temple) => temple.role || temple.coLeaders.length > 0 || temple.members.length > 0);
}

function buildMenuRow(temples: TempleData[]): ActionRowBuilder<StringSelectMenuBuilder> {
  const templeOptions = temples.slice(0, 22).map((temple) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(temple.label.slice(0, 100))
      .setValue(`temple:${temple.key}`)
      .setDescription(
        `${temple.coLeaders.length} co capi, ${temple.members.length} membri`.slice(0, 100)
      )
  );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(FAMILY_MENU_ID)
      .setPlaceholder("Scegli la lista da visualizzare…")
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Panoramica")
          .setValue("overview")
          .setDescription("Conteggi generali del server"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Tutti i membri")
          .setValue("all-members")
          .setDescription("Membri normali con soglia XP"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Pellegrini")
          .setValue("pilgrims")
          .setDescription("Ospiti con ruolo pellegrini"),
        ...templeOptions
      )
  );
}

function buildOverviewEmbeds(humans: GuildMember[], pilgrims: GuildMember[], temples: TempleData[]): EmbedBuilder[] {
  const members = humans.filter((member) => !pilgrims.some((pilgrim) => pilgrim.id === member.id));
  const templeLines = temples.map(
    (temple) => `• **${temple.label}** — ${temple.coLeaders.length} co capi, ${temple.members.length} membri`
  );

  return buildEmbeds(
    "Family",
    [
      `**Totale persone:** ${humans.length}`,
      `**Membri normali:** ${members.length}`,
      `**Pellegrini:** ${pilgrims.length}`,
      `**Templi rilevati:** ${temples.length}`,
      `**Ruolo pellegrini:** ${loadConfig().pilgrimRoleName ? `@${loadConfig().pilgrimRoleName}` : "non configurato"}`,
      "",
      "Usa il menu qui sotto per aprire la lista che ti serve.",
    ].join("\n"),
    [
      {
        name: "Templi",
        lines: templeLines,
        emptyText: "Nessun tempio rilevato.",
      },
    ]
  );
}

function buildMembersEmbeds(humans: GuildMember[], pilgrims: GuildMember[]): EmbedBuilder[] {
  const pilgrimIds = new Set(pilgrims.map((member) => member.id));
  const members = humans.filter((member) => !pilgrimIds.has(member.id)).sort(compareMembers);

  return buildEmbeds(
    "Family — Tutti i membri",
    [
      `**Totale persone nel server:** ${humans.length}`,
      `**Membri normali:** ${members.length}`,
      `**Pellegrini:** ${pilgrims.length}`,
    ].join("\n"),
    [
      {
        name: "Lista membri",
        lines: members.map(formatMemberLine),
        emptyText: "Nessun membro trovato.",
      },
    ]
  );
}

function buildPilgrimsEmbeds(pilgrims: GuildMember[], pilgrimRoleName?: string): EmbedBuilder[] {
  const sortedPilgrims = [...pilgrims].sort(compareMembers);

  return buildEmbeds(
    "Family — Pellegrini",
    [
      `**Ruolo pellegrini:** ${pilgrimRoleName ? `@${pilgrimRoleName}` : "non configurato"}`,
      `**Totale pellegrini:** ${sortedPilgrims.length}`,
    ].join("\n"),
    [
      {
        name: "Lista pellegrini",
        lines: sortedPilgrims.map(formatMemberLine),
        emptyText: "Nessun pellegrino trovato.",
      },
    ]
  );
}

function buildTempleEmbeds(temple: TempleData): EmbedBuilder[] {
  return buildEmbeds(
    `Family — ${temple.label}`,
    [
      `**Tempio:** ${temple.label}`,
      `**Co capi:** ${temple.coLeaders.length}`,
      `**Membri:** ${temple.members.length}`,
      `**Totale tempio:** ${temple.coLeaders.length + temple.members.length}`,
    ].join("\n"),
    [
      {
        name: "Co capi del tempio",
        lines: temple.coLeaders.map(formatMemberLine),
        emptyText: "Nessun co capo rilevato.",
      },
      {
        name: "Membri del tempio",
        lines: temple.members.map(formatMemberLine),
        emptyText: "Nessun membro rilevato.",
      },
    ]
  );
}

function parseView(value: string): FamilyView {
  if (value === "all-members") return { type: "all-members" };
  if (value === "pilgrims") return { type: "pilgrims" };
  if (value.startsWith("temple:")) return { type: "temple", templeKey: value.slice("temple:".length) };
  return { type: "overview" };
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: "❌ Questo comando funziona solo in un server.", flags: "Ephemeral" });
    return;
  }

  await interaction.deferReply({ flags: "Ephemeral" });

  try {
    await guild.members.fetch();
  } catch {
    await interaction.editReply(
      "❌ Impossibile fetchare i membri. Controlla che l'intent **GuildMembers** sia attivo nel Developer Portal del bot."
    );
    return;
  }

  const config = loadConfig();
  const humans = guild.members.cache.filter((member) => !member.user.bot).toJSON();
  const temples = buildTempleData(guild, humans);
  const templeMemberIds = new Set(
    temples.flatMap((temple) => [...temple.coLeaders, ...temple.members].map((member) => member.id))
  );
  const pilgrimRole = config.pilgrimRoleId ? guild.roles.cache.get(config.pilgrimRoleId) : null;
  const pilgrims = pilgrimRole
    ? humans
      .filter((member) => member.roles.cache.has(pilgrimRole.id) && !templeMemberIds.has(member.id))
      .sort(compareMembers)
    : [];
  const menuRow = buildMenuRow(temples);

  const overviewEmbeds = buildOverviewEmbeds(humans, pilgrims, temples);
  await interaction.editReply({ embeds: overviewEmbeds, components: [menuRow] });

  const reply = await interaction.fetchReply();
  const collector = reply.createMessageComponentCollector({
    filter: (componentInteraction) =>
      componentInteraction.user.id === interaction.user.id &&
      componentInteraction.isStringSelectMenu() &&
      componentInteraction.customId === FAMILY_MENU_ID,
    time: 300_000,
  });

  collector.on("collect", async (componentInteraction) => {
    if (!componentInteraction.isStringSelectMenu()) return;
    const view = parseView(componentInteraction.values[0] ?? "overview");

    if (view.type === "all-members") {
      await componentInteraction.update({
        embeds: buildMembersEmbeds(humans, pilgrims),
        components: [menuRow],
      });
      return;
    }

    if (view.type === "pilgrims") {
      await componentInteraction.update({
        embeds: buildPilgrimsEmbeds(pilgrims, pilgrimRole?.name ?? config.pilgrimRoleName),
        components: [menuRow],
      });
      return;
    }

    if (view.type === "temple") {
      const temple = temples.find((entry) => entry.key === view.templeKey);
      if (!temple) {
        await componentInteraction.update({
          embeds: buildOverviewEmbeds(humans, pilgrims, temples),
          components: [menuRow],
        });
        return;
      }

      await componentInteraction.update({
        embeds: buildTempleEmbeds(temple),
        components: [menuRow],
      });
      return;
    }

    await componentInteraction.update({
      embeds: buildOverviewEmbeds(humans, pilgrims, temples),
      components: [menuRow],
    });
  });

  collector.on("end", async () => {
    try {
      await interaction.editReply({ components: [] });
    } catch {
    }
  });
}
