import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
} from "discord.js";
import { loadConfig, saveConfig } from "../utils/storage.js";

export const data = new SlashCommandBuilder()
  .setName("donazioni")
  .setDescription("Attiva/disattiva il tracciamento donazioni clan Wolvesville")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub.setName("attiva").setDescription("Attiva il tracciamento donazioni")
  )
  .addSubcommand((sub) =>
    sub.setName("disattiva").setDescription("Disattiva il tracciamento donazioni")
  )
  .addSubcommand((sub) =>
    sub
      .setName("fallback")
      .setDescription("Imposta il canale dove notificare donazioni di membri senza tempio")
      .addChannelOption((opt) =>
        opt
          .setName("canale")
          .setDescription("Canale di fallback")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) => sub.setName("stato").setDescription("Mostra lo stato attuale del tracciamento"));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();
  const config = loadConfig();
  const tracking = config.donationTracking ?? { enabled: false, recentEventIds: [] };

  if (sub === "attiva") {
    saveConfig({ ...config, donationTracking: { ...tracking, enabled: true } });
    await interaction.reply({
      content: "✅ Tracciamento donazioni **attivato**. Primo controllo entro 60 secondi.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === "disattiva") {
    saveConfig({ ...config, donationTracking: { ...tracking, enabled: false } });
    await interaction.reply({ content: "⏸️ Tracciamento donazioni **disattivato**.", flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === "fallback") {
    const channel = interaction.options.getChannel("canale", true);
    saveConfig({ ...config, donationTracking: { ...tracking, fallbackChannelId: channel.id } });
    await interaction.reply({
      content: `✅ Canale di fallback impostato su <#${channel.id}>.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // stato
  const statusText = tracking.enabled ? "🟢 Attivo" : "🔴 Disattivo";
  const lastCheck = tracking.lastProcessedAt
    ? `<t:${Math.floor(new Date(tracking.lastProcessedAt).getTime() / 1000)}:R>`
    : "mai";
  const fallback = tracking.fallbackChannelId ? `<#${tracking.fallbackChannelId}>` : "non impostato";

  await interaction.reply({
    content: [
      `**Tracciamento donazioni:** ${statusText}`,
      `**Ultimo controllo processato:** ${lastCheck}`,
      `**Canale fallback:** ${fallback}`,
    ].join("\n"),
    flags: MessageFlags.Ephemeral,
  });
}
