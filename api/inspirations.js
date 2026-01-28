const { INSPIRATIONS, getCurrentSeason, getCurrentWeather } = require('./_data');

module.exports = (req, res) => {
    const season = getCurrentSeason();
    const weather = getCurrentWeather();
    
    let filtered = INSPIRATIONS.filter(insp => 
        (insp.season === "ALL" || insp.season === season) &&
        (insp.weatherCondition === "ANY" || insp.weatherCondition === weather)
    );
    
    if (filtered.length === 0) {
        // Return 2 random if none match
        filtered = [...INSPIRATIONS].sort(() => 0.5 - Math.random()).slice(0, 2);
    }
    
    res.status(200).json(filtered);
};
