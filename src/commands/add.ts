import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { loadConfig, saveConfig, type GuildBirthdayConfig, type BirthdayEntry } from "../utils/storage.js";
import { refreshBirthdayListMessage } from "../utils/birthday-list.js";

const MONTH_NAMES_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // febbraio permissivo (29)

export const data = new SlashCommandBuilder()
  .setName("add")
  .setDescription("Aggiungi informazioni al tuo profilo nel server")
  .addSubcommand((sub) =>
    sub
      .setName("compleanno")
      .setDescription("Aggiungi (o aggiorna) il tuo compleanno nella lista del server")
      .addIntegerOption((opt) =>
        opt.setName("giorno").setDescription("Giorno (1-31)").setMinValue(1).setMaxValue(31).setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt.setName("mese").setDescription("Mese (1-12)").setMinValue(1).setMaxValue(12).setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "Questo comando funziona solo in un server.", flags: MessageFlags.Ephemeral });
    return;
  }

  const sub = interaction.options.getSubcommand();
  if (sub !== "compleanno") return;

  const day = interaction.options.getInteger("giorno", true);
  const month = interaction.options.getInteger("mese", true);

  if (day > DAYS_IN_MONTH[month - 1]) {
    await interaction.reply({
      content: `⚠️ ${MONTH_NAMES_IT[month - 1]} non ha ${day} giorni. Controlla la data.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const guildId = interaction.guild.id;
  const guildName = interaction.guild.name;
  const config = loadConfig();

  const arr = config.birthdayConfigs ? [...config.birthdayConfigs] : [];
  const idx = arr.findIndex((c) => c.guildId === guildId);
  const guildConfig: GuildBirthdayConfig = idx >= 0 ? { ...arr[idx] } : { guildId, guildName, birthdays: [] };

  const displayName =
    interaction.member && "displayName" in interaction.member
      ? (interaction.member.displayName as string)
      : interaction.user.username;

  const entryIdx = guildConfig.birthdays.findIndex((b) => b.userId === interaction.user.id);
  const entry: BirthdayEntry = {
    userId: interaction.user.id,
    username: displayName,
    day,
    month,
    addedAt: new Date().toISOString(),
  };
  guildConfig.birthdays = [...guildConfig.birthdays];
  if (entryIdx >= 0) guildConfig.birthdays[entryIdx] = entry;
  else guildConfig.birthdays.push(entry);

  if (idx >= 0) arr[idx] = guildConfig;
  else arr.push(guildConfig);

  saveConfig({ ...config, birthdayConfigs: arr });

  await interaction.reply({
    content: `🎂 Compleanno impostato: **${day} ${MONTH_NAMES_IT[month - 1]}**! La lista compleanni si aggiornerà automaticamente.`,
    flags: MessageFlags.Ephemeral,
  });

  // Aggiorna subito il messaggio della lista, se un canale è già configurato.
  void refreshBirthdayListMessage(interaction.client, guildId);
}
