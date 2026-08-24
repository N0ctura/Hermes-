import "dotenv/config";

export const BOT_CONFIG = {
  pollChannelId: process.env["DISCORD_POLL_CHANNEL_ID"] ?? "",
  notifyChannelIds: (process.env["DISCORD_NOTIFY_CHANNEL_IDS"] ?? "").split(",").filter(Boolean),
  token: process.env["DISCORD_BOT_TOKEN"] ?? "",
};
