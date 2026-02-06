const fetch = require('node-fetch');
const cache = require('./_cache');
const { getCurrentTimePeriod, getFormattedSunTimes } = require('./_timeUtils');
const { getWeatherRecommendations } = require('./_filteringEngine');

function getCurrentSeason() {
    const month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) return "SPRING";
    if (month >= 6 && month <= 8) return "SUMMER";
    if (month >= 9 && month <= 11) return "AUTUMN";
    return "WINTER";
}

function categorizeTemperature(tempC) {
    if (tempC < 0) return "FREEZING";
    if (tempC < 10) return "COLD";
    if (tempC < 20) return "MILD";
    if (tempC < 28) return "WARM";
    return "HOT";
}

function categorizeVisibility(visibilityKm) {
    if (visibilityKm >= 10) return "EXCELLENT";
    if (visibilityKm >= 5) return "GOOD";
    if (visibilityKm >= 2) return "MODERATE";
    return "POOR";
}

module.exports = async (req, res) => {
    // Check cache first (30 min TTL)
    const cacheKey = 'weather:berlin';
    const cached = cache.get(cacheKey);
    if (cached) {
        return res.status(200).json(cached);
    }

    try {
        const response = await fetch('https://wttr.in/Berlin?format=j1');
        const data = await response.json();
        const current = data.current_condition[0];

        // Map wttr.in weather codes to our simple categories
        const weatherDesc = current.weatherDesc[0].value.toLowerCase();
        let weather = "SUNNY";
        let weatherDetail = weatherDesc;

        // Add fog detection
        if (weatherDesc.includes("fog") && !weatherDesc.includes("mist")) {
            weather = "FOGGY";
        } else if (weatherDesc.includes("rain") || weatherDesc.includes("drizzle") || weatherDesc.includes("shower")) {
            weather = "RAINY";
        } else if (weatherDesc.includes("snow") || weatherDesc.includes("sleet") || weatherDesc.includes("ice")) {
            weather = "SNOWY";
        } else if (weatherDesc.includes("cloud") || weatherDesc.includes("overcast") || weatherDesc.includes("mist")) {
            weather = "CLOUDY";
        }

        // Get additional weather data
        const tempC = parseInt(current.temp_C);
        const tempCategory = categorizeTemperature(tempC);
        const visibility = parseInt(current.visibility);
        const visibilityCategory = categorizeVisibility(visibility);
        const windSpeed = parseInt(current.windspeedKmph);
        const humidity = parseInt(current.humidity);

        // Get time-based data
        const currentTime = getCurrentTimePeriod();
        const sunTimes = getFormattedSunTimes();

        // Get photography recommendations
        const recommendations = getWeatherRecommendations(weather);

        const weatherData = {
            weather: weather,
            weatherDetail: weatherDetail,
            season: getCurrentSeason(),
            temperature: tempC,
            temperatureCategory: tempCategory,
            visibility: visibility,
            visibilityCategory: visibilityCategory,
            windSpeed: windSpeed,
            humidity: humidity,
            currentTimePeriod: currentTime,
            sunTimes: sunTimes,
            photographyRecommendations: recommendations,
            timestamp: new Date().toISOString()
        };

        // Cache for 30 minutes
        cache.set(cacheKey, weatherData, cache.TTL.WEATHER);

        res.status(200).json(weatherData);
    } catch (error) {
        console.error("Weather fetch error:", error);

        // Fallback to reasonable defaults
        const conditions = ["SUNNY", "RAINY", "CLOUDY", "SNOWY"];
        const fallbackWeather = conditions[Math.floor(Math.random() * conditions.length)];
        const fallbackData = {
            weather: fallbackWeather,
            weatherDetail: "Weather data temporarily unavailable",
            season: getCurrentSeason(),
            temperature: 15,
            temperatureCategory: "MILD",
            visibility: 10,
            visibilityCategory: "GOOD",
            windSpeed: 10,
            humidity: 60,
            currentTimePeriod: getCurrentTimePeriod(),
            sunTimes: getFormattedSunTimes(),
            photographyRecommendations: getWeatherRecommendations(fallbackWeather),
            timestamp: new Date().toISOString(),
            fallback: true
        };

        res.status(200).json(fallbackData);
    }
};
