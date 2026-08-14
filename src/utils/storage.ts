import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "./logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATA_DIR =
  process.env["DATA_DIR"] ??
  join(dirname(dirname(__dirname)), "data");
const CONFIG_FILE = join(DATA_DIR, "bot-config.json");

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
    donationTracking: {
      enabled: config?.donationTracking?.enabled ?? false,
      lastProcessedAt: config?.donationTracking?.lastProcessedAt,
      recentEventIds: Array.isArray(config?.donationTracking?.recentEventIds)
        ? config.donationTracking.recentEventIds
        : [],
      fallbackChannelId: config?.donationTracking?.fallbackChannelId,
    },
  };
}

let cache: BotConfig = { ...DEFAULT_CONFIG };

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

export async function initStorage(): Promise<void> {
  logger.info({
    DATA_DIR,
    CONFIG_FILE,
    DATA_DIR_ENV: process.env["DATA_DIR"] ?? "(non impostato)",
    fileExists: existsSync(CONFIG_FILE),
  }, "storage: percorso configurazione");

  const fileConfig = fileLoad();
  if (fileConfig) {
    cache = normalizeConfig(fileConfig);
    logger.info("storage: config caricata dal file locale ✅");
    return;
  }

  cache = { ...DEFAULT_CONFIG };
  logger.info("storage: nessuna config trovata — avvio con valori predefiniti");
}

export function loadConfig(): BotConfig {
  cache = normalizeConfig(cache);
  return cache;
}

export function saveConfig(config: BotConfig): void {
  cache = normalizeConfig(config);
  fileSave(cache);
}

export function getMessages(config: BotConfig): BotMessages {
  return { ...DEFAULT_MESSAGES, ...config.messages };
}

export function getDataDir(): string {
  return DATA_DIR;
}
