import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { normalize } from "../utils/normalize.js";
import { loadConfig, saveConfig, THRESHOLD_ROLE_ID_SET, DEFAULT_THRESHOLD_TIERS } from "../utils/storage.js";

export const data = new SlashCommandBuilder()
  .setName("debug-templi")
  .setDescription("Mostra il match ruoli↔canali e aggiorna l'archivio ruoli (solo admin)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  if (!guild) { await interaction.editReply("❌ Solo in un server."); return; }

  try { await guild.members.fetch(); } catch {
    await interaction.editReply("❌ Impossibile fetchare i membri — controlla che l'intent **GuildMembers** sia abilitato nel Developer Portal del bot.");
    return;
  }

  const channelByNorm = new Map<string, string>();
  for (const [, ch] of guild.channels.cache) {
    if (ch.isTextBased() && !ch.isThread()) {
      channelByNorm.set(normalize(ch.name), ch.name);
    }
  }

  const roles = guild.roles.cache.filter((r) => r.name !== "@everyone");

  const templeRoleNames: string[] = [];
  const thresholdRoleNames: string[] = [];
  const leaderRoleNames: string[] = [];

  for (const [, role] of roles) {
    const normRole = normalize(role.name);
    if (channelByNorm.has(normRole)) {
      templeRoleNames.push(role.name);
    } else if (THRESHOLD_ROLE_ID_SET.has(role.id)) {
      thresholdRoleNames.push(role.name);
    } else {
      leaderRoleNames.push(role.name);
    }
  }

  const config = loadConfig();
  config.templeRoleNames = templeRoleNames;
  config.thresholdRoleNames = thresholdRoleNames;
  config.leaderRoleNames = leaderRoleNames;
  saveConfig(config);

  const lines: string[] = [
    `**🔍 Debug riepilogo templi**`,
    `Canali testo trovati: **${channelByNorm.size}**`,
    `Ruoli totali: **${roles.size}** (escluso @everyone)`,
    ``,
    `**🏛️ Ruoli-Tempio (hanno canale corrispondente):**`,
  ];

  let matchCount = 0;
  for (const [, role] of roles) {
    const normRole = normalize(role.name);
    const matchedChannel = channelByNorm.get(normRole);
    if (matchedChannel) {
      lines.push(`✅ \`${role.name}\`  →  #${matchedChannel}  (${role.members.size} membri)`);
      matchCount++;
    }
  }
  if (matchCount === 0) lines.push("❌ Nessun match trovato.");

  lines.push(``, `**👑 Ruoli co-capi / admin (non sono soglie note):**`);
  if (leaderRoleNames.length > 0) {
    for (const n of leaderRoleNames) lines.push(`• \`${n}\``);
  } else {
    lines.push("Nessuno.");
  }

  lines.push(``, `**⭐ Ruoli soglia XP (identificati tramite ID):**`);
  for (const tier of DEFAULT_THRESHOLD_TIERS) {
    const found = tier.roleIds.filter((id) => guild.roles.cache.has(id));
    if (found.length > 0) {
      const names = found.map((id) => guild.roles.cache.get(id)?.name ?? id).join(", ");
      lines.push(`• **${tier.name}** (${tier.xpRequired.toLocaleString("it-IT")} XP): ${names}`);
    }
  }
  if (thresholdRoleNames.length === 0) lines.push("Nessun ruolo soglia trovato nel server.");

  lines.push(
    ``,
    `**Totale match ruolo↔canale: ${matchCount}**`,
    `✅ Archivio ruoli aggiornato nella config.`
  );

  if (matchCount === 0) {
    lines.push(
      ``,
      `⚠️ **Nessun match trovato.** Entrambi i nomi (ruolo e canale) vengono normalizzati prima del confronto: minuscolo, no accenti, no emoji, caratteri bold Unicode → ASCII.`,
      `Esempio atteso: ruolo \`♢🔱𝐓𝐞𝐦𝐩𝐢𝐨-𝐝𝐞𝐠𝐥𝐢-𝐀𝐛𝐢𝐬𝐬𝐢\` → canale \`#tempio-degli-abissi\` (entrambi → \`tempioabissi\`)`
    );
  }

  const text = lines.join("\n");
  if (text.length <= 2000) {
    await interaction.editReply({ content: text });
  } else {
    const chunks: string[] = [];
    let chunk = "";
    for (const line of lines) {
      if (chunk.length + line.length + 1 > 1990) { chunks.push(chunk); chunk = ""; }
      chunk += (chunk ? "\n" : "") + line;
    }
    if (chunk) chunks.push(chunk);
    await interaction.editReply({ content: chunks[0] });
    for (const c of chunks.slice(1)) await interaction.followUp({ content: c, ephemeral: true });
  }
}
