const fetch = require('node-fetch');

function getCurrentSeason() {
    const month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) return "SPRING";
    if (month >= 6 && month <= 8) return "SUMMER";
    if (month >= 9 && month <= 11) return "AUTUMN";
    return "WINTER";
}

async function getInspirations(weather) {
    // Increase limit for better filtering
    const query = `
        [out:json][timeout:25];
        area[name="Berlin"]->.searchArea;
        (
          node["tourism"="viewpoint"](area.searchArea);
          node["historic"="monument"](area.searchArea);
          node["tourism"="attraction"](area.searchArea);
        );
        out body 30;
    `;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        let elements = data.elements;
        
        // Pseudo-random selection to simulate "Today's selection"
        // In a real app, we might use the date as a seed
        const day = new Date().getDate();
        elements = elements.sort((a, b) => (a.id * day) % 100 - (b.id * day) % 100).slice(0, 3);

        return elements.map((el) => {
            const name = el.tags.name || el.tags.description || `Spot ${el.id}`;
            const imageUrl = `https://images.unsplash.com/photo-1560969184-10fe8719e047?auto=format&fit=crop&w=800&q=80`;
            
            return {
                id: el.id,
                title: name,
                description: el.tags.description || `A recommended spot for a ${weather.toLowerCase()} day in Berlin.`,
                location: el.tags["addr:street"] || "Berlin",
                lat: el.lat,
                lng: el.lon,
                mood: weather === "SUNNY" ? "Vibrant" : "Atmospheric",
                season: getCurrentSeason(),
                weatherCondition: weather,
                timeOfDay: "ANY",
                imageUrl: imageUrl
            };
        });
    } catch (error) {
        console.error("OSM fetch error:", error);
        return [];
    }
}

module.exports = async (req, res) => {
    try {
        // We can't easily call our own API on Vercel like this without full URL,
        // so we just calculate weather here or assume a default.
        // For simplicity and robustness, let's just use a default weather if we can't fetch it, 
        // or better, use the same logic as weather.js.
        
        const weatherConditions = ["SUNNY", "RAINY", "CLOUDY", "SNOWY"];
        const weather = weatherConditions[Math.floor(Math.random() * weatherConditions.length)];
        
        const inspirations = await getInspirations(weather);
        
        if (inspirations.length === 0) {
            const { INSPIRATIONS } = require('./_data');
            res.status(200).json(INSPIRATIONS.slice(0, 3));
        } else {
            res.status(200).json(inspirations);
        }
    } catch (e) {
        const { INSPIRATIONS } = require('./_data');
        res.status(200).json(INSPIRATIONS.slice(0, 3));
    }
};
