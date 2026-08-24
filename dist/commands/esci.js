import { SlashCommandBuilder, MessageFlags, } from "discord.js";
import { stopTTS, isConnected } from "../utils/tts.js";
export const data = new SlashCommandBuilder()
    .setName("esci")
    .setDescription("Fa uscire Hermes dal canale vocale in cui si trova");
export async function execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!isConnected(interaction.guildId)) {
        await interaction.editReply({ content: "ℹ️ Non sono connesso a nessun canale vocale." });
        return;
    }
    stopTTS(interaction.guildId);
    await interaction.editReply({ content: "✅ Sono uscito dal canale vocale." });
}
//# sourceMappingURL=esci.js.map