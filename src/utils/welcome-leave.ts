import { GuildMember, AttachmentBuilder } from "discord.js";
import { logger } from "./logger.js";
import { loadConfig, type CardConfig } from "./storage.js";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  GlobalFonts.registerFromPath(
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "WelcomeFont"
  );
} catch {
  try {
    GlobalFonts.registerFromPath("C:\\Windows\\Fonts\\arialbd.ttf", "WelcomeFont");
  } catch {}
}

export function replaceVariables(text: string, member: GuildMember): string {
  return text
    .replace(/{user}/g, member.toString())
    .replace(/{username}/g, member.user.username)
    .replace(/{guild}/g, member.guild.name)
    .replace(/{memberCount}/g, member.guild.memberCount.toString());
}

export function getDefaultWelcomeCard(): CardConfig {
  return {
    width: 800,
    height: 400,
    layers: [
      {
        id: "bg",
        type: "background",
        visible: true,
        x: 0,
        y: 0,
        width: 800,
        height: 400,
        url: ""
      },
      {
        id: "avatar",
        type: "avatar",
        visible: true,
        x: 320,
        y: 50,
        width: 160,
        height: 160,
        borderWidth: 4,
        borderColor: "#ffffff",
        borderRadius: 50
      },
      {
        id: "title",
        type: "text",
        visible: true,
        x: 400,
        y: 250,
        width: 800,
        height: 50,
        text: "Benvenuto {username}!",
        fontSize: 36,
        fontWeight: "bold",
        color: "#ffffff",
        textAlign: "center"
      },
      {
        id: "subtitle",
        type: "text",
        visible: true,
        x: 400,
        y: 300,
        width: 800,
        height: 40,
        text: "Sei il {memberCount}° membro di {guild}!",
        fontSize: 24,
        fontWeight: "normal",
        color: "#ffffff",
        textAlign: "center"
      }
    ]
  };
}

export function getDefaultLeaveCard(): CardConfig {
  const defaultCard = getDefaultWelcomeCard();
  defaultCard.layers.forEach(layer => {
    if (layer.type === "background") {
      layer.grayscale = true;
    }
  });
  const titleLayer = defaultCard.layers.find(l => l.id === "title");
  if (titleLayer) titleLayer.text = "Arrivederci {username}!";
  const subtitleLayer = defaultCard.layers.find(l => l.id === "subtitle");
  if (subtitleLayer) subtitleLayer.text = "Ci mancherai!";
  return defaultCard;
}

