const fetch = require('node-fetch');

async function getOSMInspirations() {
    const query = `
        [out:json][timeout:25];
        area[name="Berlin"]->.searchArea;
        (
          node["tourism"="viewpoint"](area.searchArea);
          node["historic"="monument"](area.searchArea);
          node["historic"="memorial"](area.searchArea);
          node["tourism"="attraction"](area.searchArea);
          node["landmark"="yes"](area.searchArea);
        );
        out body 50;
    `;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        return data.elements.map((el, index) => {
            const name = el.tags.name || el.tags.description || `Spot ${el.id}`;
            const type = el.tags.tourism || el.tags.historic || "Sights";
            
            // Generate a semi-realistic image URL based on the name or use a default Berlin one
            const imageUrl = `https://source.unsplash.com/featured/?berlin,${encodeURIComponent(name.split(' ')[0])}`;
            
            return {
                id: el.id,
                title: name,
                description: el.tags.description || `A beautiful ${type} in Berlin.`,
                location: el.tags["addr:street"] ? `${el.tags["addr:street"]} ${el.tags["addr:housenumber"] || ""}` : "Berlin",
                lat: el.lat,
                lng: el.lon,
                mood: "Urban",
                season: "ALL",
                weatherCondition: "ANY",
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
    const inspirations = await getOSMInspirations();
    if (inspirations.length === 0) {
        // Fallback to minimal data if API fails
        const { INSPIRATIONS } = require('./_data');
        res.status(200).json(INSPIRATIONS);
    } else {
        res.status(200).json(inspirations);
    }
};
