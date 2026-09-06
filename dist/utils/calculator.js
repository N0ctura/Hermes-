import { evaluate } from "mathjs";
/**
 * Converte un'espressione scritta in italiano (anche "a parole", tipo
 * "3 più 5 diviso 18 moltiplicato per 3 alla seconda") in una stringa
 * matematica valida, poi la calcola con mathjs (niente eval() pericolosi).
 */
// Mappa parola->numero per "alla seconda/terza/..." e "elevato alla seconda/..."
const ORDINALI = {
    seconda: "2",
    terza: "3",
    quarta: "4",
    quinta: "5",
    sesta: "6",
    settima: "7",
    ottava: "8",
    nona: "9",
    decima: "10",
};
const SOSTITUZIONI = [
    // potenze: "elevato alla seconda", "alla seconda", "al quadrato", "al cubo"
    [/\belevato\s+alla\s+(\w+)\b/g, (_m, p1) => `^${ORDINALI[p1] ?? p1}`],
    [/\balla\s+(\w+)\b/g, (_m, p1) => `^${ORDINALI[p1] ?? p1}`],
    [/\bal\s+quadrato\b/g, "^2"],
    [/\bal\s+cubo\b/g, "^3"],
    // radice quadrata: cattura il numero (anche con parentesi) subito dopo
    // e lo racchiude tra parentesi, altrimenti mathjs legge "sqrt 81" come
    // "sqrt" per "81" (moltiplicazione implicita) e va in errore.
    [/\bradice\s+quadrata\s+di\s+([\d.,]+|\([^)]*\))/g, (_m, n) => `sqrt(${n})`],
    [/\bradice\s+di\s+([\d.,]+|\([^)]*\))/g, (_m, n) => `sqrt(${n})`],
    // divisione
    [/\bdiviso\s+per\b/g, "/"],
    [/\bdiviso\b/g, "/"],
    [/\bfratto\b/g, "/"],
    // moltiplicazione
    [/\bmoltiplicato\s+per\b/g, "*"],
    [/\bmoltiplicato\b/g, "*"],
    [/\bper\b/g, "*"],
    // addizione/sottrazione (l'accento di "più" viene già rimosso a monte)
    [/\bpiu\b/g, "+"],
    [/\bmeno\b/g, "-"],
    // percentuale semplice: "50 percento di 200" -> (50/100)*200
    [/\b(\d+([.,]\d+)?)\s*percento\s+di\s+(\d+([.,]\d+)?)\b/g, (_m, a, _b, c) => `((${a})/100)*(${c})`],
    [/\bpercento\b/g, "%"],
    // virgola come separatore decimale italiano -> punto
    [/(\d),(\d)/g, "$1.$2"],
];
// Dopo le sostituzioni, l'espressione deve contenere SOLO questi caratteri.
// Questo è il controllo di sicurezza: se resta anche una sola lettera o
// simbolo non previsto, rifiutiamo (niente iniezioni verso mathjs).
const CARATTERI_AMMESSI = /^(?:[0-9+\-*/^().\s]|sqrt|%)+$/;
export function calcolaEspressione(testoGrezzo) {
    let testo = testoGrezzo.trim().toLowerCase();
    if (!testo) {
        return { ok: false, errore: "Nessuna espressione fornita." };
    }
    // Rimuove gli accenti (es. "più" -> "piu") PRIMA delle sostituzioni:
    // in JS il \b delle regex non riconosce le lettere accentate come
    // caratteri "di parola", quindi \bpiù\b non avrebbe mai fatto match.
    testo = testo.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    for (const [pattern, sostituzione] of SOSTITUZIONI) {
        testo = typeof sostituzione === "string"
            ? testo.replace(pattern, sostituzione)
            : testo.replace(pattern, sostituzione);
    }
    // pulizia spazi multipli
    testo = testo.replace(/\s+/g, " ").trim();
    if (!CARATTERI_AMMESSI.test(testo)) {
        return {
            ok: false,
            errore: "Non ho capito l'operazione. Prova con numeri e operazioni tipo: +, -, moltiplicato per, diviso, alla seconda.",
        };
    }
    try {
        const risultato = evaluate(testo);
        if (typeof risultato !== "number" || !Number.isFinite(risultato)) {
            return { ok: false, errore: "Il risultato non è un numero valido (es. divisione per zero)." };
        }
        // arrotonda per evitare artefatti tipo 0.1 + 0.2 = 0.30000000000000004
        const arrotondato = Math.round(risultato * 1e10) / 1e10;
        return { ok: true, espressioneNormalizzata: testo, risultato: arrotondato };
    }
    catch (err) {
        return { ok: false, errore: "Espressione matematica non valida." };
    }
}
//# sourceMappingURL=calculator.js.map