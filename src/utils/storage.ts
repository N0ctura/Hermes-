import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import mysql, { type Pool } from "mysql2/promise";
import { logger } from "./logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATA_DIR =
  process.env["DATA_DIR"] ??
  join(dirname(dirname(__dirname)), "data");
const CONFIG_FILE = join(DATA_DIR, "bot-config.json");
const DATABASE_TABLE = "hermes_state";

function createDatabasePool(): Pool | null {
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
    } catch (err) {
      logger.warn({ err }, "storage: DATABASE_URL non valida, uso il file locale");
      return null;
    }
  }

  const host = process.env["DB_HOST"];
  const user = process.env["DB_USER"];
  const database = process.env["DB_NAME"];
  if (!host || !user || !database) return null;
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

export interface ActivePoll {
  channelId: string;
  introMessageId: string;
  messageIds: string[];
  summaryMessageId?: string;
  questCount: number;
  questLabels: string[];
  questImageUrls?: string[];
  createdAt: string;
  closesAt?: string;
  votes?: { [userId: string]: number };
}

export interface BotMessages {
  missioneVinta: string;
  nessunVoto: string;
  pareggio: string;
  rimescolo: string;
}

export const DEFAULT_MESSAGES: BotMessages = {
  missioneVinta:
    'La missione di questa settimana è **"{missione}"** — se non lo avete già fatto potete andare a comunicare la vostra partecipazione nel tempio! 🏛️',
  nessunVoto:
    "Non ci sono voti registrati — decidete insieme al clan quale missione fare!",
  pareggio:
    "**Pareggio!** Le missioni {missioni} hanno la stessa quantità di voti — decidete insieme al clan quale fare! 🤝",
  rimescolo:
    "🔀 **Le missioni sono state rimescolate!** Nuove missioni disponibili nel canale sondaggi.",
};

export interface ThresholdTier {
  name: string;
  xpRequired: number;
  roleIds: string[];
}

