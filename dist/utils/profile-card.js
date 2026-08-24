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
function substituteProfilePlaceholders(text, data) {
    let result = text;
    // Se le stats sono private, mostra Privato per tutto
    if (data.statsHidden) {
        result = result.replaceAll("{username}", data.username); // username non è privabile
        result = result.replaceAll("{level}", "Privato");
        result = result.replaceAll("{clan}", "Privato");
        result = result.replaceAll("{description}", "Privato");
        result = result.replaceAll("{games}", "Privato");
        result = result.replaceAll("{wins}", "Privato");
        result = result.replaceAll("{village_wins}", "Privato");
        result = result.replaceAll("{wolf_wins}", "Privato");
        result = result.replaceAll("{winrate}", "Privato");
        result = result.replaceAll("{roses_received}", "Privato");
        result = result.replaceAll("{roses_sent}", "Privato");
    }
    else {
        result = result.replaceAll("{username}", data.username);
        result = result.replaceAll("{level}", String(data.level));
        result = result.replaceAll("{clan}", data.clanName || "Nessun clan");
        result = result.replaceAll("{description}", data.personalMessage || "");
        result = result.replaceAll("{games}", String(data.gamesPlayed));
        result = result.replaceAll("{wins}", String(data.totalWins));
        result = result.replaceAll("{village_wins}", String(data.villageWins));
        result = result.replaceAll("{wolf_wins}", String(data.wolfWins));
        result = result.replaceAll("{winrate}", data.winRate || "0");
        result = result.replaceAll("{roses_received}", String(data.rosesReceived ?? 0));
        result = result.replaceAll("{roses_sent}", String(data.rosesSent ?? 0));
    }
    return result;
}
export async function generateProfileCard(data, cardConfig) {
    const config = cardConfig || {
        width: 780,
        height: 280,
        layers: [],
    };
    const canvas = createCanvas(config.width, config.height);
    const ctx = canvas.getContext("2d");
    // Immagini cache per evitare ricaricamenti
    const imageCache = new Map();
    async function loadImageSafe(url) {
        if (!url)
            return null;
        try {
            if (imageCache.has(url))
                return imageCache.get(url);
            let img;
            if (url.startsWith("/")) {
                // Percorso relativo come "/assets/profile-clan-red.png"
                const filename = url.substring(1);
                const localPath = path.join(process.cwd(), filename);
                if (fs.existsSync(localPath)) {
                    const buffer = fs.readFileSync(localPath);
                    img = await loadImage(buffer);
                }
                else {
                    // Fallback: prova senza i trattini se il file ha spazi
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
                // URL HTTP(S)
                img = await loadImage(url);
            }
            imageCache.set(url, img);
            return img;
        }
        catch (err) {
            logger.warn({ url, err: String(err) }, "Errore caricamento immagine in profile card");
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
    // Renderizza ogni layer
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
                // Layer sfondo/immagine: disegna colore o URL
                if (layer.url) {
                    const img = await loadImageSafe(layer.url);
                    if (img) {
                        drawRoundedRect(lx, ly, lw, lh, layer.borderRadius ?? 0);
                        ctx.clip();
                        ctx.drawImage(img, lx, ly, lw, lh);
                    }
                    else {
                        ctx.fillStyle = layer.color || "#000000";
                        ctx.fillRect(lx, ly, lw, lh);
                    }
                }
                else {
                    ctx.fillStyle = layer.color || "#000000";
                    ctx.fillRect(lx, ly, lw, lh);
                }
                // Border
                if ((layer.borderWidth ?? 0) > 0) {
                    ctx.strokeStyle = layer.borderColor || "#ffffff";
                    ctx.lineWidth = layer.borderWidth ?? 1;
                    drawRoundedRect(lx, ly, lw, lh, layer.borderRadius ?? 0);
                    ctx.stroke();
                }
            }
            else if (layer.type === "avatar") {
                // Layer avatar: usa l'URL dell'avatar del giocatore
                drawRoundedRect(lx, ly, lw, lh, layer.borderRadius ?? 0);
                ctx.clip();
                if (!data.avatarUrl) {
                    logger.debug({ username: data.username }, "Avatar URL non trovato per il giocatore");
                }
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
                    ctx.fillText("🐺", lx + lw / 2, ly + lh / 2);
                }
                ctx.restore();
                ctx.save();
                // Border dell'avatar
                if ((layer.borderWidth ?? 0) > 0) {
                    ctx.strokeStyle = layer.borderColor || "#c0392b";
                    ctx.lineWidth = layer.borderWidth ?? 1;
                    drawRoundedRect(lx, ly, lw, lh, layer.borderRadius ?? 0);
                    ctx.stroke();
                }
            }
            else if (layer.type === "text") {
                const fs = layer.fontSize ?? 16;
                ctx.fillStyle = layer.color || "#ffffff";
                const weight = layer.fontWeight === "bold" ? "bold" : "normal";
                ctx.font = `${weight} ${fs}px CardFont, system-ui`;
                ctx.textBaseline = "middle";
                ctx.textAlign = layer.textAlign || "left";
                let text = layer.text || "";
                text = substituteProfilePlaceholders(text, data);
                const lines = text.split("\n");
                const lineH = Math.round(fs * 1.3);
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
//# sourceMappingURL=profile-card.js.map