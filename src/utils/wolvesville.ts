const WV_BASE = "https://api.wolvesville.com";
const CDN_BASE = "https://cdn.wolvesville.com";

function headers() {
  return {
    Authorization: `Bot ${process.env["WOLVESVILLE_API_KEY"] ?? ""}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function personalHeaders() {
  return {
    Authorization: `Bot ${process.env["WOLVESVILLE_PERSONAL_API_KEY"] ?? ""}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export interface WvQuest {
  id: string;
  promoImageUrl: string;
  promoImagePrimaryColor?: string;
  purchasableWithGems: boolean;
  rewards: Array<{
    type: string;
    amount: number;
    avatarItemId?: string;
    displayType?: string;
  }>;
}

export interface WvAvatarItem {
  id: string;
  imageUrl: string;
  type: string;
  rarity: string;
  costInGold?: number;
  name?: string;
}

export interface WvClan {
  id: string;
  name: string;
  tag?: string;
  description?: string;
  memberCount?: number;
  maxMemberCount?: number;
  iconUrl?: string;
}

export interface WvPlayer {
  id: string;
  username: string;
  level: number;
  personalMessage?: string;
  status?: string;
  creationTime?: string;
  lastOnline?: string;
  rankedSeasonSkill?: number;
  rankedSeasonMaxSkill?: number;
  rankedSeasonBestRank?: number;
  rankedSeasonPlayedCount?: number;
  receivedRosesCount?: number;
  sentRosesCount?: number;
  profileIconId?: string;
  profileIconBorderId?: string;
  profileIconColor?: string;
  profileIconColorMode?: string;
  equippedAvatar?: { imageUrl?: string; url?: string; id?: string } | string | null;
  clanId?: string;
  gameStats?: {
    totalWinCount?: number;
    totalLoseCount?: number;
    totalTieCount?: number;
    villageWinCount?: number;
    villageLoseCount?: number;
    werewolfWinCount?: number;
    werewolfLoseCount?: number;
    votingWinCount?: number;
    soloWinCount?: number;
    totalPlayTimeInMinutes?: number;
  };
  playerTitle?: { title?: string };
}

export async function fetchAvailableQuests(clanId: string): Promise<WvQuest[]> {
  const resp = await fetch(`${WV_BASE}/clans/${clanId}/quests/available`, {
    headers: headers(),
  });

  if (resp.status === 401) {
    throw new Error(
      "401_UNAUTHORIZED: Il bot Wolvesville non è stato aggiunto come clan bot. Il leader del clan deve andare in Impostazioni clan → Bot e aggiungere questo bot."
    );
  }
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Wolvesville API error ${resp.status}: ${text}`);
  }

  return resp.json() as Promise<WvQuest[]>;
}

export async function fetchAllQuests(): Promise<WvQuest[]> {
  const resp = await fetch(`${WV_BASE}/clans/quests/all`, {
    headers: headers(),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Wolvesville API error ${resp.status}: ${text}`);
  }
  return resp.json() as Promise<WvQuest[]>;
}

export async function fetchAvatarItems(): Promise<WvAvatarItem[]> {
  const resp = await fetch(`${WV_BASE}/items/avatarItems`, {
    headers: headers(),
  });
  if (!resp.ok) throw new Error(`Wolvesville API error ${resp.status}`);
  return resp.json() as Promise<WvAvatarItem[]>;
}

export async function fetchPlayerByUsername(username: string): Promise<WvPlayer | null> {
  const resp = await fetch(`${WV_BASE}/players/search?username=${encodeURIComponent(username)}`, {
    headers: personalHeaders(),
  });
  if (resp.status === 404) return null;
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Wolvesville API error ${resp.status}: ${text}`);
  }
  return resp.json() as Promise<WvPlayer>;
}

export async function fetchClanById(clanId: string): Promise<WvClan | null> {
  const resp = await fetch(`${WV_BASE}/clans/${clanId}/info`, {
    headers: headers(),
  });
  if (resp.status === 404) return null;
  if (!resp.ok) return null;
  return resp.json() as Promise<WvClan>;
}

/**
 * Tipo di transazione oro del clan.
 * NOTA: il valore osservato realmente dall'endpoint /clans/{id}/ledger per una
 * donazione di un giocatore è "DONATE" (non "GOLD_DONATION" come indicato da
 * una precedente ipotesi sullo schema OpenAPI, mai verificata sul campo).
 * Teniamo comunque GOLD_DONATION/GOLD_DEPOSIT come alias di sicurezza, nel
 * caso l'API restituisca valori diversi in altri contesti.
 */
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

/**
 * Singola transazione del clan ledger (oro/gemme).
 * Endpoint: GET /clans/{clanId}/ledger
 * Risposta: array di ClanGoldTransaction.
 */
export interface ClanGoldTransaction {
  id: string;
  /** Importo di oro della transazione. Per una donazione è > 0. */
  gold: number;
  /** Importo di gemme della transazione. */
  gems: number;
  playerId?: string;
  playerUsername?: string;
  playerBotId?: string;
  playerBotOwnerUsername?: string;
  /** Quest associata (es. acquisto slot / claim reward). */
  clanQuestId?: string;
  type: ClanGoldTransactionType;
  creationTime: string;
  comment?: string;
}

/**
 * Rappresenta un membro del clan restituito da GET /clans/{clanId}/members.
 * Campi confermati empiricamente (nessun campo di oro/donazioni cumulativo
 * osservato finora).
 */
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
  profileIconColor?: string;
  profileIconColorMode?: string;
  flair?: string;
  participateInClanQuests?: boolean;
  [key: string]: unknown;
}

export async function fetchClanMembers(clanId: string): Promise<WvClanMember[]> {
  const resp = await fetch(`${WV_BASE}/clans/${clanId}/members`, {
    headers: headers(),
  });
  if (resp.status === 401) {
    throw new Error(
      "401_UNAUTHORIZED: Il bot Wolvesville non è stato aggiunto come clan bot con pieno accesso. Il leader del clan deve andare in Impostazioni clan → Bot e concedere l'accesso completo."
    );
  }
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Wolvesville API error ${resp.status}: ${text}`);
  }
  return resp.json() as Promise<WvClanMember[]>;
}