export const DEFAULT_THRESHOLD_TIERS: ThresholdTier[] = [
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

export const THRESHOLD_ROLE_ID_SET = new Set<string>(
  DEFAULT_THRESHOLD_TIERS.flatMap((t) => t.roleIds)
);

export interface CardLayer {
  id: string;
  type: 'background' | 'image' | 'avatar' | 'text';
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  url?: string;
  text?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
  borderWidth?: number;
  borderColor?: string;
  borderRadius?: number;
  grayscale?: boolean;
}

export interface CardConfig {
  width: number;
  height: number;
  layers: CardLayer[];
}

export interface GuildWelcomeLeaveConfig {
  guildId: string;
  guildName: string;
  welcomeChannelId?: string;
  welcomeMessage?: string;
  welcomeEnabled?: boolean;
  welcomeCard?: CardConfig;
  leaveChannelId?: string;
  leaveMessage?: string;
  leaveEnabled?: boolean;
  leaveCard?: CardConfig;
  autoroleEnabled?: boolean;
  autoroleRoleIds?: string[];
}

export interface GuildTTSConfig {
  guildId: string;
  guildName: string;
  ttsSourceChannelId?: string;
  ttsVoiceChannelId?: string;
  ttsEnabled?: boolean;
  ttsAutoJoinEnabled?: boolean;
  ttsLanguage?: string;
  ttsPrefixes?: string[];
}

export interface AutoResponseConfig {
  id: string;
  guildId: string;
  trigger: string;
  response: string;
  isRegex: boolean;
  enabled: boolean;
  createdAt: string;
}

export interface ScheduledMessageConfig {
  id: string;
  guildId: string;
  channelId: string;
  message: string;
  isRecurring: boolean;
  recurrenceInterval?: 'daily' | 'weekly' | 'monthly';
  scheduledTime: string;
  lastSent?: string;
  enabled: boolean;
  createdAt: string;
}

export interface DeletedModifiedLog {
  id: string;
  guildId: string;
  timestamp: string;
  type: "deleted" | "modified";
  author: {
    id: string;
    username: string;
    avatar: string;
    isBot: boolean;
  };
  channelId: string;
  channelName: string;
  oldContent?: string;
  newContent?: string;
  deletedContent?: string;
}

export interface GuildActivityDay {
  date: string;
  messages: Record<string, number>;
  voiceSeconds: Record<string, number>;
}

export interface GuildLogsConfig {
  guildId: string;
  guildName: string;
  enabled?: boolean;
  channelId?: string;
  interceptApps?: boolean;
  interceptUsers?: boolean;
}

export interface RoseLobbyParticipant {
  userId: string;
  username: string;
  joinedAt: string;
}

export interface RoseLobby {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string;
  title: string;
  customMessage?: string;
  participants: RoseLobbyParticipant[];
  reserves: RoseLobbyParticipant[];
  removedParticipants: RoseLobbyParticipant[];
  createdAt: string;
}

export interface DonationEntry {
  id: string;
  /** Timestamp ISO Wolvesville dell'evento */
  eventTime: string;
  /** Timestamp ISO di quando il bot l'ha processato */
  processedAt: string;
  /** Player ID Wolvesville */
  playerId?: string;
  /** Username Wolvesville */
  playerUsername: string;
  /** Importo donato (oro o gemme, vedi `currency`) */
  amount: number;
  /**
   * Valuta della donazione. Assente = "gold" per compatibilità con lo
   * storico salvato prima dell'introduzione del tracciamento gemme.
   */
  currency?: "gold" | "gems";
  /** Commento eventualmente lasciato dal giocatore al momento della donazione */
  comment?: string;
  /** Valore raw del campo `type` del ledger (utile per debug futuro) */
  rawAction: string;
  /** Eventuale ID messaggio Discord della notifica inviata */
  notificationMessageId?: string;
  /** Canale Discord dove è stata mandata la notifica */
  notificationChannelId?: string;
}

export interface GuildJoinRequestConfig {
  guildId: string;
  guildName: string;
  /** Abilita/disabilita l'invio di notifiche di richiesta d'ingresso per questo server. */
  enabled?: boolean;
  /** Canale Discord dove inviare la notifica. */
  channelId?: string;
  /** Ruoli da menzionare nella notifica (es. Co-Capo). */
  mentionRoleIds?: string[];
  /**
   * Template del messaggio. Variabili supportate:
   *   {ROLES}    -> menzioni dei ruoli selezionati (es. "@Co Capo")
   *   {USERNAME} -> nome utente Wolvesville del richiedente
   */
  messageTemplate?: string;
}

export const DEFAULT_JOIN_REQUEST_MESSAGE_TEMPLATE =
  "{ROLES} c'è una nuova recluta di nome **{USERNAME}**! 🐺";

export interface BirthdayEntry {
  userId: string;
  /** Nickname al momento dell'aggiunta, usato per la lista e come fallback se l'utente lascia il server. */
  username: string;
  /** Giorno del mese, 1-31. */
  day: number;
  /** Mese, 1-12. */
  month: number;
  addedAt: string;
  /** Anno in cui è già stato festeggiato, per evitare doppi auguri dopo un riavvio. */
  lastCelebratedYear?: number;
}

export interface GuildBirthdayConfig {
  guildId: string;
  guildName: string;
  enabled?: boolean;
  /** Canale unico usato sia per la lista sempre aggiornata sia per gli auguri di mezzanotte. */
  channelId?: string;
  /** ID del messaggio "Lista Compleanni", modificato in place ad ogni variazione. */
  listMessageId?: string;
  /** Testo del messaggio di auguri a mezzanotte. Variabili: {USERNAME}, {SERVER_NAME}, {DATE} */
  messageTemplate?: string;
  /** Ruoli da menzionare nel messaggio di auguri a mezzanotte (es. ruolo "Membri"), per avvisare tutti. */
  mentionRoleIds?: string[];
  /** Layout del banner di compleanno, sistema a layer riusabile (stesso di Welcome/Leave/Profile). */
  card?: CardConfig;
  birthdays: BirthdayEntry[];
}

export const DEFAULT_BIRTHDAY_MESSAGE_TEMPLATE =
  "🎂 Oggi festeggiamo {USERNAME}! Tanti auguri di buon compleanno da tutto {SERVER_NAME}! 🎉";

export interface GuildProfileCardConfig {
  guildId: string;
  guildName: string;
  /**
   * Configurazione canvas per la profile card.
   * Layout modificabile con layer editor nella dashboard.
   * Supporta placeholder: {username}, {level}, {clan}, {description}, {games}, {wins}, {village_wins}, {wolf_wins}, {winrate}, {roses_received}, {roses_sent}
   */
  card?: CardConfig;
}

export interface JoinRequestEntry {
  id: string;
  /** Timestamp ISO Wolvesville dell'evento (dal log del clan) */
  eventTime: string;
  /** Timestamp ISO di quando il bot l'ha processato */
  processedAt: string;
  playerId?: string;
  playerUsername: string;
  /** Eventuale ID messaggio Discord della notifica inviata */
  notificationMessageId?: string;
  /** Canale Discord dove è stata mandata la notifica */
  notificationChannelId?: string;
}

export interface JoinRequestTrackingState {
  /**
   * ISO timestamp dell'evento del log Wolvesville più recente già processato.
   * Usato come cursore anti-duplicati (vedi utils/join-request-tracker.ts).
   */
  lastProcessedAt?: string;
  /** ID pseudo-univoci (timestamp+username) degli eventi già notificati. */
  recentEventIds?: string[];
}

export interface DonationTrackingConfig {
  /** Abilita/disabilita il polling delle donazioni per l'intero bot. */
  enabled: boolean;
  /**
   * ISO timestamp dell'evento del log Wolvesville più recente già processato.
   * Usato come cursore anti-duplicati: al giro successivo si considerano
   * solo eventi con timestamp strettamente maggiore di questo.
   */
  lastProcessedAt?: string;
  /**
   * ID degli eventi già notificati nell'ultimo secondo/minuto sovrapposto,
   * per evitare doppi invii quando due giri di polling toccano lo stesso
   * istante di confine (vedi utils/donation-tracker.ts).
   */
  recentEventIds?: string[];
  /** Canale di fallback se un donatore non appartiene a nessun tempio rilevato. */
  fallbackChannelId?: string;
}

export interface BotConfig {
  pollChannelId?: string | null;
  notifyChannelIds: string[];
  pollDurationHours?: number;
  pingRoleId?: string;
  pilgrimRoleId?: string;
  clanId?: string;
  activePoll?: ActivePoll;
  messages?: Partial<BotMessages>;
  pollChannelName?: string | null;
  notifyChannelNames?: string[];
  pingRoleName?: string;
  pilgrimRoleName?: string;
  templeRoleNames?: string[];
  leaderRoleNames?: string[];
  thresholdRoleNames?: string[];
  welcomeLeaveConfigs?: GuildWelcomeLeaveConfig[];
  autoResponses?: AutoResponseConfig[];
  scheduledMessages?: ScheduledMessageConfig[];
  ttsConfigs?: GuildTTSConfig[];
  logsConfigs?: GuildLogsConfig[];
  deletedModifiedLogs?: DeletedModifiedLog[];
  roseLobbyChannelId?: string;
  activeRoseLobby?: RoseLobby;
  lastPollWasShuffled?: boolean;
  donationTracking?: DonationTrackingConfig;
  donationHistory?: DonationEntry[];
  joinRequestConfigs?: GuildJoinRequestConfig[];
  joinRequestHistory?: JoinRequestEntry[];
  joinRequestTracking?: JoinRequestTrackingState;
  profileCardConfigs?: GuildProfileCardConfig[];
  birthdayConfigs?: GuildBirthdayConfig[];
  /** Data (YYYY-MM-DD, fuso Europe/Rome) dell'ultimo controllo compleanni eseguito dallo scheduler. */
  birthdayLastCheckedDate?: string;
  activityHistory?: Record<string, GuildActivityDay[]>;
}

const DEFAULT_CONFIG: BotConfig = {
  pollChannelId: null,
  notifyChannelIds: [],
};

function normalizeConfig(config: Partial<BotConfig> | null | undefined): BotConfig {
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
    activityHistory: config?.activityHistory && typeof config.activityHistory === "object" ? config.activityHistory : {},
  };
}

