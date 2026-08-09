import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";

try {
  GlobalFonts.registerFromPath(
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "CardFont"
  );
  GlobalFonts.registerFromPath(
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "CardFontLight"
  );
} catch {
  try {
    GlobalFonts.registerFromPath("C:\\Windows\\Fonts\\arialbd.ttf", "CardFont");
    GlobalFonts.registerFromPath("C:\\Windows\\Fonts\\arial.ttf", "CardFontLight");
  } catch {}
}

const W = 780;
const H = 280;
const AVATAR_SIZE = 220;
const AVATAR_X = 20;
const AVATAR_Y = (H - AVATAR_SIZE) / 2;
const TEXT_X = AVATAR_X + AVATAR_SIZE + 24;
const ACCENT = "#c0392b";
const BG_DARK = "#0e0e0e";
const BG_MID  = "#1a1a1a";
const TEXT_PRIMARY = "#ffffff";
const TEXT_MUTED   = "#a0a0a0";

function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + "…" : text;
}

function fmt(n: number): string {
  return n.toLocaleString("it-IT");
}

export interface ProfileCardData {
  username: string;
  level: number;
  personalMessage?: string;
  clanName?: string;
  avatarUrl?: string;
  gamesPlayed: number;
  totalWins: number;
  villageWins: number;
  wolfWins: number;
  winRate: string | null;
  rosesReceived?: number;
  rosesSent?: number;
}

export async function generateProfileCard(data: ProfileCardData): Promise<Buffer> {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#111111");
  grad.addColorStop(1, "#1c0808");
  ctx.fillStyle = grad;
  roundRect(ctx, 0, 0, W, H, 16);
  ctx.fill();

  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, 0, 4, H);

  ctx.fillStyle = "#2a2a2a";
  roundRect(ctx, AVATAR_X, AVATAR_Y, AVATAR_SIZE, AVATAR_SIZE, 10);
  ctx.fill();

  if (data.avatarUrl) {
    try {
      const img = await loadImage(data.avatarUrl);
      ctx.save();
      roundRect(ctx, AVATAR_X, AVATAR_Y, AVATAR_SIZE, AVATAR_SIZE, 10);
      ctx.clip();
      ctx.drawImage(img, AVATAR_X, AVATAR_Y, AVATAR_SIZE, AVATAR_SIZE);
      ctx.restore();
    } catch {
      ctx.font = "80px CardFont";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#555";
      ctx.fillText("🐺", AVATAR_X + AVATAR_SIZE / 2, AVATAR_Y + AVATAR_SIZE / 2);
    }
  } else {
    ctx.font = "80px CardFont";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#555";
    ctx.fillText("🐺", AVATAR_X + AVATAR_SIZE / 2, AVATAR_Y + AVATAR_SIZE / 2);
  }

  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 3;
  roundRect(ctx, AVATAR_X, AVATAR_Y, AVATAR_SIZE, AVATAR_SIZE, 10);
  ctx.stroke();

  ctx.textAlign = "left";

  ctx.font = "bold 32px CardFont";
  ctx.fillStyle = TEXT_PRIMARY;
  ctx.textBaseline = "top";
  ctx.fillText(truncate(data.username, 20), TEXT_X, 24);

  const levelText = `Lv. ${data.level}`;
  ctx.font = "bold 15px CardFont";
  const lvlW = ctx.measureText(levelText).width + 18;
  const lvlX = W - lvlW - 18;
  ctx.fillStyle = ACCENT;
  roundRect(ctx, lvlX, 20, lvlW, 26, 6);
  ctx.fill();
  ctx.fillStyle = TEXT_PRIMARY;
  ctx.textAlign = "center";
  ctx.fillText(levelText, lvlX + lvlW / 2, 27);
  ctx.textAlign = "left";

  const clanText = data.clanName ? `🏰 ${data.clanName}` : "🏰 Nessun clan";
  ctx.font = "14px CardFontLight";
  ctx.fillStyle = TEXT_MUTED;
  ctx.fillText(clanText, TEXT_X, 64);

  if (data.personalMessage) {
    const msg = truncate(data.personalMessage.replace(/\n/g, " "), 72);
    ctx.font = "italic 13px CardFontLight";
    ctx.fillStyle = "#888";
    ctx.fillText(`"${msg}"`, TEXT_X, 86);
  }

  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(TEXT_X, 116);
  ctx.lineTo(W - 18, 116);
  ctx.stroke();

  const stats = [
    { label: "PARTITE",   value: fmt(data.gamesPlayed) },
    { label: "VITTORIE",  value: `${fmt(data.totalWins)}${data.winRate ? ` (${data.winRate}%)` : ""}` },
    { label: "VILLAGGIO", value: fmt(data.villageWins) },
    { label: "LUPO",      value: fmt(data.wolfWins) },
  ];

  const statCols = 2;
  const colW = (W - TEXT_X - 18) / statCols;
  const rowH = 48;
  const startY = 128;

  stats.forEach((stat, i) => {
    const col = i % statCols;
    const row = Math.floor(i / statCols);
    const sx = TEXT_X + col * colW;
    const sy = startY + row * rowH;

    ctx.font = "11px CardFontLight";
    ctx.fillStyle = TEXT_MUTED;
    ctx.textBaseline = "top";
    ctx.fillText(stat.label, sx, sy);

    ctx.font = "bold 22px CardFont";
    ctx.fillStyle = TEXT_PRIMARY;
    ctx.fillText(stat.value, sx, sy + 14);
  });

  if (data.rosesReceived !== undefined || data.rosesSent !== undefined) {
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(TEXT_X, H - 44);
    ctx.lineTo(W - 18, H - 44);
    ctx.stroke();

    ctx.font = "13px CardFontLight";
    ctx.fillStyle = TEXT_MUTED;
    ctx.textBaseline = "middle";
    const roseLine = `🌹 ${fmt(data.rosesReceived ?? 0)} ricevute   💌 ${fmt(data.rosesSent ?? 0)} inviate`;
    ctx.fillText(roseLine, TEXT_X, H - 22);
  }

  return canvas.toBuffer("image/png");
}
