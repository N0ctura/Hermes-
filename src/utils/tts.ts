import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayer,
  VoiceConnection,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  VoiceConnectionStatus,
  StreamType,
} from "@discordjs/voice";
import { GuildMember, TextChannel, VoiceChannel, Client, VoiceState } from "discord.js";
import { logger } from "./logger.js";
import { loadConfig, saveConfig, type GuildTTSConfig } from "./storage.js";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";

const ASSETS_DIR = path.join(process.cwd(), "assets");
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

logger.info("TTS: Using system FFmpeg");

const connections: Map<string, VoiceConnection> = new Map();
const players: Map<string, AudioPlayer> = new Map();
const queues: Map<string, string[]> = new Map();
const isPlaying: Map<string, boolean> = new Map();
const activeVoiceChannels: Map<string, string> = new Map();

function removeEmojis(str: string): string {
  const emojiRegex =
    /[\p{Emoji}\p{Emoji_Component}\p{Emoji_Modifier}\p{Emoji_Modifier_Base}\p{Emoji_Presentation}]/gu;
  return str.replace(emojiRegex, "").trim();
}

async function textToMp3File(text: string, lang: string = "it"): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      logger.info({ text, lang }, "TTS: creazione audio MP3");

      const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&q=${encodeURIComponent(text)}&tl=${lang}&total=1&idx=0`;

      const req = https.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "http://translate.google.com/",
        },
      }, (res) => {
        if (res.statusCode !== 200) {
          logger.error(
            { statusCode: res.statusCode, statusMessage: res.statusMessage, text, lang },
            "TTS: errore risposta API"
          );
          reject(new Error(`Errore API TTS: ${res.statusCode} ${res.statusMessage}`));
          return;
        }

        const tempFilePath = path.join(ASSETS_DIR, `temp_tts_${Date.now()}.mp3`);
        const fileStream = fs.createWriteStream(tempFilePath);

        res.pipe(fileStream);

        fileStream.on("finish", () => {
          fileStream.close();
          logger.info({ tempFilePath, text }, "TTS: file audio salvato");
          resolve(tempFilePath);
        });

        res.on("error", (err) => {
          logger.error({ err, text, lang }, "TTS: errore risposta API");
          reject(err);
        });
      });

      req.on("error", (err) => {
        logger.error({ err, text, lang }, "TTS: errore richiesta");
        reject(err);
      });
    } catch (err) {
      logger.error({ err, text }, "Errore nella funzione textToMp3File");
      reject(err);
    }
  });
}

export async function playTextInChannel(
  guildId: string,
  voiceChannelId: string,
  text: string,
  lang: string = "it",
  client?: Client
): Promise<void> {
  if (!client) {
    logger.error({ guildId }, "TTS: client Discord non disponibile");
    return;
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    logger.warn({ guildId }, "TTS: guild non trovata");
    return;
  }

  const voiceChannel = guild.channels.cache.get(voiceChannelId) as VoiceChannel;
  if (!voiceChannel) {
    logger.warn({ guildId, voiceChannelId }, "TTS: canale vocale non trovato");
    return;
  }

  logger.info({ guildId, channelId: voiceChannel.id, text }, "TTS: avvio riproduzione");

  let connection = connections.get(guildId);
  if (!connection) {
    connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guildId,
      adapterCreator: guild.voiceAdapterCreator as any,
      selfDeaf: false,
      selfMute: false,
    });

    connection.on(VoiceConnectionStatus.Ready, () => {
      logger.info({ guildId }, "TTS: connessione vocale pronta");
    });

    connection.on(VoiceConnectionStatus.Disconnected, () => {
      logger.info({ guildId }, "TTS: connessione vocale disconnessa");
      connections.delete(guildId);
      activeVoiceChannels.delete(guildId);
    });

    connections.set(guildId, connection);
    activeVoiceChannels.set(guildId, voiceChannelId);
    logger.info({ guildId, channelId: voiceChannel.id }, "TTS: connessione vocale creata");
  }

  let player = players.get(guildId);
  if (!player) {
    player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause,
      },
    });
    players.set(guildId, player);
    connection.subscribe(player);

    player.on(AudioPlayerStatus.Idle, async () => {
      logger.info({ guildId }, "TTS: riproduzione terminata (idle)");
      isPlaying.set(guildId, false);
      const queue = queues.get(guildId) || [];
      if (queue.length > 0) {
        const nextText = queue.shift()!;
        queues.set(guildId, queue);
        await playFromQueue(guildId, nextText, lang);
      }
    });

    player.on("error", (error) => {
      logger.error({ error, guildId }, "TTS: errore nel player audio");
    });
  }

  if (isPlaying.get(guildId)) {
    const queue = queues.get(guildId) || [];
    queue.push(text);
    queues.set(guildId, queue);
    logger.debug({ guildId, text }, "TTS: aggiunto alla coda");
    return;
  }

  await playFromQueue(guildId, text, lang);
}

async function playFromQueue(
  guildId: string,
  text: string,
  lang: string = "it"
): Promise<void> {
  let tempFilePath: string | null = null;
  try {
    isPlaying.set(guildId, true);
    logger.info({ guildId, text }, "TTS: playFromQueue iniziato");

    tempFilePath = await textToMp3File(text, lang);
    logger.info({ guildId, text, tempFilePath }, "TTS: file audio creato");

    const resource = createAudioResource(tempFilePath, {
      inputType: StreamType.Arbitrary,
      inlineVolume: true,
    });
    logger.info({ guildId, text }, "TTS: risorsa audio creata");

    const player = players.get(guildId);
    if (!player) {
      logger.error({ guildId }, "TTS: nessun player disponibile");
      isPlaying.set(guildId, false);
      return;
    }

    player.on("error", (err) => {
      logger.error({ err, guildId }, "TTS: ERRORE PLAYER DURANTE RIPRODUZIONE");
    });

    player.play(resource);
    logger.info({ guildId, text }, "TTS: play() chiamato");

  } catch (err) {
    logger.error({
      err: err,
      message: (err as Error)?.message,
      stack: (err as Error)?.stack,
      guildId,
      text,
    }, "TTS: errore durante playFromQueue");
    isPlaying.set(guildId, false);
  } finally {
    if (tempFilePath) {
      const filePath = tempFilePath;
      setTimeout(() => {
        fs.unlink(filePath, (err) => {
          if (err) {
            logger.warn({ err, tempFilePath: filePath }, "TTS: impossibile eliminare file temporaneo");
          } else {
            logger.debug({ tempFilePath: filePath }, "TTS: file temporaneo eliminato");
          }
        });
      }, 10000);
    }
  }
}

export function stopTTS(guildId: string): void {
  const connection = connections.get(guildId);
  if (connection) {
    connection.destroy();
    connections.delete(guildId);
    activeVoiceChannels.delete(guildId);
  }
  const player = players.get(guildId);
  if (player) {
    player.stop();
    players.delete(guildId);
  }
  queues.delete(guildId);
  isPlaying.set(guildId, false);
  logger.info({ guildId }, "TTS: fermato e disconnesso");
}

export async function playText(
  member: GuildMember,
  text: string,
  lang: string = "it"
): Promise<void> {
  const voiceChannelId = member.voice.channelId;
  if (!voiceChannelId) {
    throw new Error("L'utente non è in un canale vocale!");
  }

  await playTextInChannel(member.guild.id, voiceChannelId, text, lang, member.client);
}

export async function handleMessageForTTS(message: {
  guildId: string;
  channelId: string;
  content: string;
  member: GuildMember;
  client: Client;
}): Promise<void> {
  const ttsConfig = getTTSConfig(message.guildId);

  let shouldSpeak = false;
  let textToSpeak = "";

  if (ttsConfig.ttsEnabled && ttsConfig.ttsSourceChannelId && message.channelId === ttsConfig.ttsSourceChannelId) {
    shouldSpeak = true;
    textToSpeak = message.content;
  } else {
    for (const prefix of ttsConfig.ttsPrefixes!) {
      if (message.content.startsWith(prefix)) {
        shouldSpeak = true;
        textToSpeak = message.content.slice(prefix.length).trim();
        break;
      }
    }
  }

  if (!shouldSpeak || !textToSpeak) {
    return;
  }

  let voiceChannelId = message.member.voice.channelId;

  if (!voiceChannelId) {
    voiceChannelId = ttsConfig.ttsVoiceChannelId ?? activeVoiceChannels.get(message.guildId) ?? null;
  }

  if (!voiceChannelId) {
    logger.warn({ guildId: message.guildId, userId: message.member.id }, "TTS: nessun canale vocale disponibile");
    return;
  }

  let cleanUsername: string | null = null;
  if (!ttsConfig.ttsEnabled || !ttsConfig.ttsSourceChannelId) {
    cleanUsername = null;
  } else {
    cleanUsername = removeEmojis(message.member.displayName || message.member.user.username);
  }

  const fullText = cleanUsername ? `${cleanUsername} dice: ${textToSpeak}` : textToSpeak;

  logger.debug({ guildId: message.guildId, text: fullText }, "TTS: nuovo messaggio da leggere");

  await playTextInChannel(
    message.guildId,
    voiceChannelId,
    fullText,
    ttsConfig.ttsLanguage || "it",
    message.client
  );
}

export async function handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
  if (newState.member?.user.id === newState.client.user?.id) {
    if (!newState.channelId && oldState.channelId) {
      stopTTS(newState.guild.id);
    }
    return;
  }
}

export function setTTSConfig(config: GuildTTSConfig): void {
  const botConfig = loadConfig();
  const ttsConfigs = botConfig.ttsConfigs || [];
  const existingIndex = ttsConfigs.findIndex((c: GuildTTSConfig) => c.guildId === config.guildId);

  if (existingIndex !== -1) {
    ttsConfigs[existingIndex] = config;
  } else {
    ttsConfigs.push(config);
  }

  saveConfig({ ...botConfig, ttsConfigs });
  logger.info({ guildId: config.guildId }, "TTS: configurazione salvata");
}

export function getTTSConfig(guildId: string): GuildTTSConfig {
  const botConfig = loadConfig();
  const config = botConfig.ttsConfigs?.find((c: GuildTTSConfig) => c.guildId === guildId);
  return {
    guildId,
    guildName: config?.guildName || "Unknown",
    ttsSourceChannelId: config?.ttsSourceChannelId,
    ttsVoiceChannelId: config?.ttsVoiceChannelId,
    ttsEnabled: config?.ttsEnabled ?? false,
    ttsLanguage: config?.ttsLanguage || "it",
    ttsPrefixes: config?.ttsPrefixes ?? [",", ";", "!"],
  };
}