let cache: BotConfig = { ...DEFAULT_CONFIG };
let database: Pool | null = null;
let databaseWriteQueue: Promise<void> = Promise.resolve();
let pendingDatabaseJson: string | null = null;
let persistedDatabaseJson: string | null = null;
let databaseSaveTimer: ReturnType<typeof setTimeout> | null = null;

function fileLoad(): BotConfig | null {
  if (!existsSync(CONFIG_FILE)) return null;
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf-8")) as BotConfig;
  } catch {
    return null;
  }
}

function fileSave(config: BotConfig): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
  } catch (err) {
    logger.warn({ err }, "storage: impossibile scrivere bot-config.json");
  }
}

async function databaseLoad(): Promise<BotConfig | null> {
  if (!database) return null;
  const [rows] = await database.query(`SELECT config_json FROM ${DATABASE_TABLE} WHERE state_key = 'config' LIMIT 1`);
  const configJson = (rows as Array<{ config_json?: string }>)[0]?.config_json;
  if (!configJson) return null;
  return JSON.parse(configJson) as BotConfig;
}

async function databaseSave(config: BotConfig): Promise<void> {
  if (!database) return;
  const configJson = JSON.stringify(config);
  if (configJson === persistedDatabaseJson) return;
  await database.query(
    `INSERT INTO ${DATABASE_TABLE} (state_key, config_json, updated_at)
     VALUES ('config', ?, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE config_json = VALUES(config_json), updated_at = CURRENT_TIMESTAMP`,
    [configJson],
  );
  persistedDatabaseJson = configJson;
}