async function renderCard(
  member: GuildMember,
  cardConfig: CardConfig | undefined,
  isLeave: boolean = false
): Promise<Buffer> {
  const config = cardConfig || (isLeave ? getDefaultLeaveCard() : getDefaultWelcomeCard());
  const canvas = createCanvas(config.width, config.height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#202225";
  ctx.fillRect(0, 0, config.width, config.height);

  for (const layer of config.layers) {
    if (!layer.visible) continue;

    ctx.save();

    switch (layer.type) {
      case "background":
      case "image":
        if (layer.url) {
          try {
            let img: any;

            if (layer.url.startsWith("data:")) {
              const base64Data = layer.url.split(",")[1];
              const buffer = Buffer.from(base64Data, "base64");
              img = await loadImage(buffer);
            }
            else if (layer.url.startsWith("/")) {
              const filename = layer.url.substring(1);
              const localPath = path.join(process.cwd(), "assets", filename);
              if (fs.existsSync(localPath)) {
                const buffer = fs.readFileSync(localPath);
                img = await loadImage(buffer);
              } else {
                const altFilename = filename.replace("-", " ");
                const altLocalPath = path.join(process.cwd(), "assets", altFilename);
                if (fs.existsSync(altLocalPath)) {
                  const buffer = fs.readFileSync(altLocalPath);
                  img = await loadImage(buffer);
                } else {
                  throw new Error("Local file not found");
                }
              }
            }
            else {
              const bgResponse = await fetch(layer.url);
              const bgBuffer = Buffer.from(await bgResponse.arrayBuffer());
              img = await loadImage(bgBuffer);
            }

            ctx.drawImage(img, layer.x, layer.y, layer.width, layer.height);

            if (layer.grayscale || isLeave) {
              const imageData = ctx.getImageData(layer.x, layer.y, layer.width, layer.height);
              const data = imageData.data;
              for (let i = 0; i < data.length; i += 4) {
                const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                data[i] = gray;
                data[i + 1] = gray;
                data[i + 2] = gray;
              }
              ctx.putImageData(imageData, layer.x, layer.y);
            }
          } catch (err) {
            logger.error({ err, url: layer.url }, "Failed to load background image");
            const gradient = ctx.createLinearGradient(layer.x, layer.y, layer.x + layer.width, layer.y + layer.height);
            if (isLeave) {
              gradient.addColorStop(0, "#2c2f33");
              gradient.addColorStop(1, "#23272a");
            } else {
              gradient.addColorStop(0, "#5865F2");
              gradient.addColorStop(1, "#57F287");
            }
            ctx.fillStyle = gradient;
            ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
          }
        } else {
          const gradient = ctx.createLinearGradient(layer.x, layer.y, layer.x + layer.width, layer.y + layer.height);
          if (isLeave) {
            gradient.addColorStop(0, "#2c2f33");
            gradient.addColorStop(1, "#23272a");
          } else {
            gradient.addColorStop(0, "#5865F2");
            gradient.addColorStop(1, "#57F287");
          }
          ctx.fillStyle = gradient;
          ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
        }
        break;

      case "avatar":
        try {
          const avatarUrl = member.user.displayAvatarURL({ extension: "png", size: 256 });
          const avatarResponse = await fetch(avatarUrl);
          const avatarBuffer = Buffer.from(await avatarResponse.arrayBuffer());
          const avatar = await loadImage(avatarBuffer);

          const radius = (layer.borderRadius || 50) * Math.min(layer.width, layer.height) / 200;
          ctx.beginPath();
          ctx.arc(layer.x + layer.width / 2, layer.y + layer.height / 2, radius, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();

          ctx.drawImage(avatar, layer.x, layer.y, layer.width, layer.height);

          ctx.restore();
          ctx.save();

          if (layer.borderWidth && layer.borderWidth > 0) {
            ctx.strokeStyle = layer.borderColor || "#ffffff";
            ctx.lineWidth = layer.borderWidth;
            ctx.beginPath();
            ctx.arc(layer.x + layer.width / 2, layer.y + layer.height / 2, radius - layer.borderWidth / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.stroke();
          }

          if (isLeave) {
            const imageData = ctx.getImageData(layer.x, layer.y, layer.width, layer.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
              const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
              data[i] = gray;
              data[i + 1] = gray;
              data[i + 2] = gray;
            }
            ctx.putImageData(imageData, layer.x, layer.y);
          }
        } catch (err) {
          logger.error({ err }, "Error loading avatar");
        }
        break;

      case "text":
        ctx.fillStyle = layer.color || "#ffffff";
        ctx.font = `${layer.fontWeight || "normal"} ${layer.fontSize || 24}px WelcomeFont, Arial, sans-serif`;
        ctx.textAlign = layer.textAlign || "center";
        ctx.textBaseline = "middle";

        const processedText = replaceVariables(layer.text || "", member);

        if (layer.textAlign === "center") {
          ctx.fillText(processedText, layer.x + layer.width / 2, layer.y + layer.height / 2);
        } else if (layer.textAlign === "right") {
          ctx.fillText(processedText, layer.x + layer.width, layer.y + layer.height / 2);
        } else {
          ctx.fillText(processedText, layer.x, layer.y + layer.height / 2);
        }
        break;
    }

    ctx.restore();
  }

  return canvas.toBuffer("image/png");
}

export async function handleMemberJoin(member: GuildMember): Promise<void> {
  const config = loadConfig();
  const guildConfig = config.welcomeLeaveConfigs?.find(c => c.guildId === member.guild.id);

  if (guildConfig?.autoroleEnabled && guildConfig.autoroleRoleIds && guildConfig.autoroleRoleIds.length > 0) {
    try {
      await member.roles.add(guildConfig.autoroleRoleIds);
      logger.info({ guildId: member.guild.id, userId: member.id, roleIds: guildConfig.autoroleRoleIds }, "Autorole assigned");
    } catch (err) {
      logger.error({ err, guildId: member.guild.id, userId: member.id, roleIds: guildConfig.autoroleRoleIds }, "Error assigning autorole");
    }
  }

  if (!guildConfig?.welcomeEnabled || !guildConfig.welcomeChannelId) return;

  try {
    const channel = await member.guild.channels.fetch(guildConfig.welcomeChannelId);
    if (!channel?.isTextBased()) return;

    const messageContent = guildConfig.welcomeMessage ? replaceVariables(guildConfig.welcomeMessage, member) : "";

    let files: any[] = [];
    try {
      const cardBuffer = await renderCard(member, guildConfig.welcomeCard, false);
      const attachment = new AttachmentBuilder(cardBuffer, { name: "welcome-card.png" });
      files.push(attachment);
    } catch (err) {
      logger.error({ err, guildId: member.guild.id }, "Error creating welcome card");
    }

    const messagePayload: any = {};
    if (messageContent) messagePayload.content = messageContent;
    if (files.length > 0) messagePayload.files = files;

    if (Object.keys(messagePayload).length > 0) {
      await channel.send(messagePayload);
      logger.info({ guildId: member.guild.id, userId: member.id }, "Welcome message sent");
    }
  } catch (err) {
    logger.error({ err, guildId: member.guild.id }, "Error sending welcome message");
  }
}

export async function handleMemberLeave(member: GuildMember): Promise<void> {
  const config = loadConfig();
  const guildConfig = config.welcomeLeaveConfigs?.find(c => c.guildId === member.guild.id);
  if (!guildConfig?.leaveEnabled || !guildConfig.leaveChannelId) return;

  try {
    const channel = await member.guild.channels.fetch(guildConfig.leaveChannelId);
    if (!channel?.isTextBased()) return;

    const messageContent = guildConfig.leaveMessage ? replaceVariables(guildConfig.leaveMessage, member) : "";

    let files: any[] = [];
    try {
      const cardBuffer = await renderCard(member, guildConfig.leaveCard, true);
      const attachment = new AttachmentBuilder(cardBuffer, { name: "leave-card.png" });
      files.push(attachment);
    } catch (err) {
      logger.error({ err, guildId: member.guild.id }, "Error creating leave card");
    }

    const messagePayload: any = {};
    if (messageContent) messagePayload.content = messageContent;
    if (files.length > 0) messagePayload.files = files;

    if (Object.keys(messagePayload).length > 0) {
      await channel.send(messagePayload);
      logger.info({ guildId: member.guild.id, userId: member.id }, "Leave message sent");
    }
  } catch (err) {
    logger.error({ err, guildId: member.guild.id }, "Error sending leave message");
  }
}
