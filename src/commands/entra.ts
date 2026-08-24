import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
  GuildMember,
} from "discord.js";
import { joinVoiceChannelManual } from "../utils/tts.js";
import { logger } from "../utils/logger.js";

export const data = new SlashCommandBuilder()
  .setName("entra")
  .setDescription("Fa entrare Hermes nel tuo canale vocale attuale");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const member = interaction.member as GuildMember;
  const voiceChannelId = member.voice.channelId;

  if (!voiceChannelId) {
    await interaction.editReply({ content: "❌ Devi essere in un canale vocale per usare questo comando." });
    return;
  }

  try {
    await joinVoiceChannelManual(interaction.guildId!, voiceChannelId, interaction.client);
    await interaction.editReply({ content: `✅ Sono entrato in <#${voiceChannelId}>.` });
  } catch (err) {
    logger.error({ err, guildId: interaction.guildId, voiceChannelId }, "/entra: errore durante la connessione");
    await interaction.editReply({ content: "❌ Non sono riuscito a entrare nel canale vocale. Riprova tra poco." });
  }
}
