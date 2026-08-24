import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import { closePoll, cancelPollTimer } from "../utils/poll-timer.js";
import { loadConfig } from "../utils/storage.js";

export const data = new SlashCommandBuilder()
  .setName("fine")
  .setDescription("[TEST] Termina subito il sondaggio attivo e invia i riepiloghi")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const config = loadConfig();
  if (!config.activePoll) {
    await interaction.editReply({ content: "❌ Nessun sondaggio attivo da terminare." });
    return;
  }

  cancelPollTimer();
  await interaction.editReply({ content: "⏳ Chiusura sondaggio in corso..." });

  await closePoll(interaction.client);

  await interaction.editReply({ content: "✅ Sondaggio terminato! Riepiloghi inviati nei canali tempio." });
}
