import fetch from 'node-fetch';

async function findClan() {
    const url = 'https://wolvesville.com';
    
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': 'Bot YGNrrmPwSWjVY9lAy9y7CiBLMeRUh3pEE4CTmIvfZwnaSp6X3uiQnsVAoDkdXLYW',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
    });

    console.log(`Status del server: ${response.status} ${response.statusText}`);
    
    const textData = await response.text();
    
    try {
        const jsonData = JSON.parse(textData);
        console.log("ID del Clan Trovato:");
        console.log(JSON.stringify(jsonData, null, 2));
    } catch (e) {
        console.log("Il server non ha risposto con un JSON. Ecco l'inizio della risposta:");
        console.log(textData.substring(0, 500));
    }
}
findClan();

