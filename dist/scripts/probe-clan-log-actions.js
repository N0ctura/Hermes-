/**
 * Script diagnostico — NON fa parte del bot in esecuzione.
 *
 * Ora che sappiamo che l'endpoint giusto è /clans/{clanId}/logs (plurale)
 * e che il campo tipo-evento si chiama "action", questo script:
 * 1. Scarica il log completo
 * 2. Stampa l'elenco di tutti i valori UNICI del campo "action" presenti
 *    (con quante volte compare ciascuno)
 * 3. Stampa per intero le entry di ogni action che sembra plausibile per
 *    una donazione (contiene "GOLD", "DONAT", "CONTRIB", "GIFT" nel nome)
 *
 * Uso:
 *   npx tsx src/scripts/probe-clan-log-actions.ts
 *
 * Se non vedi ancora una action plausibile: fai una donazione di test nel
 * gioco e rilancia subito lo script, poi guarda le action più recenti
 * (ordina per creationTime).
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
async function main() {
    const clanId = process.env["WOLVESVILLE_CLAN_ID"];
    if (!clanId) {
        console.error("❌ WOLVESVILLE_CLAN_ID non impostato in .env");
        process.exit(1);
    }
    const url = `${WV_BASE}/clans/${clanId}/logs`;
    const resp = await fetch(url, { headers: headers() });
    if (!resp.ok) {
        console.error(`❌ Errore ${resp.status}:`, await resp.text());
        process.exit(1);
    }
    const data = (await resp.json());
    console.log(`Ricevute ${data.length} entry totali.\n`);
    // Conta occorrenze per ogni action
    const counts = new Map();
    for (const entry of data) {
        const action = entry.action ?? "(nessun campo action)";
        counts.set(action, (counts.get(action) ?? 0) + 1);
    }
    console.log("--- Azioni uniche trovate nel log ---\n");
    for (const [action, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`${count.toString().padStart(4)}x  ${action}`);
    }
    // Cerca action plausibili per donazioni
    const donationLike = [...counts.keys()].filter((a) => /gold|donat|contrib|gift|resource/i.test(a));
    if (donationLike.length > 0) {
        console.log("\n--- Entry di esempio per action plausibili di donazione ---\n");
        for (const action of donationLike) {
            const example = data.find((e) => e.action === action);
            console.log(`Action: ${action}`);
            console.log(JSON.stringify(example, null, 2));
            console.log("");
        }
    }
    else {
        console.log("\n⚠️  Nessuna action con nome che richiami 'gold/donat/contrib/gift' trovata.\n" +
            "Fai una donazione di test in gioco ORA, rilancia subito questo script,\n" +
            "e guarda le entry con creationTime più recente (potrebbero non essere\n" +
            "ancora nella prima pagina se l'API pagina i risultati).");
    }
    // Mostra comunque le 5 entry più recenti per riferimento
    const sorted = [...data].sort((a, b) => new Date(b.creationTime).getTime() - new Date(a.creationTime).getTime());
    console.log("\n--- Le 5 entry più recenti (per riferimento) ---\n");
    console.log(JSON.stringify(sorted.slice(0, 5), null, 2));
}
main();
//# sourceMappingURL=probe-clan-log-actions.js.map