export async function shuffleQuests(clanId: string): Promise<void> {
  const resp = await fetch(`${WV_BASE}/clans/${clanId}/quests/available/shuffle`, {
    method: "POST",
    headers: headers(),
  });
  if (resp.status === 401) {
    throw new Error("401_UNAUTHORIZED: Bot non autorizzato come clan bot.");
  }
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Shuffle error ${resp.status}: ${text}`);
  }
}

/**
 * Rappresenta una entry del log/attività del clan Wolvesville.
 *
 * Endpoint confermato empiricamente: GET /clans/{clanId}/logs (plurale).
 * Il campo che identifica il tipo di evento si chiama `action` (non `type`
 * come ipotizzato inizialmente). Esempio osservato: `"action": "FLAIR_EDITED"`.
 *
 * ⚠️ Nota importante: l'endpoint sembra restituire SOLO l'evento più recente
 * in assoluto (non uno storico), e ignora i parametri di query comuni
 * (limit/since/page/offset — tutti testati). Non è ancora confermato se le
 * donazioni di oro generino una entry qui: finché non se ne osserva una dal
 * vivo, `donation-tracker.ts` non può fare affidamento su questo endpoint da
 * solo per rilevare le donazioni.
 */
export interface WvClanLogEntry {
  playerId?: string;
  playerUsername?: string;
  targetPlayerId?: string;
  targetPlayerUsername?: string;
  creationTime: string;
  action: string;
  comment?: string;
  [key: string]: unknown; // altri campi non ancora mappati (es. importo, xp, ecc.)
}

/**
 * Recupera le voci del log/attività del clan (in pratica, oggi, una sola
 * entry — vedi nota sopra). `since` viene comunque inviato per compatibilità
 * futura, ma è stato verificato che l'API attuale lo ignora.
 */
/**
 * Valore del campo `action` di WvClanLogEntry osservato empiricamente quando
 * un giocatore esterno manda una richiesta di ingresso al clan.
 * Esempio osservato dal vivo: action="JOIN_REQUEST_SENT_BY_EXTERNAL_PLAYER",
 * playerUsername="Kelly27".
 */
export const JOIN_REQUEST_LOG_ACTION = "JOIN_REQUEST_SENT_BY_EXTERNAL_PLAYER";

export async function fetchClanLog(clanId: string, since?: string): Promise<WvClanLogEntry[]> {
  const url = new URL(`${WV_BASE}/clans/${clanId}/logs`);
  if (since) url.searchParams.set("since", since);

  const resp = await fetch(url, { headers: headers() });

  if (resp.status === 401) {
    throw new Error(
      "401_UNAUTHORIZED: Il bot Wolvesville non è stato aggiunto come clan bot con pieno accesso. Il leader del clan deve andare in Impostazioni clan → Bot e concedere l'accesso completo."
    );
  }
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Wolvesville API error ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as unknown;
  if (Array.isArray(data)) return data as WvClanLogEntry[];
  if (data && typeof data === "object" && Array.isArray((data as any).entries)) {
    return (data as any).entries as WvClanLogEntry[];
  }
  return [];
}

/**
 * Recupera il "gold transaction ledger" del clan — lo storico ufficiale
 * di TUTTE le transazioni di oro/gemme del clan (donazioni, spese per
 * quest, premi, ritiri, ecc.). A differenza di /logs restituisce
 * tipicamente più entry recenti (non solo 1) e include i campi:
 *   - id (UUID univoco — perfetto per deduplicare)
 *   - gold (importo)
 *   - type (es. GOLD_DONATION)
 *   - playerId / playerUsername
 * L'endpoint al momento non supporta parametri di paginazione/since noti.
 */
export async function fetchClanLedger(clanId: string): Promise<ClanGoldTransaction[]> {
  const resp = await fetch(`${WV_BASE}/clans/${clanId}/ledger`, {
    headers: headers(),
  });

  if (resp.status === 401) {
    throw new Error(
      "401_UNAUTHORIZED: Il bot Wolvesville non è stato aggiunto come clan bot. Il leader del clan deve andare in Impostazioni clan → Bot e aggiungere questo bot."
    );
  }
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Wolvesville API ledger error ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as unknown;
  if (Array.isArray(data)) return data as ClanGoldTransaction[];
  if (data && typeof data === "object" && Array.isArray((data as any).entries)) {
    return (data as any).entries as ClanGoldTransaction[];
  }
  return [];
}

export function profileIconUrl(iconId?: string): string | null {
  if (!iconId) return null;
  return `${CDN_BASE}/profileIcons/${iconId}.png`;
}

export function profileFrameUrl(borderId?: string): string | null {
  if (!borderId) return null;
  return `${CDN_BASE}/profileIconBorders/${borderId}.png`;
}
