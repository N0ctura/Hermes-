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
        Authorization: `Bot ${process.env["WOLVESVILLE_PERSONAL_API_KEY"] ?? process.env["WOLVESVILLE_API_KEY"] ?? ""}`,
        "Content-Type": "application/json",
        Accept: "application/json",
    };
}
export async function fetchAvailableQuests(clanId) {
    const resp = await fetch(`${WV_BASE}/clans/${clanId}/quests/available`, {
        headers: headers(),
    });
    if (resp.status === 401) {
        throw new Error("401_UNAUTHORIZED: Il bot Wolvesville non è stato aggiunto come clan bot. Il leader del clan deve andare in Impostazioni clan → Bot e aggiungere questo bot.");
    }
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Wolvesville API error ${resp.status}: ${text}`);
    }
    return resp.json();
}
export async function fetchAllQuests() {
    const resp = await fetch(`${WV_BASE}/clans/quests/all`, {
        headers: headers(),
    });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Wolvesville API error ${resp.status}: ${text}`);
    }
    return resp.json();
}
export async function fetchAvatarItems() {
    const resp = await fetch(`${WV_BASE}/items/avatarItems`, {
        headers: headers(),
    });
    if (!resp.ok)
        throw new Error(`Wolvesville API error ${resp.status}`);
    return resp.json();
}
export async function fetchPlayerByUsername(username) {
    const resp = await fetch(`${WV_BASE}/players/search?username=${encodeURIComponent(username)}`, {
        headers: personalHeaders(),
    });
    if (resp.status === 404)
        return null;
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Wolvesville API error ${resp.status}: ${text}`);
    }
    return resp.json();
}
export async function fetchClanById(clanId) {
    const resp = await fetch(`${WV_BASE}/clans/${clanId}/info`, {
        headers: headers(),
    });
    if (resp.status === 404)
        return null;
    if (!resp.ok)
        return null;
    return resp.json();
}
export async function fetchClanMembers(clanId) {
    const resp = await fetch(`${WV_BASE}/clans/${clanId}/members`, {
        headers: headers(),
    });
    if (resp.status === 401) {
        throw new Error("401_UNAUTHORIZED: Il bot Wolvesville non è stato aggiunto come clan bot con pieno accesso. Il leader del clan deve andare in Impostazioni clan → Bot e concedere l'accesso completo.");
    }
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Wolvesville API error ${resp.status}: ${text}`);
    }
    return resp.json();
}
export async function shuffleQuests(clanId) {
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
export async function fetchClanLog(clanId, since) {
    const url = new URL(`${WV_BASE}/clans/${clanId}/logs`);
    if (since)
        url.searchParams.set("since", since);
    const resp = await fetch(url, { headers: headers() });
    if (resp.status === 401) {
        throw new Error("401_UNAUTHORIZED: Il bot Wolvesville non è stato aggiunto come clan bot con pieno accesso. Il leader del clan deve andare in Impostazioni clan → Bot e concedere l'accesso completo.");
    }
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Wolvesville API error ${resp.status}: ${text}`);
    }
    const data = (await resp.json());
    if (Array.isArray(data))
        return data;
    if (data && typeof data === "object" && Array.isArray(data.entries)) {
        return data.entries;
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
export async function fetchClanLedger(clanId) {
    const resp = await fetch(`${WV_BASE}/clans/${clanId}/ledger`, {
        headers: headers(),
    });
    if (resp.status === 401) {
        throw new Error("401_UNAUTHORIZED: Il bot Wolvesville non è stato aggiunto come clan bot. Il leader del clan deve andare in Impostazioni clan → Bot e aggiungere questo bot.");
    }
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Wolvesville API ledger error ${resp.status}: ${text}`);
    }
    const data = (await resp.json());
    if (Array.isArray(data))
        return data;
    if (data && typeof data === "object" && Array.isArray(data.entries)) {
        return data.entries;
    }
    return [];
}
export function profileIconUrl(iconId) {
    if (!iconId)
        return null;
    return `${CDN_BASE}/profileIcons/${iconId}.png`;
}
export function profileFrameUrl(borderId) {
    if (!borderId)
        return null;
    return `${CDN_BASE}/profileIconBorders/${borderId}.png`;
}
//# sourceMappingURL=wolvesville.js.map