function scheduleDatabaseSave(config: BotConfig): void {
  if (!database) return;
  pendingDatabaseJson = JSON.stringify(config);
  if (pendingDatabaseJson === persistedDatabaseJson || databaseSaveTimer) return;

  databaseSaveTimer = setTimeout(() => {
    databaseSaveTimer = null;
    const configJson = pendingDatabaseJson;
    pendingDatabaseJson = null;
    if (!configJson || configJson === persistedDatabaseJson) return;

    databaseWriteQueue = databaseWriteQueue
      .then(() => databaseSave(JSON.parse(configJson) as BotConfig))
      .catch((err) => logger.warn({ err }, "storage: impossibile salvare nel database"));
  }, 250);
}

export async function initStorage(): Promise<void> {
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
    } catch (err) {
      logger.warn({ err }, "storage: database non raggiungibile, uso il file locale");
      await database.end().catch(() => undefined);
      database = null;
    }
  }

  const fileConfig = fileLoad();
  if (fileConfig) {
    cache = normalizeConfig(fileConfig);
    logger.info("storage: config caricata dal file locale ✅");
  } else {
    cache = { ...DEFAULT_CONFIG };
    logger.info("storage: nessuna config trovata — avvio con valori predefiniti");
  }
}

export function loadConfig(): BotConfig {
  cache = normalizeConfig(cache);
  return cache;
}

export function saveConfig(config: BotConfig): void {
  cache = normalizeConfig(config);
  fileSave(cache);
  scheduleDatabaseSave(cache);
}

export function getMessages(config: BotConfig): BotMessages {
  return { ...DEFAULT_MESSAGES, ...config.messages };
}

export function getDataDir(): string {
  return DATA_DIR;
}
