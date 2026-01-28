const fetch = require('node-fetch');
const cache = require('./_cache');
const { INSPIRATIONS } = require('./_data');
const { selectLocations, getCurrentConditions } = require('./_filteringEngine');
const { enrichLocationsWithImages } = require('./_unsplashService');

// Get current season helper
function getCurrentSeason() {
    const month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) return "SPRING";
    if (month >= 6 && month <= 8) return "SUMMER";
    if (month >= 9 && month <= 11) return "AUTUMN";
    return "WINTER";
}

// Get weather from our weather API
async function getWeatherData() {
    try {
        // Check cache first
        const cacheKey = 'weather:berlin';
        const cached = cache.get(cacheKey);
        if (cached) {
            return {
                weather: cached.weather,
                season: cached.season
            };
        }

        // Call our own weather endpoint (would need full URL in production)
        // For now, use wttr.in directly
        const response = await fetch('https://wttr.in/Berlin?format=j1', { timeout: 5000 });
        const data = await response.json();
        const current = data.current_condition[0];

        const weatherDesc = current.weatherDesc[0].value.toLowerCase();
        let weather = "SUNNY";

        if (weatherDesc.includes("fog") && !weatherDesc.includes("mist")) {
            weather = "FOGGY";
        } else if (weatherDesc.includes("rain") || weatherDesc.includes("drizzle") || weatherDesc.includes("shower")) {
            weather = "RAINY";
        } else if (weatherDesc.includes("snow") || weatherDesc.includes("sleet") || weatherDesc.includes("ice")) {
            weather = "SNOWY";
        } else if (weatherDesc.includes("cloud") || weatherDesc.includes("overcast") || weatherDesc.includes("mist")) {
            weather = "CLOUDY";
        }

        return {
            weather,
            season: getCurrentSeason()
        };
    } catch (error) {
        console.error("Weather fetch error:", error);
        // Fallback to random weather
        const conditions = ["SUNNY", "RAINY", "CLOUDY", "SNOWY"];
        return {
            weather: conditions[Math.floor(Math.random() * conditions.length)],
            season: getCurrentSeason()
        };
    }
}

module.exports = async (req, res) => {
    try {
        // Check if we have today's inspirations cached
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const cacheKey = `inspirations:${today}`;
        const cached = cache.get(cacheKey);

        if (cached) {
            return res.status(200).json(cached);
        }

        // Get current weather and season
        const { weather, season } = await getWeatherData();

        // Get current conditions for filtering
        const conditions = getCurrentConditions(weather, season, new Date());

        // Use smart filtering engine to select 3-5 locations
        const selectedLocations = selectLocations(
            INSPIRATIONS,
            conditions,
            4, // Return 4 locations
            new Date()
        );

        // Enrich with Unsplash images (limit to 4 API calls)
        const enrichedLocations = await enrichLocationsWithImages(selectedLocations, 4);

        // Cache today's selections for 1 hour
        cache.set(cacheKey, enrichedLocations, 60 * 60 * 1000);

        res.status(200).json(enrichedLocations);
    } catch (error) {
        console.error("Error generating inspirations:", error);

        // Fallback to first 3 items from dataset
        const fallback = INSPIRATIONS.slice(0, 3);
        res.status(200).json(fallback);
    }
};
