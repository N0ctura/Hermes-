/**
 * Script diagnostico — NON fa parte del bot in esecuzione.
 *
 * Serve a rispondere a UNA domanda prima di attivare /donazioni attiva:
 * "come si presenta davvero un evento di donazione nel log del clan?"
 *
 * Uso:
 *   npx tsx src/scripts/debug-clan-log.ts
 *   (oppure: node --loader ts-node/esm src/scripts/debug-clan-log.ts)
 *
 * Cosa fare con l'output:
 * 1. Fai una donazione di test nel clan (anche piccola).
 * 2. Lancia questo script subito dopo.
 * 3. Trova nell'output l'entry corrispondente alla tua donazione (guarda il
 *    timestamp) e leggi:
 *      - il valore esatto del campo che indica il tipo di evento
 *      - il campo che contiene l'importo in oro donato
 * 4. Copia quei due valori in:
 *      - src/utils/donation-tracker.ts → DONATION_EVENT_TYPES
 *      - src/utils/donation-tracker.ts → extractDonationAmount()
 *    (e se il campo tipo non si chiama "type", aggiorna anche
 *     src/utils/wolvesville.ts → WvClanLogEntry / fetchClanLog)
 */
import "dotenv/config";
import { fetchClanLog } from "../utils/wolvesville.js";
async function main() {
    const clanId = process.env["WOLVESVILLE_CLAN_ID"];
    if (!clanId) {
        console.error("❌ WOLVESVILLE_CLAN_ID non impostato in .env");
        process.exit(1);
    }
    console.log(`Interrogo il log del clan ${clanId}...\n`);
    try {
        const entries = await fetchClanLog(clanId);
        console.log(`Ricevute ${entries.length} entry. Payload grezzo completo:\n`);
        console.log(JSON.stringify(entries, null, 2));
    }
    catch (err) {
        console.error("❌ Errore nella chiamata:", err);
        console.error("\nSe l'errore riguarda il path (404) l'endpoint '/clans/{clanId}/log' " +
            "non è quello corretto — controlla https://api-docs.wolvesville.com/ " +
            "nel playground interattivo con la tua chiave per trovare il path giusto, " +
            "poi aggiorna fetchClanLog() in src/utils/wolvesville.ts.");
        process.exit(1);
    }
}
main();
//# sourceMappingURL=debug-clan-log.js.map