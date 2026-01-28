const fetch = require('node-fetch');

function getCurrentSeason() {
    const month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) return "SPRING";
    if (month >= 6 && month <= 8) return "SUMMER";
    if (month >= 9 && month <= 11) return "AUTUMN";
    return "WINTER";
}

module.exports = async (req, res) => {
    try {
        const response = await fetch('https://wttr.in/Berlin?format=j1');
        const data = await response.json();
        const current = data.current_condition[0];
        
        // Map wttr.in weather codes to our simple categories
        // https://wttr.in/:help
        const weatherDesc = current.weatherDesc[0].value.toLowerCase();
        let weather = "SUNNY";
        if (weatherDesc.includes("rain") || weatherDesc.includes("drizzle") || weatherDesc.includes("shower")) {
            weather = "RAINY";
        } else if (weatherDesc.includes("snow") || weatherDesc.includes("sleet") || weatherDesc.includes("ice")) {
            weather = "SNOWY";
        } else if (weatherDesc.includes("cloud") || weatherDesc.includes("overcast") || weatherDesc.includes("mist") || weatherDesc.includes("fog")) {
            weather = "CLOUDY";
        }

        res.status(200).json({
            weather: weather,
            season: getCurrentSeason()
        });
    } catch (error) {
        console.error("Weather fetch error:", error);
        // Fallback to random if API fails
        const conditions = ["SUNNY", "RAINY", "CLOUDY", "SNOWY"];
        res.status(200).json({
            weather: conditions[Math.floor(Math.random() * conditions.length)],
            season: getCurrentSeason()
        });
    }
};
