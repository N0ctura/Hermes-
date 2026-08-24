import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
    GlobalFonts.registerFromPath("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "BadgeFont");
}
catch {
    try {
        GlobalFonts.registerFromPath("C:\\Windows\\Fonts\\arialbd.ttf", "BadgeFont");
    }
    catch { }
}
export async function addNumberBadge(imageUrl, number) {
    const img = await loadImage(imageUrl);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const badgeRadius = Math.round(Math.min(img.width, img.height) * 0.1);
    const margin = Math.round(badgeRadius * 0.5);
    const cx = margin + badgeRadius;
    const cy = margin + badgeRadius;
    const fontSize = Math.round(badgeRadius * 1.1);
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, badgeRadius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(15, 15, 15, 0.85)";
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.round(badgeRadius * 0.12);
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.stroke();
    ctx.font = `bold ${fontSize}px BadgeFont`;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(number), cx, cy);
    return canvas.toBuffer("image/png");
}
//# sourceMappingURL=image-badge.js.map