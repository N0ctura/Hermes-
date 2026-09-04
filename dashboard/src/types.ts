export interface CardLayer {
  id: string;
  type: "background" | "avatar" | "text" | "image";
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  url?: string;
  text?: string;
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  color?: string;
  textAlign?: "left" | "center" | "right";
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  grayscale?: boolean;
}

export interface CardConfig {
  width: number;
  height: number;
  layers: CardLayer[];
}

export interface GuildWelcomeLeave {
  guildId: string;
  guildName: string;
  welcomeEnabled?: boolean;
  welcomeChannelId?: string;
  welcomeMessage?: string;
  welcomeCard?: CardConfig;
  leaveEnabled?: boolean;
  leaveChannelId?: string;
  leaveMessage?: string;
  leaveCard?: CardConfig;
  autoroleEnabled?: boolean;
  autoroleRoleIds?: string[];
}

export interface GuildTTS {
  guildId: string;
  guildName: string;
  ttsEnabled?: boolean;
  ttsAutoJoinEnabled?: boolean;
  ttsSourceChannelId?: string;
  ttsVoiceChannelId?: string;
  ttsBlockedVoiceChannelIds?: string[];
  ttsLanguage?: string;
  ttsPrefixes?: string[];
}

export interface GuildLogs {
  guildId: string;
  guildName: string;
  enabled?: boolean;
  channelId?: string;
  ignoredChannelIds?: string[];
  interceptApps?: boolean;
  interceptUsers?: boolean;
}

export interface GuildJoinRequests {
  guildId: string;
  guildName: string;
  enabled?: boolean;
  channelId?: string;
  mentionRoleIds?: string[];
  messageTemplate?: string;
}

export interface GuildProfileCardConfig {
  guildId: string;
  guildName: string;
  card?: CardConfig;
}

export interface BirthdayEntry {
  userId: string;
  username: string;
  day: number;
  month: number;
  addedAt: string;
  lastCelebratedYear?: number;
}

export interface GuildBirthdayConfig {
  guildId: string;
  guildName: string;
  enabled?: boolean;
  channelId?: string;
  listMessageId?: string;
  messageTemplate?: string;
  mentionRoleIds?: string[];
  card?: CardConfig;
  birthdays: BirthdayEntry[];
}

export interface DailyParticipantEntry {
  userId: string;
  username: string;
  displayName?: string;
  text: string;
  addedAt: string;
}

export interface GuildDailyConfig {
  guildId: string;
  guildName: string;
  enabled?: boolean;
  hostChannelId?: string;
  hostMessage?: string;
  hostMentionRoleIds?: string[];
  missionsMentionRoleIds?: string[];
  /** @deprecated use hostMentionRoleIds / missionsMentionRoleIds */
  mentionRoleIds?: string[];
  missionsChannelId?: string;
  missionsPrompt?: string;
  dailyTime?: string;
  lastTriggeredDate?: string;
  hostMessageId?: string;
  missionsMessageId?: string;
  /** true quando la daily è stata chiusa (a mezzanotte o manualmente): le risposte al vecchio messaggio vengono ignorate finché non riparte una nuova daily. */
  closed?: boolean;
  participants?: DailyParticipantEntry[];
}

export interface DiscordMember {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
}

export interface JoinRequestEntry {
  id: string;
  eventTime: string;
  processedAt: string;
  playerId?: string;
  playerUsername: string;
  notificationMessageId?: string;
  notificationChannelId?: string;
}

export interface ScheduledMessage {
  id: string;
  guildId: string;
  channelId: string;
  message: string;
  isRecurring: boolean;
  recurrenceInterval?: string;
  daysOfWeek?: number[];
  scheduledTime: string;
  lastSent?: string;
  enabled: boolean;
  createdAt: string;
}

export interface AutoResponse {
  id: string;
  guildId: string;
  trigger: string;
  response: string;
  isRegex: boolean;
  enabled: boolean;
  createdAt: string;
}

export interface WvClanMember {
  playerId: string;
  username: string;
  level: number;
  xp?: number;
  status?: string;
  playerStatus?: string;
  isCoLeader?: boolean;
  creationTime?: string;
  lastOnline?: string;
  profileIconId?: string;
  flair?: string;
  participateInClanQuests?: boolean;
}

export interface WvClanLogEntry {
  playerId?: string;
  playerUsername?: string;
  targetPlayerId?: string;
  targetPlayerUsername?: string;
  creationTime: string;
  action: string;
  comment?: string;
}

