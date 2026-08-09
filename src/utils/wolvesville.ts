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
  equippedAvatar?: { imageUrl?: string; id?: string } | null;
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
  const resp = await fetch(`${WV_BASE}/clans/${clanId}`, {
    headers: headers(),
  });
  if (resp.status === 404) return null;
  if (!resp.ok) return null;
  return resp.json() as Promise<WvClan>;
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

export function profileIconUrl(iconId?: string): string | null {
  if (!iconId) return null;
  return `${CDN_BASE}/profileIcons/${iconId}.png`;
}

export function profileFrameUrl(borderId?: string): string | null {
  if (!borderId) return null;
  return `${CDN_BASE}/profileIconBorders/${borderId}.png`;
}
