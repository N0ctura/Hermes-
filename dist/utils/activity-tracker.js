import { loadConfig, saveConfig } from "./storage.js";
const RETENTION_DAYS = 360;
const activeVoiceSessions = new Map();
function dateKey(timestamp = Date.now()) {
    return new Date(timestamp).toISOString().slice(0, 10);
}
function getDay(guildId, key) {
    const config = loadConfig();
    const history = config.activityHistory?.[guildId] ?? [];
    const existing = history.find((day) => day.date === key);
    if (existing)
        return existing;
    const created = { date: key, messages: {}, voiceSeconds: {} };
    history.push(created);
    history.sort((a, b) => a.date.localeCompare(b.date));
    config.activityHistory = { ...(config.activityHistory ?? {}), [guildId]: history.slice(-RETENTION_DAYS) };
    saveConfig(config);
    return created;
}
function saveActivityDay(guildId, day) {
    const config = loadConfig();
    const history = [...(config.activityHistory?.[guildId] ?? [])];
    const index = history.findIndex((entry) => entry.date === day.date);
    if (index >= 0)
        history[index] = day;
    else
        history.push(day);
    history.sort((a, b) => a.date.localeCompare(b.date));
    config.activityHistory = { ...(config.activityHistory ?? {}), [guildId]: history.slice(-RETENTION_DAYS) };
    saveConfig(config);
}
export function trackMessageActivity(guildId, userId) {
    const day = getDay(guildId, dateKey());
    day.messages[userId] = (day.messages[userId] ?? 0) + 1;
    saveActivityDay(guildId, day);
}
export function trackVoiceState(state) {
    const key = `${state.guildId}:${state.userId}`;
    const current = activeVoiceSessions.get(key);
    if (state.channelId && !current) {
        activeVoiceSessions.set(key, { guildId: state.guildId, userId: state.userId, startedAt: Date.now() });
        return;
    }
    if (!state.channelId && current) {
        recordVoiceDuration(current.guildId, current.userId, current.startedAt, Date.now());
        activeVoiceSessions.delete(key);
    }
}
function recordVoiceDuration(guildId, userId, startedAt, endedAt) {
    let cursor = startedAt;
    while (cursor < endedAt) {
        const nextMidnight = new Date(dateKey(cursor) + "T00:00:00.000Z").getTime() + 86_400_000;
        const segmentEnd = Math.min(endedAt, nextMidnight);
        const day = getDay(guildId, dateKey(cursor));
        day.voiceSeconds[userId] = (day.voiceSeconds[userId] ?? 0) + Math.max(0, (segmentEnd - cursor) / 1000);
        saveActivityDay(guildId, day);
        cursor = segmentEnd;
    }
}
export function getGuildActivity(guildId) {
    const config = loadConfig();
    const history = config.activityHistory?.[guildId] ?? [];
    const messages = new Map();
    const voiceSeconds = new Map();
    for (const day of history) {
        for (const [userId, count] of Object.entries(day.messages))
            messages.set(userId, (messages.get(userId) ?? 0) + count);
        for (const [userId, seconds] of Object.entries(day.voiceSeconds))
            voiceSeconds.set(userId, (voiceSeconds.get(userId) ?? 0) + seconds);
    }
    return {
        days: history,
        users: [...new Set([...messages.keys(), ...voiceSeconds.keys()])].map((userId) => ({
            userId,
            messages: messages.get(userId) ?? 0,
            voiceSeconds: voiceSeconds.get(userId) ?? 0,
        })),
    };
}
//# sourceMappingURL=activity-tracker.js.map