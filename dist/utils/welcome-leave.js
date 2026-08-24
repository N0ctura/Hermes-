import { AttachmentBuilder } from "discord.js";
import { logger } from "./logger.js";
import { loadConfig } from "./storage.js";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
try {
    GlobalFonts.registerFromPath("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "WelcomeFont");
}
catch {
    try {
        GlobalFonts.registerFromPath("C:\\Windows\\Fonts\\arialbd.ttf", "WelcomeFont");
    }
    catch { }
}
export function replaceVariables(text, member) {
    return text
        .replace(/{user}/gi, member.toString())
        .replace(/{username}/gi, member.user.username)
        .replace(/{guild}/gi, member.guild.name)
        .replace(/{memberCount}/gi, member.guild.memberCount.toString());
}
export function getDefaultWelcomeCard() {
    return {
        width: 1440,
        height: 720,
        layers: [
            {
                id: "bg",
                type: "background",
                visible: true,
                x: 0,
                y: 0,
                width: 1440,
                height: 720,
                url: "/assets/benvenutocelestial.png",
                color: "#1a1b1e",
                borderWidth: 0,
            },
            {
                id: "avatar",
                type: "avatar",
                visible: true,
                x: 116,
                y: 203,
                width: 314,
                height: 314,
                borderWidth: 8,
                borderColor: "#5865F2",
                borderRadius: 157,
            },
            {
                id: "title",
                type: "text",
                visible: true,
                x: 470,
                y: 250,
                width: 900,
                height: 80,
                text: "Benvenuto {username}!",
                fontSize: 60,
                fontWeight: "bold",
                color: "#ffffff",
                textAlign: "left",
            },
            {
                id: "subtitle",
                type: "text",
                visible: true,
                x: 470,
                y: 350,
                width: 900,
                height: 54,
                text: "Ora siamo in {memberCount} membri 🔥",
                fontSize: 32,
                fontWeight: "normal",
                color: "#d4d9e2",
                textAlign: "left",
            },
        ],
    };
}
export function getDefaultLeaveCard() {
    return {
        width: 1440,
        height: 720,
        layers: [
            {
                id: "bg",
                type: "background",
                visible: true,
                x: 0,
                y: 0,
                width: 1440,
                height: 720,
                url: "/assets/arrivedercicelestial.png",
                color: "#1a1b1e",
                borderWidth: 0,
                grayscale: false,
            },
            {
                id: "avatar",
                type: "avatar",
                visible: true,
                x: 116,
                y: 203,
                width: 314,
                height: 314,
                borderWidth: 8,
                borderColor: "#ed4245",
                borderRadius: 157,
            },
            {
                id: "title",
                type: "text",
                visible: true,
                x: 470,
                y: 250,
                width: 900,
                height: 80,
                text: "Arrivederci {username}!",
                fontSize: 60,
                fontWeight: "bold",
                color: "#ffffff",
                textAlign: "left",
            },
            {
                id: "subtitle",
                type: "text",
                visible: true,
                x: 470,
                y: 350,
                width: 900,
                height: 54,
                text: "Il clan ti ricorderà ❤️",
                fontSize: 32,
                fontWeight: "normal",
                color: "#d4d9e2",
                textAlign: "left",
            },
        ],
    };
}
async function renderCard(member, cardConfig, isLeave = false) {
    const config = cardConfig || (isLeave ? getDefaultLeaveCard() : getDefaultWelcomeCard());
    const canvas = createCanvas(config.width, config.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = config.layers[0]?.color || "#202225";
    ctx.fillRect(0, 0, config.width, config.height);
    function roundRectPath(x, y, w, h, r) {
        const radius = Math.max(0, Math.min(r, w / 2, h / 2));
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }
    function applyGrayscale(x, y, w, h) {
        try {
            const imageData = ctx.getImageData(x, y, w, h);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                data[i] = gray;
                data[i + 1] = gray;
                data[i + 2] = gray;
            }
            ctx.putImageData(imageData, x, y);
        }
        catch {
            /* getImageData può fallire in casi limiti; ignoriamo */
        }
    }
    function drawFallbackGradient(x, y, w, h, fallbackColor) {
        if (fallbackColor) {
            ctx.fillStyle = fallbackColor;
            ctx.fillRect(x, y, w, h);
            return;
        }
        const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
        if (isLeave) {
            gradient.addColorStop(0, "#2c2f33");
            gradient.addColorStop(1, "#23272a");
        }
        else {
            gradient.addColorStop(0, "#5865F2");
            gradient.addColorStop(1, "#57F287");
        }
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, w, h);
    }
    for (const layer of config.layers) {
        if (!layer.visible)
            continue;
        ctx.save();
        switch (layer.type) {
            case "background":
            case "image": {
                const radius = layer.borderRadius ?? 0;
                if (radius > 0) {
                    roundRectPath(layer.x, layer.y, layer.width, layer.height, radius);
                    ctx.clip();
                }
                if (layer.url) {
                    try {
                        let img;
                        if (layer.url.startsWith("data:")) {
                            const base64Data = layer.url.split(",")[1];
                            const buffer = Buffer.from(base64Data, "base64");
                            img = await loadImage(buffer);
                        }
                        else if (layer.url.startsWith("/")) {
                            // layer.url è già "/assets/nomefile.png": non dobbiamo
                            // aggiungere di nuovo "assets" o otteniamo assets/assets/...
                            const filename = layer.url.substring(1);
                            const localPath = path.join(process.cwd(), filename);
                            if (fs.existsSync(localPath)) {
                                const buffer = fs.readFileSync(localPath);
                                img = await loadImage(buffer);
                            }
                            else {
                                const altFilename = filename.replaceAll("-", " ");
                                const altLocalPath = path.join(process.cwd(), altFilename);
                                if (fs.existsSync(altLocalPath)) {
                                    const buffer = fs.readFileSync(altLocalPath);
                                    img = await loadImage(buffer);
                                }
                                else {
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
                            applyGrayscale(layer.x, layer.y, layer.width, layer.height);
                        }
                    }
                    catch (err) {
                        logger.error({ err, url: layer.url }, "Failed to load background/image layer");
                        drawFallbackGradient(layer.x, layer.y, layer.width, layer.height, layer.color);
                    }
                }
                else {
                    drawFallbackGradient(layer.x, layer.y, layer.width, layer.height, layer.color);
                }
                ctx.restore();
                ctx.save();
                if (layer.borderWidth && layer.borderWidth > 0) {
                    ctx.strokeStyle = layer.borderColor || "#ffffff";
                    ctx.lineWidth = layer.borderWidth;
                    const inset = layer.borderWidth / 2;
                    roundRectPath(layer.x + inset, layer.y + inset, layer.width - layer.borderWidth, layer.height - layer.borderWidth, Math.max(0, (layer.borderRadius ?? 0) - inset));
                    ctx.stroke();
                }
                break;
            }
            case "avatar": {
                const radius = layer.borderRadius ?? Math.min(layer.width, layer.height) / 2;
                roundRectPath(layer.x, layer.y, layer.width, layer.height, radius);
                ctx.clip();
                try {
                    const avatarUrl = member.user.displayAvatarURL({ extension: "png", size: 256 });
                    const avatarResponse = await fetch(avatarUrl);
                    const avatarBuffer = Buffer.from(await avatarResponse.arrayBuffer());
                    const avatar = await loadImage(avatarBuffer);
                    ctx.drawImage(avatar, layer.x, layer.y, layer.width, layer.height);
                    if (isLeave) {
                        applyGrayscale(layer.x, layer.y, layer.width, layer.height);
                    }
                }
                catch (err) {
                    logger.error({ err }, "Error loading avatar");
                    ctx.fillStyle = "#2a2c32";
                    ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
                }
                ctx.restore();
                ctx.save();
                if (layer.borderWidth && layer.borderWidth > 0) {
                    ctx.strokeStyle = layer.borderColor || "#ffffff";
                    ctx.lineWidth = layer.borderWidth;
                    const inset = layer.borderWidth / 2;
                    const innerRadius = Math.max(0, radius - inset);
                    roundRectPath(layer.x + inset, layer.y + inset, layer.width - layer.borderWidth, layer.height - layer.borderWidth, innerRadius);
                    ctx.stroke();
                }
                break;
            }
            case "text": {
                ctx.fillStyle = layer.color || "#ffffff";
                const weight = layer.fontWeight === "bold" ? "bold" : "normal";
                ctx.font = `${weight} ${layer.fontSize || 24}px WelcomeFont, Arial, sans-serif`;
                ctx.textAlign = layer.textAlign || "left";
                ctx.textBaseline = "middle";
                const processedText = replaceVariables(layer.text || "", member);
                const fontSize = layer.fontSize || 24;
                const lineHeight = Math.round(fontSize * 1.3);
                const lines = processedText.split("\n");
                const totalH = lines.length * lineHeight;
                const baseY = layer.y + Math.max(0, (layer.height - totalH) / 2) + lineHeight / 2;
                let x = layer.x;
                if (layer.textAlign === "center")
                    x = layer.x + layer.width / 2;
                else if (layer.textAlign === "right")
                    x = layer.x + layer.width;
                lines.forEach((ln, idx) => {
                    ctx.fillText(ln, x, baseY + idx * lineHeight);
                });
                break;
            }
        }
        ctx.restore();
    }
    return canvas.toBuffer("image/png");
}
export async function handleMemberJoin(member) {
    const config = loadConfig();
    const guildConfig = config.welcomeLeaveConfigs?.find(c => c.guildId === member.guild.id);
    if (guildConfig?.autoroleEnabled && guildConfig.autoroleRoleIds && guildConfig.autoroleRoleIds.length > 0) {
        try {
            await member.roles.add(guildConfig.autoroleRoleIds);
            logger.info({ guildId: member.guild.id, userId: member.id, roleIds: guildConfig.autoroleRoleIds }, "Autorole assigned");
        }
        catch (err) {
            logger.error({ err, guildId: member.guild.id, userId: member.id, roleIds: guildConfig.autoroleRoleIds }, "Error assigning autorole");
        }
    }
    if (!guildConfig?.welcomeEnabled || !guildConfig.welcomeChannelId)
        return;
    try {
        const channel = await member.guild.channels.fetch(guildConfig.welcomeChannelId);
        if (!channel?.isTextBased())
            return;
        const messageContent = guildConfig.welcomeMessage ? replaceVariables(guildConfig.welcomeMessage, member) : "";
        let files = [];
        try {
            const cardBuffer = await renderCard(member, guildConfig.welcomeCard, false);
            const attachment = new AttachmentBuilder(cardBuffer, { name: "welcome-card.png" });
            files.push(attachment);
        }
        catch (err) {
            logger.error({ err, guildId: member.guild.id }, "Error creating welcome card");
        }
        const messagePayload = {};
        if (messageContent)
            messagePayload.content = messageContent;
        if (files.length > 0)
            messagePayload.files = files;
        if (Object.keys(messagePayload).length > 0) {
            await channel.send(messagePayload);
            logger.info({ guildId: member.guild.id, userId: member.id }, "Welcome message sent");
        }
    }
    catch (err) {
        logger.error({ err, guildId: member.guild.id }, "Error sending welcome message");
    }
}
export async function handleMemberLeave(member) {
    const config = loadConfig();
    const guildConfig = config.welcomeLeaveConfigs?.find(c => c.guildId === member.guild.id);
    if (!guildConfig?.leaveEnabled || !guildConfig.leaveChannelId)
        return;
    try {
        const channel = await member.guild.channels.fetch(guildConfig.leaveChannelId);
        if (!channel?.isTextBased())
            return;
        const messageContent = guildConfig.leaveMessage ? replaceVariables(guildConfig.leaveMessage, member) : "";
        let files = [];
        try {
            const cardBuffer = await renderCard(member, guildConfig.leaveCard, true);
            const attachment = new AttachmentBuilder(cardBuffer, { name: "leave-card.png" });
            files.push(attachment);
        }
        catch (err) {
            logger.error({ err, guildId: member.guild.id }, "Error creating leave card");
        }
        const messagePayload = {};
        if (messageContent)
            messagePayload.content = messageContent;
        if (files.length > 0)
            messagePayload.files = files;
        if (Object.keys(messagePayload).length > 0) {
            await channel.send(messagePayload);
            logger.info({ guildId: member.guild.id, userId: member.id }, "Leave message sent");
        }
    }
    catch (err) {
        logger.error({ err, guildId: member.guild.id }, "Error sending leave message");
    }
}
//# sourceMappingURL=welcome-leave.js.map