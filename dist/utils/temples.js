import { normalize } from "./normalize.js";
import { THRESHOLD_ROLE_ID_SET, loadConfig } from "./storage.js";
// Fonte unica di verità sui templi: usata sia da /family sia dal tracker donazioni.
// Se aggiungi/rinomini un tempio in-game, aggiornalo SOLO qui.
export const TEMPLE_DEFINITIONS = [
    {
        key: "rinascita",
        displayName: "Tempio della Rinascita",
        aliases: ["rinascita", "rinascista"],
        coLeaderRoleNames: ["persefone", "demetra"],
        flairMarkers: ["🐍", "🥀"],
    },
    {
        key: "abisso",
        displayName: "Tempio degli Abissi",
        aliases: ["abisso", "abissi"],
        coLeaderRoleNames: ["poseidone"],
        flairMarkers: ["🔱"],
    },
    {
        key: "eclissi",
        displayName: "Tempio dell'Eclissi",
        aliases: ["eclissi", "eclisse"],
        coLeaderRoleNames: ["apollo", "artemide"],
        flairMarkers: ["☀️", "☀", "🌙"],
    },
    {
        key: "folgori",
        displayName: "Tempio delle Folgori",
        aliases: ["folgori", "folgore"],
        coLeaderRoleNames: ["zeus"],
        flairMarkers: ["⚡️", "⚡"],
    },
];
export function matchesTempleAlias(text, definition) {
    const normalizedText = normalize(text);
    return definition.aliases.some((alias) => normalizedText.includes(normalize(alias)));
}
function stripEmojiVariants(s) {
    return s.replace(/\u{FE0E}|\u{FE0F}/gu, "").replace(/\s+/g, "");
}
/**
 * Dato l'esatto valore del campo `flair` restituito da Wolvesville per un
 * membro del clan (es. "🔱", "☀️🌙", "Poseidone 🔱", "🐍🥀", "Zeus⚡️"),
 * restituisce la key del tempio a cui appartiene il giocatore, oppure
 * `null` se il flair non corrisponde a nessun tempio (es. etichetta
 * personalizzata come "🎐").
 */
export function templeKeyFromFlair(flair) {
    if (!flair)
        return null;
    const f = stripEmojiVariants(flair);
    if (!f)
        return null;
    for (const def of TEMPLE_DEFINITIONS) {
        for (const raw of def.flairMarkers) {
            if (f.includes(stripEmojiVariants(raw)))
                return def.key;
        }
    }
    return null;
}
/**
 * Restituisce la posizione (indice) di un tempio nell'array
 * `TEMPLE_DEFINITIONS`. Serve per parallelizzare gli array paralleli
 * della BotConfig (templeRoleNames, notifyChannelNames, ecc.).
 */
export function templeIndexForKey(key) {
    return TEMPLE_DEFINITIONS.findIndex((d) => d.key === key);
}
export function isTempleBaseRole(role, definition) {
    const roleNorm = normalize(role.name);
    return roleNorm.includes("tempio") && matchesTempleAlias(role.name, definition);
}
export function isTempleMemberRole(role, definition) {
    if (!matchesTempleAlias(role.name, definition))
        return false;
    const roleNorm = normalize(role.name);
    return (THRESHOLD_ROLE_ID_SET.has(role.id) ||
        roleNorm.includes("tempio") ||
        roleNorm.includes("ilota"));
}
/** Risolve, per ogni tempio definito, il Role Discord corrispondente (configurato o inferito per nome). */
export function resolveTempleRoles(guild) {
    const config = loadConfig();
    const configuredRoles = (config.templeRoleNames ?? [])
        .map((name) => guild.roles.cache.find((role) => role.name === name) ?? null)
        .filter((role) => Boolean(role));
    const templeRoleMap = new Map();
    for (const definition of TEMPLE_DEFINITIONS) {
        const configuredRole = configuredRoles.find((role) => matchesTempleAlias(role.name, definition)) ?? null;
        if (configuredRole) {
            templeRoleMap.set(definition.key, configuredRole);
            continue;
        }
        const inferredRole = guild.roles.cache
            .filter((role) => role.name !== "@everyone" && !role.managed && isTempleBaseRole(role, definition))
            .sort((a, b) => b.position - a.position)
            .first() ?? null;
        templeRoleMap.set(definition.key, inferredRole);
    }
    return templeRoleMap;
}
/**
 * Dato un membro Discord, restituisce la key del PRIMO tempio a cui appartiene
 * (in base ai suoi ruoli), oppure null se non appartiene a nessun tempio.
 * Un membro con ruoli di più templi (raro, es. co-capo "in prestito") ottiene
 * il primo match secondo l'ordine di TEMPLE_DEFINITIONS.
 */
export function resolveTempleKeyForMember(member) {
    for (const definition of TEMPLE_DEFINITIONS) {
        const hasTempleRole = member.roles.cache.some((role) => isTempleMemberRole(role, definition));
        if (hasTempleRole)
            return definition.key;
    }
    return null;
}
/**
 * Per ogni tempio definito, restituisce il canale Discord (TextChannel) che
 * l'utente ha configurato in `/impostazioni` come canale notifiche per quel
 * tempio.
 *
 * Logica di matching:
 *   1. Prende `notifyChannelNames` (o `notifyChannelIds` in cache) dalla
 *      BotConfig e cerca la corrispondenza con il NOME del canale.
 *   2. Per ogni canale, usa `matchesTempleAlias` sul nome del canale (es.
 *      "notifiche-abissi" → alias "abissi" → abisso).
 *   3. Se nessuna corrispondenza per alias, fa fallback ordinando
 *      parallelamente: i canali nell'ordine in cui sono stati scelti in
 *      `/impostazioni` corrispondono a `TEMPLE_DEFINITIONS` (rinascita,
 *      abisso, eclissi, folgori).
 *
 * Restituisce `null` per i templi che non hanno un canale assegnato.
 */
export function resolveNotifyChannelsByTemple(guild) {
    const config = loadConfig();
    const byName = new Map();
    const byId = new Map();
    const ordered = [];
    const notifyIds = config.notifyChannelIds ?? [];
    const notifyNames = config.notifyChannelNames ?? [];
    for (let i = 0; i < notifyIds.length; i++) {
        const id = notifyIds[i];
        const ch = guild.channels.cache.get(id);
        if (ch && ch.isTextBased() && !ch.isThread()) {
            const tc = ch;
            byId.set(id, tc);
            ordered.push(tc);
        }
    }
    for (const name of notifyNames) {
        const ch = guild.channels.cache.find((c) => c.name === name);
        if (ch && ch.isTextBased() && !ch.isThread())
            byName.set(name, ch);
    }
    const result = new Map();
    TEMPLE_DEFINITIONS.forEach((def, idx) => {
        let match = null;
        for (const tc of ordered) {
            if (matchesTempleAlias(tc.name, def)) {
                match = tc;
                break;
            }
        }
        if (!match && notifyNames[idx]) {
            const byN = byName.get(notifyNames[idx]);
            if (byN)
                match = byN;
        }
        if (!match && ordered[idx])
            match = ordered[idx] ?? null;
        result.set(def.key, match ?? null);
    });
    return result;
}
//# sourceMappingURL=temples.js.map