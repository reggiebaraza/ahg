const SunCalc = require('suncalc');

// Berlin coordinates
const BERLIN_LAT = 52.5200;
const BERLIN_LNG = 13.4050;

/**
 * Time period constants
 */
const TIME_PERIODS = {
  SUNRISE: 'SUNRISE',
  MORNING: 'MORNING',
  AFTERNOON: 'AFTERNOON',
  GOLDEN_HOUR: 'GOLDEN_HOUR',
  SUNSET: 'SUNSET',
  BLUE_HOUR: 'BLUE_HOUR',
  EVENING: 'EVENING',
  NIGHT: 'NIGHT'
};

/**
 * Get sunrise, sunset, and other sun times for Berlin
 * @param {Date} date - Date to calculate for (defaults to now)
 * @returns {object} Sun times
 */
function getSunTimes(date = new Date()) {
  const times = SunCalc.getTimes(date, BERLIN_LAT, BERLIN_LNG);

  return {
    sunrise: times.sunrise,
    sunriseEnd: times.sunriseEnd,
    goldenHourEnd: times.goldenHourEnd,
    solarNoon: times.solarNoon,
    goldenHour: times.goldenHour,
    sunsetStart: times.sunsetStart,
    sunset: times.sunset,
    dusk: times.dusk,
    nauticalDusk: times.nauticalDusk,
    night: times.night,
    nadir: times.nadir,
    nightEnd: times.nightEnd,
    nauticalDawn: times.nauticalDawn,
    dawn: times.dawn
  };
}

/**
 * Determine the current time period for photography
 * @param {Date} date - Date/time to check (defaults to now)
 * @returns {string} Time period constant
 */
function getCurrentTimePeriod(date = new Date()) {
  const sunTimes = getSunTimes(date);
  const now = date.getTime();

  // Helper to add/subtract minutes from a date
  const addMinutes = (d, minutes) => new Date(d.getTime() + minutes * 60000);

  // Define time ranges
  const sunriseStart = addMinutes(sunTimes.sunrise, -30);
  const sunriseEnd = addMinutes(sunTimes.sunrise, 90);
  const morningEnd = new Date(date);
  morningEnd.setHours(11, 0, 0, 0);

  const afternoonStart = new Date(date);
  afternoonStart.setHours(11, 0, 0, 0);
  const afternoonEnd = new Date(date);
  afternoonEnd.setHours(16, 0, 0, 0);

  const goldenHourStart = addMinutes(sunTimes.sunset, -60);
  const sunsetStart = addMinutes(sunTimes.sunset, -30);
  const sunsetEnd = addMinutes(sunTimes.sunset, 30);
  const blueHourEnd = addMinutes(sunTimes.sunset, 40);

  const eveningEnd = new Date(date);
  eveningEnd.setHours(22, 0, 0, 0);

  // Determine current period
  if (now >= sunriseStart && now < sunriseEnd) {
    return TIME_PERIODS.SUNRISE;
  } else if (now >= sunriseEnd && now < morningEnd) {
    return TIME_PERIODS.MORNING;
  } else if (now >= afternoonStart && now < afternoonEnd) {
    return TIME_PERIODS.AFTERNOON;
  } else if (now >= goldenHourStart && now < sunsetStart) {
    return TIME_PERIODS.GOLDEN_HOUR;
  } else if (now >= sunsetStart && now < sunsetEnd) {
    return TIME_PERIODS.SUNSET;
  } else if (now >= sunsetEnd && now < blueHourEnd) {
    return TIME_PERIODS.BLUE_HOUR;
  } else if (now >= blueHourEnd && now < eveningEnd) {
    return TIME_PERIODS.EVENING;
  } else {
    return TIME_PERIODS.NIGHT;
  }
}

/**
 * Get formatted sun times for display
 * @param {Date} date - Date to calculate for
 * @returns {object} Formatted times
 */
function getFormattedSunTimes(date = new Date()) {
  const times = getSunTimes(date);

  const formatTime = (d) => {
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  return {
    sunrise: formatTime(times.sunrise),
    sunset: formatTime(times.sunset),
    goldenHourMorning: formatTime(times.goldenHourEnd),
    goldenHourEvening: formatTime(times.goldenHour),
    blueHourMorning: formatTime(times.dawn),
    blueHourEvening: formatTime(times.dusk)
  };
}

/**
 * Get sun position (altitude and azimuth)
 * @param {Date} date - Date/time to check
 * @returns {object} Sun position
 */
function getSunPosition(date = new Date()) {
  const pos = SunCalc.getPosition(date, BERLIN_LAT, BERLIN_LNG);

  return {
    altitude: pos.altitude * (180 / Math.PI), // Convert to degrees
    azimuth: pos.azimuth * (180 / Math.PI) + 180, // Convert to degrees (0-360)
    altitudeDegrees: Math.round(pos.altitude * (180 / Math.PI)),
    azimuthDegrees: Math.round(pos.azimuth * (180 / Math.PI) + 180)
  };
}

/**
 * Determine the best light direction for current time
 * @param {Date} date - Date/time to check
 * @returns {string} Direction: "EAST", "WEST", "NORTH", "SOUTH", "ANY"
 */
function getBestLightDirection(date = new Date()) {
  const period = getCurrentTimePeriod(date);
  const sunPos = getSunPosition(date);

  // For sunrise and morning, east-facing locations are best
  if (period === TIME_PERIODS.SUNRISE || period === TIME_PERIODS.MORNING) {
    return 'EAST';
  }

  // For golden hour, sunset, west-facing locations are best
  if (period === TIME_PERIODS.GOLDEN_HOUR || period === TIME_PERIODS.SUNSET) {
    return 'WEST';
  }

  // For blue hour and evening, any direction works
  if (period === TIME_PERIODS.BLUE_HOUR || period === TIME_PERIODS.EVENING) {
    return 'ANY';
  }

  // For afternoon, light from south is generally good
  if (period === TIME_PERIODS.AFTERNOON) {
    return 'SOUTH';
  }

  // Night - any direction
  return 'ANY';
}

/**
 * Check if it's currently "magic hour" (golden or blue hour)
 * @param {Date} date - Date/time to check
 * @returns {boolean} True if magic hour
 */
function isMagicHour(date = new Date()) {
  const period = getCurrentTimePeriod(date);
  return [
    TIME_PERIODS.SUNRISE,
    TIME_PERIODS.GOLDEN_HOUR,
    TIME_PERIODS.SUNSET,
    TIME_PERIODS.BLUE_HOUR
  ].includes(period);
}

module.exports = {
  TIME_PERIODS,
  getSunTimes,
  getCurrentTimePeriod,
  getFormattedSunTimes,
  getSunPosition,
  getBestLightDirection,
  isMagicHour
};
