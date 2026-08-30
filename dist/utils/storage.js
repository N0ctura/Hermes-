import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import mysql from "mysql2/promise";
import { logger } from "./logger.js";
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env["DATA_DIR"] ??
    join(dirname(dirname(__dirname)), "data");
const CONFIG_FILE = join(DATA_DIR, "bot-config.json");
const DATABASE_TABLE = "hermes_state";
function createDatabasePool() {
    const databaseUrl = process.env["DATABASE_URL"];
    if (databaseUrl) {
        try {
            const url = new URL(databaseUrl);
            return mysql.createPool({
                host: url.hostname,
                port: Number(url.port || 3306),
                user: decodeURIComponent(url.username),
                password: decodeURIComponent(url.password),
                database: decodeURIComponent(url.pathname.replace(/^\//, "")),
                connectionLimit: 3,
                enableKeepAlive: true,
            });
        }
        catch (err) {
            logger.warn({ err }, "storage: DATABASE_URL non valida, uso il file locale");
            return null;
        }
    }
    const host = process.env["DB_HOST"];
    const user = process.env["DB_USER"];
    const database = process.env["DB_NAME"];
    if (!host || !user || !database)
        return null;
    return mysql.createPool({
        host,
        port: Number(process.env["DB_PORT"] || 3306),
        user,
        password: process.env["DB_PASSWORD"] || "",
        database,
        connectionLimit: 3,
        enableKeepAlive: true,
    });
}
export const DEFAULT_MESSAGES = {
    missioneVinta: 'La missione di questa settimana è **"{missione}"** — se non lo avete già fatto potete andare a comunicare la vostra partecipazione nel tempio! 🏛️',
    nessunVoto: "Non ci sono voti registrati — decidete insieme al clan quale missione fare!",
    pareggio: "**Pareggio!** Le missioni {missioni} hanno la stessa quantità di voti — decidete insieme al clan quale fare! 🤝",
    rimescolo: "🔀 **Le missioni sono state rimescolate!** Nuove missioni disponibili nel canale sondaggi.",
};
export const DEFAULT_THRESHOLD_TIERS = [
    { name: "Semidio", xpRequired: 6_000_000, roleIds: ["1218697126926749737", "1218900052588630026", "1218900180628279326", "1218900125775302696"] },
    { name: "Gigante/Ninfa", xpRequired: 2_000_000, roleIds: ["1218697050544148480", "1218696998249562182", "1218900685224153129", "1218900357225386034", "1218900822360985671", "1218900471364845619", "1218900756942426233", "1218900418197979286"] },
    { name: "Eroe", xpRequired: 1_000_000, roleIds: ["1218696854276018380", "1218899640729075803", "1218899814914199562", "1218899758236565627"] },
    { name: "Polemarchos", xpRequired: 700_000, roleIds: ["1128736377664720896", "1128819275931598938", "1128732867447508992", "1128813555416826017"] },
    { name: "Combattente", xpRequired: 500_000, roleIds: ["1128735744995885116", "1128819152119943239", "1128732753651839046", "1128813312654704742"] },
    { name: "Misthios", xpRequired: 350_000, roleIds: ["1128735127439151154", "1128819040006176840", "1128732635947094191", "1128812621144002580"] },
    { name: "Profeta", xpRequired: 250_000, roleIds: ["1128734867971133491", "1128818907696873593", "1128732549011746967", "1128812135821094932"] },
    { name: "Oracolo", xpRequired: 150_000, roleIds: ["1128734659778465832", "1128818676016087072", "1128732407776936076", "1128811906090676344"] },
    { name: "Sacerdote", xpRequired: 50_000, roleIds: ["1128734192327471144", "1128818545116065903", "1128732279435436102", "1128811659016810546"] },
];
export const THRESHOLD_ROLE_ID_SET = new Set(DEFAULT_THRESHOLD_TIERS.flatMap((t) => t.roleIds));
export const DEFAULT_JOIN_REQUEST_MESSAGE_TEMPLATE = "{ROLES} c'è una nuova recluta di nome **{USERNAME}**! 🐺";
export const DEFAULT_BIRTHDAY_MESSAGE_TEMPLATE = "🎂 Oggi festeggiamo {USERNAME}! Tanti auguri di buon compleanno da tutto {SERVER_NAME}! 🎉";
const DEFAULT_CONFIG = {
    pollChannelId: null,
    notifyChannelIds: [],
};
function normalizeDailyParticipantEntry(participant) {
    if (!participant)
        return null;
    const displayName = participant.displayName || participant.username || "utente";
    return {
        userId: participant.userId || "",
        username: displayName,
        displayName,
        text: participant.text || "",
        addedAt: participant.addedAt || new Date().toISOString(),
    };
}
function normalizeDailyConfig(config) {
    if (!config)
        return null;
    const participants = Array.isArray(config.participants)
        ? config.participants
            .map((participant) => normalizeDailyParticipantEntry(participant))
            .filter((participant) => Boolean(participant && participant.userId))
        : [];
    return {
        guildId: config.guildId || "",
        guildName: config.guildName || "",
        enabled: Boolean(config.enabled),
        hostChannelId: config.hostChannelId,
        hostMessage: config.hostMessage,
        hostMentionRoleIds: Array.isArray(config.hostMentionRoleIds) ? config.hostMentionRoleIds.filter(Boolean) : [],
        missionsMentionRoleIds: Array.isArray(config.missionsMentionRoleIds) ? config.missionsMentionRoleIds.filter(Boolean) : [],
        mentionRoleIds: Array.isArray(config.mentionRoleIds) ? config.mentionRoleIds.filter(Boolean) : [],
        missionsChannelId: config.missionsChannelId,
        missionsPrompt: config.missionsPrompt,
        dailyTime: config.dailyTime || "20:00",
        lastTriggeredDate: config.lastTriggeredDate,
        hostMessageId: config.hostMessageId,
        missionsMessageId: config.missionsMessageId,
        participants,
    };
}
function normalizeConfig(config) {
    return {
        ...DEFAULT_CONFIG,
        ...config,
        notifyChannelIds: Array.isArray(config?.notifyChannelIds) ? config.notifyChannelIds : [],
        notifyChannelNames: Array.isArray(config?.notifyChannelNames) ? config.notifyChannelNames : [],
        templeRoleNames: Array.isArray(config?.templeRoleNames) ? config.templeRoleNames : [],
        leaderRoleNames: Array.isArray(config?.leaderRoleNames) ? config.leaderRoleNames : [],
        thresholdRoleNames: Array.isArray(config?.thresholdRoleNames) ? config.thresholdRoleNames : [],
        welcomeLeaveConfigs: Array.isArray(config?.welcomeLeaveConfigs) ? config.welcomeLeaveConfigs : [],
        autoResponses: Array.isArray(config?.autoResponses) ? config.autoResponses : [],
        scheduledMessages: Array.isArray(config?.scheduledMessages) ? config.scheduledMessages : [],
        ttsConfigs: Array.isArray(config?.ttsConfigs) ? config.ttsConfigs : [],
        logsConfigs: Array.isArray(config?.logsConfigs) ? config.logsConfigs : [],
        deletedModifiedLogs: Array.isArray(config?.deletedModifiedLogs) ? config.deletedModifiedLogs : [],
        donationHistory: Array.isArray(config?.donationHistory) ? config.donationHistory : [],
        donationTracking: {
            enabled: config?.donationTracking?.enabled ?? false,
            lastProcessedAt: config?.donationTracking?.lastProcessedAt,
            recentEventIds: Array.isArray(config?.donationTracking?.recentEventIds)
                ? config.donationTracking.recentEventIds
                : [],
            fallbackChannelId: config?.donationTracking?.fallbackChannelId,
        },
        joinRequestConfigs: Array.isArray(config?.joinRequestConfigs) ? config.joinRequestConfigs : [],
        joinRequestHistory: Array.isArray(config?.joinRequestHistory) ? config.joinRequestHistory : [],
        joinRequestTracking: {
            lastProcessedAt: config?.joinRequestTracking?.lastProcessedAt,
            recentEventIds: Array.isArray(config?.joinRequestTracking?.recentEventIds)
                ? config.joinRequestTracking.recentEventIds
                : [],
        },
        profileCardConfigs: Array.isArray(config?.profileCardConfigs) ? config.profileCardConfigs : [],
        birthdayConfigs: Array.isArray(config?.birthdayConfigs) ? config.birthdayConfigs : [],
        dailyConfigs: Array.isArray(config?.dailyConfigs)
            ? config.dailyConfigs
                .map((daily) => normalizeDailyConfig(daily))
                .filter((daily) => Boolean(daily && daily.guildId))
            : [],
        activityHistory: config?.activityHistory && typeof config.activityHistory === "object" ? config.activityHistory : {},
    };
}
let cache = { ...DEFAULT_CONFIG };
let database = null;
let databaseWriteQueue = Promise.resolve();
let pendingDatabaseJson = null;
let persistedDatabaseJson = null;
let databaseSaveTimer = null;
function fileLoad() {
    if (!existsSync(CONFIG_FILE))
        return null;
    try {
        return JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
    }
    catch {
        return null;
    }
}
function fileSave(config) {
    try {
        if (!existsSync(DATA_DIR))
            mkdirSync(DATA_DIR, { recursive: true });
        writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
    }
    catch (err) {
        logger.warn({ err }, "storage: impossibile scrivere bot-config.json");
    }
}
async function databaseLoad() {
    if (!database)
        return null;
    const [rows] = await database.query(`SELECT config_json FROM ${DATABASE_TABLE} WHERE state_key = 'config' LIMIT 1`);
    const configJson = rows[0]?.config_json;
    if (!configJson)
        return null;
    return JSON.parse(configJson);
}
async function databaseSave(config) {
    if (!database)
        return;
    const configJson = JSON.stringify(config);
    if (configJson === persistedDatabaseJson)
        return;
    await database.query(`INSERT INTO ${DATABASE_TABLE} (state_key, config_json, updated_at)
     VALUES ('config', ?, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE config_json = VALUES(config_json), updated_at = CURRENT_TIMESTAMP`, [configJson]);
    persistedDatabaseJson = configJson;
}
function scheduleDatabaseSave(config) {
    if (!database)
        return;
    pendingDatabaseJson = JSON.stringify(config);
    if (pendingDatabaseJson === persistedDatabaseJson || databaseSaveTimer)
        return;
    databaseSaveTimer = setTimeout(() => {
        databaseSaveTimer = null;
        const configJson = pendingDatabaseJson;
        pendingDatabaseJson = null;
        if (!configJson || configJson === persistedDatabaseJson)
            return;
        databaseWriteQueue = databaseWriteQueue
            .then(() => databaseSave(JSON.parse(configJson)))
            .catch((err) => logger.warn({ err }, "storage: impossibile salvare nel database"));
    }, 250);
}
export async function initStorage() {
    logger.info({
        DATA_DIR,
        CONFIG_FILE,
        DATA_DIR_ENV: process.env["DATA_DIR"] ?? "(non impostato)",
        fileExists: existsSync(CONFIG_FILE),
    }, "storage: percorso configurazione");
    database = createDatabasePool();
    if (database) {
        try {
            await database.query(`
        CREATE TABLE IF NOT EXISTS ${DATABASE_TABLE} (
          state_key VARCHAR(64) PRIMARY KEY,
          config_json LONGTEXT NOT NULL,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
            const databaseConfig = await databaseLoad();
            if (databaseConfig) {
                cache = normalizeConfig(databaseConfig);
                persistedDatabaseJson = JSON.stringify(cache);
                fileSave(cache);
                logger.info("storage: config caricata dal database MySQL/MariaDB ✅");
                return;
            }
            const fileConfig = fileLoad();
            cache = normalizeConfig(fileConfig ?? DEFAULT_CONFIG);
            await databaseSave(cache);
            logger.info(fileConfig
                ? "storage: config locale migrata nel database MySQL/MariaDB ✅"
                : "storage: database pronto, avvio con valori predefiniti");
            return;
        }
        catch (err) {
            logger.warn({ err }, "storage: database non raggiungibile, uso il file locale");
            await database.end().catch(() => undefined);
            database = null;
        }
    }
    const fileConfig = fileLoad();
    if (fileConfig) {
        cache = normalizeConfig(fileConfig);
        logger.info("storage: config caricata dal file locale ✅");
    }
    else {
        cache = { ...DEFAULT_CONFIG };
        logger.info("storage: nessuna config trovata — avvio con valori predefiniti");
    }
}
export function loadConfig() {
    cache = normalizeConfig(cache);
    return cache;
}
export function saveConfig(config) {
    cache = normalizeConfig(config);
    fileSave(cache);
    scheduleDatabaseSave(cache);
}
export function getMessages(config) {
    return { ...DEFAULT_MESSAGES, ...config.messages };
}
export function getDataDir() {
    return DATA_DIR;
}
//# sourceMappingURL=storage.js.map