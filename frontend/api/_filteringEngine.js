const { getCurrentTimePeriod, getBestLightDirection } = require('./_timeUtils');

/**
 * Smart filtering engine for selecting photography locations
 * based on weather, season, time, and other factors
 */

/**
 * Score a location based on current conditions
 * @param {object} location - Location object
 * @param {object} conditions - Current conditions { weather, season, timePeriod, lightDirection }
 * @returns {number} Score (higher is better)
 */
function scoreLocation(location, conditions) {
  let score = 0;

  // Weather matching (max: 10 points)
  if (location.weatherCondition) {
    const weatherArray = Array.isArray(location.weatherCondition)
      ? location.weatherCondition
      : [location.weatherCondition];

    if (weatherArray.includes(conditions.weather)) {
      score += 10; // Exact match
    } else if (weatherArray.includes('ANY')) {
      score += 5; // Works in any weather
    }

    // Compatible weather combinations
    const compatibleWeather = {
      CLOUDY: ['RAINY'],
      RAINY: ['CLOUDY'],
      SUNNY: ['CLOUDY']
    };

    if (compatibleWeather[conditions.weather]) {
      for (const compatible of compatibleWeather[conditions.weather]) {
        if (weatherArray.includes(compatible)) {
          score += 5;
          break;
        }
      }
    }
  }

  // Season matching (max: 8 points)
  if (location.season) {
    const seasonArray = Array.isArray(location.season)
      ? location.season
      : [location.season];

    if (seasonArray.includes(conditions.season)) {
      score += 8; // Exact match
    } else if (seasonArray.includes('ALL')) {
      score += 4; // Works in all seasons
    }
  }

  // Time of day matching (max: 6 points)
  if (location.timeOfDay) {
    const timeArray = Array.isArray(location.timeOfDay)
      ? location.timeOfDay
      : [location.timeOfDay];

    if (timeArray.includes(conditions.timePeriod)) {
      score += 6; // Exact match
    } else if (timeArray.includes('ANY')) {
      score += 3; // Works at any time
    }
  }

  // Light direction matching for golden hour (max: 4 points)
  if (location.lightDirection && conditions.lightDirection) {
    if (
      location.lightDirection === conditions.lightDirection ||
      conditions.lightDirection === 'ANY' ||
      location.lightDirection === 'ANY'
    ) {
      score += 4;
    }
  }

  // Bonus for multiple moods (more versatile location)
  if (location.mood && Array.isArray(location.mood) && location.mood.length > 2) {
    score += 1;
  }

  // Bonus for easy accessibility
  if (location.accessibility === 'PUBLIC') {
    score += 2;
  }

  // Bonus for easy difficulty (beginner-friendly)
  if (location.difficulty === 'EASY') {
    score += 1;
  }

  return score;
}

/**
 * Select top locations based on scoring
 * @param {Array} locations - Array of location objects
 * @param {object} conditions - Current conditions
 * @param {number} count - Number of locations to return (default: 3-5)
 * @param {Date} date - Date for deterministic selection
 * @returns {Array} Selected locations
 */
function selectLocations(locations, conditions, count = 4, date = new Date()) {
  if (!locations || locations.length === 0) {
    return [];
  }

  // Score all locations
  const scored = locations.map((location) => ({
    location,
    score: scoreLocation(location, conditions)
  }));

  // Sort by score (highest first)
  scored.sort((a, b) => b.score - a.score);

  // Get top 20% of locations by score
  const topThreshold = Math.ceil(scored.length * 0.2);
  const topLocations = scored.slice(0, Math.max(topThreshold, count * 2));

  // Use date as seed for deterministic pseudo-random selection
  const seed =
    date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();

  // Shuffle top locations deterministically
  const shuffled = [...topLocations];
  let currentSeed = seed;

  for (let i = shuffled.length - 1; i > 0; i--) {
    // Linear congruential generator
    currentSeed = (currentSeed * 1103515245 + 12345) & 0x7fffffff;
    const j = currentSeed % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Select diverse locations (different moods and areas)
  const selected = [];
  const usedMoods = new Set();
  const usedAreas = new Set();

  for (const item of shuffled) {
    if (selected.length >= count) break;

    const loc = item.location;
    const mood = Array.isArray(loc.mood) ? loc.mood[0] : loc.mood;
    const area = loc.location ? loc.location.split(',')[0] : '';

    // Prefer diversity in mood and area
    const isDifferentMood = !usedMoods.has(mood);
    const isDifferentArea = !usedAreas.has(area);

    if (selected.length < 2 || isDifferentMood || isDifferentArea) {
      selected.push(loc);
      if (mood) usedMoods.add(mood);
      if (area) usedAreas.add(area);
    }
  }

  // If we don't have enough diverse selections, just take more from top scorers
  if (selected.length < count) {
    for (const item of shuffled) {
      if (selected.length >= count) break;
      if (!selected.includes(item.location)) {
        selected.push(item.location);
      }
    }
  }

  return selected;
}

/**
 * Get current conditions for filtering
 * @param {string} weather - Weather condition (SUNNY, RAINY, CLOUDY, SNOWY)
 * @param {string} season - Season (SPRING, SUMMER, AUTUMN, WINTER)
 * @param {Date} date - Current date/time
 * @returns {object} Conditions object
 */
function getCurrentConditions(weather, season, date = new Date()) {
  return {
    weather,
    season,
    timePeriod: getCurrentTimePeriod(date),
    lightDirection: getBestLightDirection(date),
    date
  };
}

/**
 * Get weather-based photography recommendations
 * @param {string} weather - Weather condition
 * @returns {object} Recommendations
 */
function getWeatherRecommendations(weather) {
  const recommendations = {
    SUNNY: {
      ideal: ['ARCHITECTURE', 'PANORAMA', 'PARKS', 'STREET'],
      avoid: [],
      tips: 'Perfect for bright, saturated colors. Use golden hour for best results. Consider polarizing filter for clear skies.'
    },
    RAINY: {
      ideal: ['REFLECTIONS', 'STREET', 'MOODY', 'URBAN'],
      avoid: ['PANORAMA'],
      tips: 'Great for reflections in puddles and wet streets. Overcast light is perfect for even tones. Protect your gear!'
    },
    CLOUDY: {
      ideal: ['PORTRAITS', 'STREET', 'ARCHITECTURE', 'ANY'],
      avoid: [],
      tips: 'Soft, diffused light is perfect for all photography. No harsh shadows. Great for architecture and street photography.'
    },
    SNOWY: {
      ideal: ['MINIMALIST', 'PARKS', 'LANDMARKS'],
      avoid: [],
      tips: 'Overexpose slightly (+1 EV) to keep snow white. Fresh snow creates beautiful minimalist scenes.'
    },
    FOGGY: {
      ideal: ['ATMOSPHERIC', 'MYSTERIOUS', 'MOODY'],
      avoid: ['PANORAMA'],
      tips: 'Creates dreamy, atmospheric photos. Foreground subjects work best. Increase contrast in post-processing.'
    }
  };

  return recommendations[weather] || recommendations.CLOUDY;
}

module.exports = {
  scoreLocation,
  selectLocations,
  getCurrentConditions,
  getWeatherRecommendations
};
