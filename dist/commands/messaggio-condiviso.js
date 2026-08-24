import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ModalBuilder, PermissionFlagsBits, SlashCommandBuilder, TextInputBuilder, TextInputStyle, } from "discord.js";
const EDIT_BUTTON_PREFIX = "sharedmsg:edit";
const EDIT_MODAL_PREFIX = "sharedmsg:modal";
const EDIT_TEXT_INPUT_ID = "shared_message_content";
const pendingEditMappings = new Map();
export const data = new SlashCommandBuilder()
    .setName("messaggio-condiviso")
    .setDescription("Invia un messaggio del bot modificabile da tutti gli amministratori")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) => opt
    .setName("testo")
    .setDescription("Testo iniziale del messaggio")
    .setRequired(true)
    .setMaxLength(2000));
function isAdmin(interaction) {
    return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
}
function buildButtonCustomId(channelId, messageId) {
    return `${EDIT_BUTTON_PREFIX}:${channelId}:${messageId}`;
}
function buildModalCustomId(channelId, messageId, nonce) {
    return `${EDIT_MODAL_PREFIX}:${channelId}:${messageId}:${nonce}`;
}
function buildEditButtonRow(channelId, messageId) {
    return new ActionRowBuilder().addComponents(new ButtonBuilder()
        .setCustomId(buildButtonCustomId(channelId, messageId))
        .setLabel("Modifica")
        .setStyle(ButtonStyle.Secondary));
}
function parseTargetFromCustomId(customId, prefix) {
    if (!customId.startsWith(`${prefix}:`))
        return null;
    const [, , channelId, messageId, nonce] = customId.split(":");
    if (!channelId || !messageId)
        return null;
    return { channelId, messageId, nonce };
}
function uniquePlaceholder(base, replacements) {
    if (!replacements[base])
        return base;
    let index = 2;
    while (replacements[`${base} (${index})`])
        index++;
    return `${base} (${index})`;
}
function applyReplacements(content, replacements) {
    let nextContent = content;
    for (const [from, to] of Object.entries(replacements)) {
        nextContent = nextContent.split(from).join(to);
    }
    return nextContent;
}
function toEditableText(content, interaction) {
    const guild = interaction.guild;
    if (!guild)
        return { text: content, replacements: {} };
    const replacements = {};
    let editableText = content;
    editableText = editableText.replace(/<@!?(\d+)>/g, (full, userId) => {
        const member = guild.members.cache.get(userId);
        const base = `@${member?.displayName ?? member?.user.username ?? "sconosciuto"}`;
        const placeholder = uniquePlaceholder(base, replacements);
        replacements[placeholder] = full;
        return placeholder;
    });
    editableText = editableText.replace(/<@&(\d+)>/g, (full, roleId) => {
        const role = guild.roles.cache.get(roleId);
        const base = `@${role?.name ?? "sconosciuto"}`;
        const placeholder = uniquePlaceholder(base, replacements);
        replacements[placeholder] = full;
        return placeholder;
    });
    editableText = editableText.replace(/<#(\d+)>/g, (full, channelId) => {
        const channel = guild.channels.cache.get(channelId);
        const base = `#${channel?.name ?? "sconosciuto"}`;
        const placeholder = uniquePlaceholder(base, replacements);
        replacements[placeholder] = full;
        return placeholder;
    });
    return { text: editableText, replacements };
}
async function fetchTargetMessage(interaction, channelId, messageId) {
    const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased())
        return null;
    const textChannel = channel;
    const message = await textChannel.messages.fetch(messageId).catch(() => null);
    if (!message || message.author.id !== interaction.client.user?.id)
        return null;
    return { channel: textChannel, message };
}
export async function execute(interaction) {
    const testo = interaction.options.getString("testo", true);
    const channel = interaction.channel;
    if (!channel?.isTextBased()) {
        await interaction.reply({
            content: "❌ Questo comando può essere usato solo in un canale testuale.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    const sentMessage = await channel.send({ content: testo });
    await sentMessage.edit({
        components: [buildEditButtonRow(channel.id, sentMessage.id)],
    });
    await interaction.reply({
        content: `✅ Messaggio condiviso inviato in <#${channel.id}>.`,
        flags: MessageFlags.Ephemeral,
    });
}
export async function handleButtonInteraction(interaction) {
    const target = parseTargetFromCustomId(interaction.customId, EDIT_BUTTON_PREFIX);
    if (!target)
        return;
    if (!isAdmin(interaction)) {
        await interaction.reply({
            content: "❌ Solo gli amministratori possono modificare questo messaggio.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    const targetMessage = await fetchTargetMessage(interaction, target.channelId, target.messageId);
    if (!targetMessage) {
        await interaction.reply({
            content: "❌ Messaggio non trovato o non più modificabile.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    const nonce = `${interaction.user.id}-${Date.now()}`;
    const modalCustomId = buildModalCustomId(target.channelId, target.messageId, nonce);
    const { text: editableText, replacements } = toEditableText(targetMessage.message.content || "", interaction);
    pendingEditMappings.set(modalCustomId, replacements);
    const modal = new ModalBuilder()
        .setCustomId(modalCustomId)
        .setTitle("Modifica Messaggio");
    const textInput = new TextInputBuilder()
        .setCustomId(EDIT_TEXT_INPUT_ID)
        .setLabel("Nuovo testo")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(2000)
        .setValue(editableText);
    modal.addComponents(new ActionRowBuilder().addComponents(textInput));
    await interaction.showModal(modal);
}
export async function handleModalSubmit(interaction) {
    const target = parseTargetFromCustomId(interaction.customId, EDIT_MODAL_PREFIX);
    if (!target)
        return;
    if (!isAdmin(interaction)) {
        await interaction.reply({
            content: "❌ Solo gli amministratori possono modificare questo messaggio.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    const targetMessage = await fetchTargetMessage(interaction, target.channelId, target.messageId);
    if (!targetMessage) {
        await interaction.reply({
            content: "❌ Messaggio non trovato o non più modificabile.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    const replacements = pendingEditMappings.get(interaction.customId) ?? {};
    pendingEditMappings.delete(interaction.customId);
    const newText = applyReplacements(interaction.fields.getTextInputValue(EDIT_TEXT_INPUT_ID).trim(), replacements);
    await targetMessage.message.edit({
        content: newText,
        components: [buildEditButtonRow(target.channelId, target.messageId)],
    });
    await interaction.reply({
        content: "✅ Messaggio aggiornato.",
        flags: MessageFlags.Ephemeral,
    });
}
//# sourceMappingURL=messaggio-condiviso.js.map