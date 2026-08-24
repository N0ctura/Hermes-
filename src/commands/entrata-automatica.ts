import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import { getTTSConfig, setTTSConfig } from "../utils/tts.js";

export const data = new SlashCommandBuilder()
  .setName("entrata-automatica")
  .setDescription("Attiva o disattiva l'ingresso automatico in vocale quando scrivi nella sua chat")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) =>
    option
      .setName("stato")
      .setDescription("on per attivare, off per disattivare")
      .setRequired(true)
      .addChoices(
        { name: "on", value: "on" },
        { name: "off", value: "off" }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const stato = interaction.options.getString("stato", true);
  const enabled = stato === "on";

  const current = getTTSConfig(interaction.guildId!);
  setTTSConfig({
    ...current,
    guildName: interaction.guild?.name || current.guildName,
    ttsAutoJoinEnabled: enabled,
  });

  await interaction.editReply({
    content: enabled
      ? "✅ Entrata automatica **attivata**: scrivendo nella chat del tuo canale vocale, Hermes entrerà e leggerà i messaggi."
      : "✅ Entrata automatica **disattivata**: Hermes non entrerà più da solo scrivendo nella chat vocale. Usa /entra oppure i prefissi configurati.",
  });
}
