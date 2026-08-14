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
  ttsSourceChannelId?: string;
  ttsVoiceChannelId?: string;
  ttsLanguage?: string;
  ttsPrefixes?: string[];
}

export interface GuildLogs {
  guildId: string;
  guildName: string;
  enabled?: boolean;
  channelId?: string;
  interceptApps?: boolean;
  interceptUsers?: boolean;
}

export interface ScheduledMessage {
  id: string;
  guildId: string;
  channelId: string;
  message: string;
  isRecurring: boolean;
  recurrenceInterval?: string;
  scheduledTime: string;
  lastSent?: string;
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

export interface ClanOverviewDto {
  clan: { id: string; name: string; tag?: string; memberCount?: number; maxMemberCount?: number; iconUrl?: string } | null;
  members: WvClanMember[];
  logs: WvClanLogEntry[];
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
  };
  port: number;
  startedAt: string;
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
