/**
 * Script diagnostico — NON fa parte del bot in esecuzione.
 *
 * L'endpoint /clans/{clanId}/logs ha restituito UNA sola entry: quasi
 * certamente pagina i risultati (o mostra solo gli eventi recenti) e non
 * abbiamo ancora trovato il parametro giusto per allargare la finestra.
 *
 * Questo script prova una serie di query-string comuni (limit, count,
 * pageSize, before/after/since con date molto vecchie, cursor, page...)
 * e stampa quante entry restituisce ciascuna variante, così troviamo
 * quella che sblocca lo storico.
 *
 * Uso:
 *   npx tsx src/scripts/probe-clan-logs-pagination.ts
 */
import "dotenv/config";

const WV_BASE = "https://api.wolvesville.com";

function headers() {
  return {
    Authorization: `Bot ${process.env["WOLVESVILLE_API_KEY"] ?? ""}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function buildVariants(clanId: string): { label: string; qs: string }[] {
  const base = `/clans/${clanId}/logs`;
  const veryOld = "2020-01-01T00:00:00.000Z";
  return [
    { label: "(nessun parametro, baseline)", qs: "" },
    { label: "limit=100", qs: "?limit=100" },
    { label: "limit=1000", qs: "?limit=1000" },
    { label: "count=100", qs: "?count=100" },
    { label: "pageSize=100", qs: "?pageSize=100" },
    { label: "size=100", qs: "?size=100" },
    { label: `since=${veryOld}`, qs: `?since=${veryOld}` },
    { label: `after=${veryOld}`, qs: `?after=${veryOld}` },
    { label: `from=${veryOld}`, qs: `?from=${veryOld}` },
    { label: `startTime=${veryOld}`, qs: `?startTime=${veryOld}` },
    { label: "page=0", qs: "?page=0" },
    { label: "page=0&limit=100", qs: "?page=0&limit=100" },
    { label: "offset=0&limit=100", qs: "?offset=0&limit=100" },
  ];
}

async function main() {
  const clanId = process.env["WOLVESVILLE_CLAN_ID"];
  if (!clanId) {
    console.error("❌ WOLVESVILLE_CLAN_ID non impostato in .env");
    process.exit(1);
  }

  console.log(`Provo varianti di paginazione su /clans/${clanId}/logs...\n`);

  for (const variant of buildVariants(clanId)) {
    const url = `${WV_BASE}/clans/${clanId}/logs${variant.qs}`;
    try {
      const resp = await fetch(url, { headers: headers() });
      if (!resp.ok) {
        console.log(`${variant.label.padEnd(30)} → HTTP ${resp.status}`);
        continue;
      }
      const data = (await resp.json()) as unknown;
      const arr = Array.isArray(data)
        ? data
        : data && typeof data === "object" && Array.isArray((data as any).entries)
        ? (data as any).entries
        : null;

      if (arr === null) {
        console.log(`${variant.label.padEnd(30)} → risposta non è un array (forma: ${typeof data})`);
        continue;
      }
      console.log(`${variant.label.padEnd(30)} → ${arr.length} entry`);
    } catch (err) {
      console.log(`${variant.label.padEnd(30)} → errore:`, err);
    }
  }

  console.log(
    "\nSe una variante restituisce più di 1 entry, rilancia lo script " +
      "probe-clan-log-actions.ts aggiungendo la stessa query string all'URL " +
      "per vedere tutte le action disponibili nello storico più ampio."
  );
}

main();
