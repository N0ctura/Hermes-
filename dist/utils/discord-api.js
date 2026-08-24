export function setDiscordClient(client) {
    globalThis.__hermesDiscordClient = client;
}
export function getDiscordClient() {
    return globalThis.__hermesDiscordClient ?? null;
}
//# sourceMappingURL=discord-api.js.map