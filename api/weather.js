const { getCurrentSeason, getCurrentWeather } = require('./_data');

module.exports = (req, res) => {
    res.status(200).json({
        weather: getCurrentWeather(),
        season: getCurrentSeason()
    });
};
