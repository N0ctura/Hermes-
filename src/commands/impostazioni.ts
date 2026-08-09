import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  ChannelType,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type TextChannel,
} from "discord.js";
import { logger } from "../utils/logger.js";
import { loadConfig, saveConfig, DEFAULT_MESSAGES, type BotMessages } from "../utils/storage.js";

export const data = new SlashCommandBuilder()
  .setName("impostazioni")
  .setDescription("Configura il bot: canale sondaggi, notifiche, durata, ruoli e messaggi")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const DURATION_OPTIONS = [
  { label: "12 ore", value: "12" },
  { label: "24 ore (1 giorno)", value: "24" },
  { label: "36 ore", value: "36" },
  { label: "48 ore (2 giorni)", value: "48" },
  { label: "72 ore (3 giorni)", value: "72" },
  { label: "96 ore (4 giorni)", value: "96" },
  { label: "120 ore (5 giorni)", value: "120" },
  { label: "168 ore (7 giorni)", value: "168" },
  { label: "Nessun timer", value: "0" },
];

const MESSAGE_KEYS: Array<{ key: keyof BotMessages; label: string; emoji: string; hint: string }> = [
  {
    key: "missioneVinta",
    label: "Missione vinta",
    emoji: "🏆",
    hint: "Variabile: {missione}",
  },
  {
    key: "pareggio",
    label: "Pareggio",
    emoji: "⚖️",
    hint: "Variabile: {missioni}",
  },
  {
    key: "nessunVoto",
    label: "Nessun voto",
    emoji: "🗳️",
    hint: "Nessuna variabile disponibile",
  },
  {
    key: "rimescolo",
    label: "Rimescolo",
    emoji: "🔀",
    hint: "Nessuna variabile disponibile",
  },
];

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: "❌ Questo comando funziona solo in un server.", ephemeral: true });
      return;
    }

    const config = loadConfig();

    const showCurrentConfig = () => {
      const validNotifyChannelIds = (config.notifyChannelIds ?? []).filter((channelId) => guild.channels.cache.has(channelId));
      const validPollChannelId = config.pollChannelId && guild.channels.cache.has(config.pollChannelId)
        ? config.pollChannelId
        : null;
      const validPingRoleId = config.pingRoleId && guild.roles.cache.has(config.pingRoleId)
        ? config.pingRoleId
        : undefined;
      const validPilgrimRoleId = config.pilgrimRoleId && guild.roles.cache.has(config.pilgrimRoleId)
        ? config.pilgrimRoleId
        : undefined;
      const durLabel =
        config.pollDurationHours && config.pollDurationHours > 0
          ? `${config.pollDurationHours} ore`
          : "Nessun timer";
      const pollChannelMention = validPollChannelId ? `<#${validPollChannelId}>` : "❌ non impostato";
      const notifyChannelsMention = validNotifyChannelIds.length > 0
        ? validNotifyChannelIds.map(id => `<#${id}>`).join(", ")
        : "❌ nessuno";
      const pingRoleMention = validPingRoleId ? `<@&${validPingRoleId}>` : "❌ non impostato";
      const pilgrimRoleMention = validPilgrimRoleId ? `<@&${validPilgrimRoleId}>` : "❌ non impostato";
      return [
        `📊 **Canale sondaggi:** ${pollChannelMention}`,
        `🔔 **Canali notifica:** ${notifyChannelsMention}`,
        `⏱️ **Durata sondaggio:** ${durLabel}`,
        `🔔 **Ruolo da pingare:** ${pingRoleMention}`,
        `🚶 **Ruolo pellegrini:** ${pilgrimRoleMention}`,
      ].join("\n");
    };

    const pollSelectRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId("select_poll_channel")
        .setPlaceholder("Scegli il canale per i sondaggi…")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    );

    const notifySelectRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId("select_notify_channels")
        .setPlaceholder("Scegli i canali per le notifiche… (max 10)")
        .setMinValues(1)
        .setMaxValues(10)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    );

    const durationSelectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("select_duration")
        .setPlaceholder("Scegli la durata del sondaggio…")
        .addOptions(
          DURATION_OPTIONS.map((o) =>
            new StringSelectMenuOptionBuilder().setLabel(o.label).setValue(o.value)
          )
        )
    );

    const roleSelectRow = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId("select_role")
        .setPlaceholder("Scegli il ruolo da pingare alla chiusura…")
    );

    const pilgrimRoleSelectRow = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId("select_pilgrim_role")
        .setPlaceholder("Scegli il ruolo usato per i pellegrini…")
    );

    const buildMessageButtons = () =>
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...MESSAGE_KEYS.map((m) =>
          new ButtonBuilder()
            .setCustomId(`msg_${m.key}`)
            .setLabel(`${m.emoji} ${m.label}`)
            .setStyle(ButtonStyle.Secondary)
        ),
        new ButtonBuilder()
          .setCustomId("msg_done")
          .setLabel("✅ Fine")
          .setStyle(ButtonStyle.Success)
      );

    const buildStep6Embed = () => {
      const msgs = { ...DEFAULT_MESSAGES, ...config.messages };
      const lines = MESSAGE_KEYS.map(
        (m) => `${m.emoji} **${m.label}:**\n> ${msgs[m.key].slice(0, 100)}${msgs[m.key].length > 100 ? "…" : ""}`
      );
      return new EmbedBuilder()
        .setTitle("⚙️ Impostazioni — Passo 6/6: Messaggi")
        .setDescription(
          "Personalizza i messaggi che il bot invia.\n\n" +
          lines.join("\n\n") +
          "\n\nClicca un pulsante per modificare il testo. Premi **Fine** quando hai finito."
        )
        .setColor(0x8b0000);
    };

    const embed = new EmbedBuilder()
      .setTitle("⚙️ Impostazioni Bot Wolvesville")
      .setDescription(
        `**Configurazione attuale:**\n${showCurrentConfig()}\n\n` +
        "**Passo 1/6:** Scegli il canale dove appariranno i sondaggi.\n\n" +
        "⏳ Hai 2 minuti per completare ogni passaggio."
      )
      .setColor(0x8b0000)
      .setFooter({ text: "Solo gli admin possono usare questo comando" });

    await interaction.reply({ embeds: [embed], components: [pollSelectRow], ephemeral: true });

    let step = 1;

    const reply = await interaction.fetchReply();
    const collector = reply.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 300_000,
    });

    collector.on("collect", async (i) => {
      if (i.isChannelSelectMenu()) {
        if (i.customId === "select_poll_channel" && step === 1) {
          config.pollChannelId = i.values[0] ?? null;
          step = 2;
          const pollChannelMention = config.pollChannelId ? `<#${config.pollChannelId}>` : "";
          await i.update({
            embeds: [
              new EmbedBuilder()
                .setTitle("⚙️ Impostazioni — Passo 2/6")
                .setDescription(
                  `✅ Canale sondaggi: ${pollChannelMention}\n\n` +
                  "Scegli i canali dove mandare la notifica quando escono nuovi sondaggi.\n" +
                  "Puoi selezionarne più d'uno."
                )
                .setColor(0x8b0000),
            ],
            components: [notifySelectRow],
          });

        } else if (i.customId === "select_notify_channels" && step === 2) {
          config.notifyChannelIds = i.values;
          step = 3;
          const notifyChannelsMention = config.notifyChannelIds.map(id => `<#${id}>`).join(", ");
          await i.update({
            embeds: [
              new EmbedBuilder()
                .setTitle("⚙️ Impostazioni — Passo 3/6")
                .setDescription(
                  `✅ Canali notifica: **${notifyChannelsMention}**\n\n` +
                  "Per quanto tempo deve restare aperto il sondaggio prima di chiudersi automaticamente?\n" +
                  "Scegli **Nessun timer** per disabilitare la chiusura automatica."
                )
                .setColor(0x8b0000),
            ],
            components: [durationSelectRow],
          });
        }
      } else if (i.isRoleSelectMenu()) {
        if (i.customId === "select_role" && step === 4) {
          config.pingRoleId = i.values[0];
          step = 5;
          const pingRoleMention = config.pingRoleId ? `<@&${config.pingRoleId}>` : "";
          await i.update({
            embeds: [
              new EmbedBuilder()
                .setTitle("⚙️ Impostazioni — Passo 5/6")
                .setDescription(
                  `✅ Ruolo da pingare: ${pingRoleMention}\n\n` +
                  "Quale ruolo identifica i pellegrini/ospiti nel server?"
                )
                .setColor(0x8b0000),
            ],
            components: [pilgrimRoleSelectRow],
          });
        } else if (i.customId === "select_pilgrim_role" && step === 5) {
          config.pilgrimRoleId = i.values[0];
          step = 6;
          saveConfig(config);
          await i.update({ embeds: [buildStep6Embed()], components: [buildMessageButtons()] });
        }
      } else if (i.isStringSelectMenu()) {
        if (i.customId === "select_duration" && step === 3) {
          config.pollDurationHours = parseInt(i.values[0] ?? "0", 10);
          step = 4;

          const durLabel = config.pollDurationHours > 0 ? `${config.pollDurationHours} ore` : "Nessun timer";
          await i.update({
            embeds: [
              new EmbedBuilder()
                .setTitle("⚙️ Impostazioni — Passo 4/6")
                .setDescription(
                  `✅ Durata sondaggio: **${durLabel}**\n\n` +
                  "Quale ruolo deve essere menzionato quando i sondaggi si chiudono?"
                )
                .setColor(0x8b0000),
            ],
            components: [roleSelectRow],
          });
        }

      } else if (i.isButton() && step === 6) {
        if (i.customId === "msg_done") {
          collector.stop("done");
          await i.update({
            embeds: [
              new EmbedBuilder()
                .setTitle("✅ Impostazioni salvate!")
                .setDescription(
                  `**Configurazione aggiornata:**\n${showCurrentConfig()}\n\n` +
                  "Il bot è pronto! Usa `/sondaggio` per creare un nuovo sondaggio missione."
                )
                .setColor(0x00aa44),
            ],
            components: [],
          });
          return;
        }

        const msgKey = i.customId.replace("msg_", "") as keyof BotMessages;
        const msgMeta = MESSAGE_KEYS.find((m) => m.key === msgKey);
        if (!msgMeta) return;

        const currentText = config.messages?.[msgKey] ?? DEFAULT_MESSAGES[msgKey];

        const modal = new ModalBuilder()
          .setCustomId(`modal_${msgKey}`)
          .setTitle(`${msgMeta.emoji} ${msgMeta.label}`);

        const textInput = new TextInputBuilder()
          .setCustomId("message_text")
          .setLabel(msgMeta.hint)
          .setStyle(TextInputStyle.Paragraph)
          .setValue(currentText)
          .setMaxLength(500)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(textInput));

        await i.showModal(modal);

        try {
          const submitted = await i.awaitModalSubmit({
            filter: (m) => m.user.id === interaction.user.id && m.customId === `modal_${msgKey}`,
            time: 120_000,
          });

          const newText = submitted.fields.getTextInputValue("message_text").trim();
          if (!config.messages) config.messages = {};
          config.messages[msgKey] = newText;
          saveConfig(config);

          await (submitted as any).update({ embeds: [buildStep6Embed()], components: [buildMessageButtons()] });
        } catch {
          try { await interaction.editReply({ embeds: [buildStep6Embed()], components: [buildMessageButtons()] }); } catch { /* ignorato */ }
        }
      }
    });

    collector.on("end", async (_, reason) => {
      if (reason !== "done") {
        try {
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle("⏰ Tempo scaduto")
                .setDescription("Le impostazioni non sono state salvate completamente. Usa `/impostazioni` per riprovare.")
                .setColor(0xffaa00),
            ],
            components: [],
          });
        } catch { /* message might be gone */ }
      }
    });

  } catch (error) {
    logger.error({ err: error }, "ERRORE COMANDO /IMPOSTAZIONI");
    console.error("ERROR IN /IMPOSTAZIONI:", error);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Si è verificato un errore. Riprova più tardi.",
          ephemeral: true
        });
      } else {
        await interaction.editReply({
          content: "❌ Si è verificato un errore. Riprova più tardi.",
          embeds: [],
          components: []
        });
      }
    } catch { /* nothing we can do */ }
  }
}
