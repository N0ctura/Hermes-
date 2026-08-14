import type { Guild, GuildMember, Role } from "discord.js";
import { normalize } from "./normalize.js";
import { THRESHOLD_ROLE_ID_SET, loadConfig } from "./storage.js";

export type TempleDefinition = {
  key: string;
  displayName: string;
  aliases: string[];
  coLeaderRoleNames: string[];
};

// Fonte unica di verità sui templi: usata sia da /family sia dal tracker donazioni.
// Se aggiungi/rinomini un tempio in-game, aggiornalo SOLO qui.
export const TEMPLE_DEFINITIONS: TempleDefinition[] = [
  {
    key: "rinascita",
    displayName: "Tempio della Rinascita",
    aliases: ["rinascita", "rinascista"],
    coLeaderRoleNames: ["persefone", "demetra"],
  },
  {
    key: "abisso",
    displayName: "Tempio degli Abissi",
    aliases: ["abisso", "abissi"],
    coLeaderRoleNames: ["poseidone"],
  },
  {
    key: "eclissi",
    displayName: "Tempio dell'Eclissi",
    aliases: ["eclissi", "eclisse"],
    coLeaderRoleNames: ["apollo", "artemide"],
  },
  {
    key: "folgori",
    displayName: "Tempio delle Folgori",
    aliases: ["folgori", "folgore"],
    coLeaderRoleNames: ["zeus"],
  },
];

export function matchesTempleAlias(text: string, definition: TempleDefinition): boolean {
  const normalizedText = normalize(text);
  return definition.aliases.some((alias) => normalizedText.includes(normalize(alias)));
}

export function isTempleBaseRole(role: Role, definition: TempleDefinition): boolean {
  const roleNorm = normalize(role.name);
  return roleNorm.includes("tempio") && matchesTempleAlias(role.name, definition);
}

export function isTempleMemberRole(role: Role, definition: TempleDefinition): boolean {
  if (!matchesTempleAlias(role.name, definition)) return false;

  const roleNorm = normalize(role.name);
  return (
    THRESHOLD_ROLE_ID_SET.has(role.id) ||
    roleNorm.includes("tempio") ||
    roleNorm.includes("ilota")
  );
}

/** Risolve, per ogni tempio definito, il Role Discord corrispondente (configurato o inferito per nome). */
export function resolveTempleRoles(guild: Guild): Map<string, Role | null> {
  const config = loadConfig();
  const configuredRoles = (config.templeRoleNames ?? [])
    .map((name) => guild.roles.cache.find((role) => role.name === name) ?? null)
    .filter((role): role is Role => Boolean(role));

  const templeRoleMap = new Map<string, Role | null>();

  for (const definition of TEMPLE_DEFINITIONS) {
    const configuredRole =
      configuredRoles.find((role) => matchesTempleAlias(role.name, definition)) ?? null;
    if (configuredRole) {
      templeRoleMap.set(definition.key, configuredRole);
      continue;
    }

    const inferredRole =
      guild.roles.cache
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
export function resolveTempleKeyForMember(member: GuildMember): string | null {
  for (const definition of TEMPLE_DEFINITIONS) {
    const hasTempleRole = member.roles.cache.some((role) => isTempleMemberRole(role, definition));
    if (hasTempleRole) return definition.key;
  }
  return null;
}
