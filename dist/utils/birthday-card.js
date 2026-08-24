import { AttachmentBuilder } from "discord.js";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import path from "path";
import fs from "fs";
import { logger } from "./logger.js";
try {
    GlobalFonts.registerFromPath("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "CardFont");
    GlobalFonts.registerFromPath("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "CardFontLight");
}
catch {
    try {
        GlobalFonts.registerFromPath("C:\\Windows\\Fonts\\arialbd.ttf", "CardFont");
        GlobalFonts.registerFromPath("C:\\Windows\\Fonts\\arial.ttf", "CardFontLight");
    }
    catch { }
}
const MONTH_NAMES_IT = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];
function substituteBirthdayPlaceholders(text, data) {
    let result = text;
    result = result.replaceAll("{USERNAME}", data.username);
    result = result.replaceAll("{SERVER_NAME}", data.serverName);
    result = result.replaceAll("{DATE}", `${data.day} ${MONTH_NAMES_IT[data.month - 1]}`);
    result = result.replaceAll("{DAY}", String(data.day));
    result = result.replaceAll("{MONTH}", MONTH_NAMES_IT[data.month - 1]);
    return result;
}
export { substituteBirthdayPlaceholders };
/**
 * Layout di default, usato sia come fallback lato bot (se l'admin non ha ancora
 * personalizzato nulla dalla dashboard) sia come riferimento iniziale del canvas.
 * Lo sfondo punta a /assets/compleanno.png — se il file non è ancora presente
 * (verrà aggiunto prima della build) si ricade su un colore pieno, senza errori.
 */
export function getDefaultBirthdayCard() {
    return {
        width: 1440,
        height: 560,
        layers: [
            {
                id: "bg",
                type: "background",
                visible: true,
                x: 0,
                y: 0,
                width: 1440,
                height: 560,
                url: "/assets/compleanno.png",
                color: "#132133",
                borderWidth: 0,
            },
            {
                id: "avatar",
                type: "avatar",
                visible: true,
                x: 570,
                y: 60,
                width: 300,
                height: 300,
                borderRadius: 150,
                borderWidth: 6,
                borderColor: "#5DADE2",
            },
            {
                id: "title",
                type: "text",
                visible: true,
                x: 120,
                y: 380,
                width: 1200,
                height: 60,
                text: "🎉 Buon Compleanno! 🎉",
                fontSize: 52,
                fontWeight: "bold",
                color: "#ffffff",
                textAlign: "center",
            },
            {
                id: "username",
                type: "text",
                visible: true,
                x: 120,
                y: 440,
                width: 1200,
                height: 56,
                text: "{USERNAME}",
                fontSize: 40,
                fontWeight: "bold",
                color: "#5DADE2",
                textAlign: "center",
            },
            {
                id: "subtitle",
                type: "text",
                visible: true,
                x: 120,
                y: 496,
                width: 1200,
                height: 40,
                text: "Tutto {SERVER_NAME} ti augura una giornata fantastica 🐺🌹",
                fontSize: 24,
                fontWeight: "normal",
                color: "#cfe3f2",
                textAlign: "center",
            },
        ],
    };
}
export async function generateBirthdayCard(data, cardConfig) {
    const config = cardConfig || getDefaultBirthdayCard();
    const canvas = createCanvas(config.width, config.height);
    const ctx = canvas.getContext("2d");
    const imageCache = new Map();
    async function loadImageSafe(url) {
        if (!url)
            return null;
        try {
            if (imageCache.has(url))
                return imageCache.get(url);
            let img;
            if (url.startsWith("/")) {
                const filename = url.substring(1);
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
                        return null;
                    }
                }
            }
            else {
                img = await loadImage(url);
            }
            imageCache.set(url, img);
            return img;
        }
        catch (err) {
            logger.warn({ url, err: String(err) }, "Errore caricamento immagine in birthday card");
            return null;
        }
    }
    function drawRoundedRect(x, y, w, h, r) {
        const safeW = Math.max(1, w);
        const safeH = Math.max(1, h);
        const radius = Math.max(0, Math.min(r, safeW / 2, safeH / 2));
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + safeW, y, x + safeW, y + safeH, radius);
        ctx.arcTo(x + safeW, y + safeH, x, y + safeH, radius);
        ctx.arcTo(x, y + safeH, x, y, radius);
        ctx.arcTo(x, y, x + safeW, y, radius);
        ctx.closePath();
    }
    for (const layer of config.layers) {
        if (!layer.visible)
            continue;
        const lx = Number.isFinite(layer.x) ? layer.x : 0;
        const ly = Number.isFinite(layer.y) ? layer.y : 0;
        const lw = Number.isFinite(layer.width) && layer.width > 0 ? layer.width : 100;
        const lh = Number.isFinite(layer.height) && layer.height > 0 ? layer.height : 100;
        try {
            ctx.save();
            if (layer.type === "background" || layer.type === "image") {
                if (layer.url) {
                    const img = await loadImageSafe(layer.url);
                    if (img) {
                        drawRoundedRect(lx, ly, lw, lh, layer.borderRadius ?? 0);
                        ctx.clip();
                        ctx.drawImage(img, lx, ly, lw, lh);
                    }
                    else {
                        ctx.fillStyle = layer.color || "#132133";
                        ctx.fillRect(lx, ly, lw, lh);
                    }
                }
                else {
                    ctx.fillStyle = layer.color || "#132133";
                    ctx.fillRect(lx, ly, lw, lh);
                }
                if ((layer.borderWidth ?? 0) > 0) {
                    ctx.strokeStyle = layer.borderColor || "#ffffff";
                    ctx.lineWidth = layer.borderWidth ?? 1;
                    drawRoundedRect(lx, ly, lw, lh, layer.borderRadius ?? 0);
                    ctx.stroke();
                }
            }
            else if (layer.type === "avatar") {
                drawRoundedRect(lx, ly, lw, lh, layer.borderRadius ?? 0);
                ctx.clip();
                const avatarImg = await loadImageSafe(data.avatarUrl);
                if (avatarImg) {
                    ctx.drawImage(avatarImg, lx, ly, lw, lh);
                }
                else {
                    ctx.fillStyle = "#2a2a2a";
                    ctx.fillRect(lx, ly, lw, lh);
                    ctx.fillStyle = "#555";
                    ctx.font = `${Math.min(lw, lh) / 2}px CardFont`;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText("🎂", lx + lw / 2, ly + lh / 2);
                }
                ctx.restore();
                ctx.save();
                if ((layer.borderWidth ?? 0) > 0) {
                    ctx.strokeStyle = layer.borderColor || "#5DADE2";
                    ctx.lineWidth = layer.borderWidth ?? 1;
                    drawRoundedRect(lx, ly, lw, lh, layer.borderRadius ?? 0);
                    ctx.stroke();
                }
            }
            else if (layer.type === "text") {
                const fs2 = layer.fontSize ?? 16;
                ctx.fillStyle = layer.color || "#ffffff";
                const weight = layer.fontWeight === "bold" ? "bold" : "normal";
                ctx.font = `${weight} ${fs2}px CardFont, system-ui`;
                ctx.textBaseline = "middle";
                ctx.textAlign = layer.textAlign || "left";
                let text = layer.text || "";
                text = substituteBirthdayPlaceholders(text, data);
                const lines = text.split("\n");
                const lineH = Math.round(fs2 * 1.3);
                const totalH = lines.length * lineH;
                const baseY = ly + Math.max(0, (lh - totalH) / 2) + lineH / 2;
                let x = lx;
                if (layer.textAlign === "center")
                    x = lx + lw / 2;
                if (layer.textAlign === "right")
                    x = lx + lw;
                lines.forEach((ln, idx) => {
                    ctx.fillText(ln, x, baseY + idx * lineH);
                });
            }
            ctx.restore();
        }
        catch (err) {
            console.error(`Errore rendering layer ${layer.id}:`, err);
            ctx.restore();
        }
    }
    return canvas.toBuffer("image/png");
}
export async function generateBirthdayAttachment(data, cardConfig) {
    const buffer = await generateBirthdayCard(data, cardConfig);
    return new AttachmentBuilder(buffer, { name: "birthday-card.png" });
}
//# sourceMappingURL=birthday-card.js.map