export type ClanGoldTransactionType =
  | "DONATE"
  | "GOLD_DONATION"
  | "GOLD_PURCHASED_QUEST_SLOT"
  | "GOLD_REFUNDED_QUEST_SLOT"
  | "GOLD_QUEST_PURCHASE"
  | "GOLD_QUEST_REFUND"
  | "GOLD_QUEST_REWARD"
  | "GOLD_WITHDRAW"
  | "GOLD_DEPOSIT";

export interface ClanGoldTransaction {
  id: string;
  gold: number;
  gems: number;
  playerId?: string;
  playerUsername?: string;
  playerBotId?: string;
  playerBotOwnerUsername?: string;
  clanQuestId?: string;
  type: ClanGoldTransactionType;
  creationTime: string;
  comment?: string;
}

export interface DonationEntry {
  id: string;
  eventTime: string;
  processedAt: string;
  playerId?: string;
  playerUsername: string;
  amount: number;
  /** Assente = "gold" (storico salvato prima del tracciamento gemme) */
  currency?: "gold" | "gems";
  comment?: string;
  rawAction: string;
  notificationMessageId?: string;
  notificationChannelId?: string;
}

export interface ClanOverviewDto {
  clan: { id: string; name: string; tag?: string; memberCount?: number; maxMemberCount?: number; iconUrl?: string } | null;
  members: WvClanMember[];
  logs: WvClanLogEntry[];
  ledger: ClanGoldTransaction[];
  donations: DonationEntry[];
}

export interface DeletedModifiedLogEntry {
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
  oldAttachments?: DeletedModifiedAttachment[];
  newAttachments?: DeletedModifiedAttachment[];
  deletedAttachments?: DeletedModifiedAttachment[];
}

export interface DeletedModifiedAttachment {
  name: string;
  url: string;
  contentType?: string | null;
  size?: number;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon?: string;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  parentId?: string | null;
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
}

export interface BotStatusDto {
  online: boolean;
  platform: string;
  uptime: string;
  uptimeSeconds: number;
  guildsCount: number;
  membersCount: number;
  pingMs: number;
  modules: {
    welcome: boolean;
    leave: boolean;
    autorole: boolean;
    tts: boolean;
    logs: boolean;
    joinRequests?: boolean;
  };
  port: number;
  startedAt: string;
}

export interface GuildActivityDay {
  date: string;
  messages: Record<string, number>;
  voiceSeconds: Record<string, number>;
}

export interface GuildActivityUser {
  userId: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  messages: number;
  voiceSeconds: number;
}

export interface GuildActivityDto {
  days: GuildActivityDay[];
  users: GuildActivityUser[];
}

export interface BotConfigDto {
  pollChannelId?: string | null;
  notifyChannelIds: string[];
  pollDurationHours?: number;
  pingRoleId?: string;
  pilgrimRoleId?: string;
  welcomeLeaveConfigs: GuildWelcomeLeave[];
  scheduledMessages: ScheduledMessage[];
  ttsConfigs: GuildTTS[];
  logsConfigs: GuildLogs[];
  deletedModifiedLogs: DeletedModifiedLogEntry[];
  roseLobbyChannelId?: string;
}

export interface TempleOnboardingTemple {
  key: string;
  roleId?: string;
  channelId?: string;
  coLeaderRoleIds?: string[];
  assetUrl?: string;
  enabled?: boolean;
  welcomeMessage?: string;
  templeMessage?: string;
  generalMessage?: string;
  selectionDescription?: string;
  godRoleIds?: string[];
  roleIds?: string[];
  routineEnabled?: boolean;
  routineMessage?: string;
}

export interface TemplePopulation {
  key: string;
  displayName: string;
  count: number;
  enabled: boolean;
  roleId?: string;
}

export interface GuildTempleOnboarding {
  guildId: string;
  guildName: string;
  enabled?: boolean;
  selectionChannelId?: string;
  approvalChannelId?: string;
  generalChannelId?: string;
  approvalRoleIds?: string[];
  selectionMessage?: string;
  forcedSelectionMessage?: string;
  approvalMessage?: string;
  moduleOfferMessage?: string;
  approvedGeneralMessage?: string;
  approvedTempleMessage?: string;
  sendGeneralMessage?: boolean;
  sendTempleMessage?: boolean;
  assignTempleRole?: boolean;
  assignXpRole?: boolean;
  fetchXpFromWolvesville?: boolean;
  temples: TempleOnboardingTemple[];
  requests?: any[];
  population?: TemplePopulation[];
}
