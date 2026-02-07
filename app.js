import { LOCATIONS } from './data.js';

const seasonPill = document.getElementById('season-pill');
const timePill = document.getElementById('time-pill');
const weatherPill = document.getElementById('weather-pill');
const localePill = document.getElementById('locale-pill');
const footerDate = document.getElementById('footer-date');
const todayList = document.getElementById('today-list');
const cardsRoot = document.getElementById('cards');
const seasonFilter = document.getElementById('season-filter');
const timeFilter = document.getElementById('time-filter');
const moodFilter = document.getElementById('mood-filter');
const resetButton = document.getElementById('reset-filters');
const weatherSummary = document.getElementById('weather-summary');
const weatherDetail = document.getElementById('weather-detail');
const weatherBadge = document.getElementById('weather-badge');
const tempValue = document.getElementById('temp-value');
const windValue = document.getElementById('wind-value');
const sunriseValue = document.getElementById('sunrise-value');
const sunsetValue = document.getElementById('sunset-value');
const moodSuggestion = document.getElementById('mood-suggestion');

const berlinCenter = [52.52, 13.405];
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';

const CACHE_VERSION = 1;
const WEATHER_CACHE_KEY = `weather-cache-v${CACHE_VERSION}`;
const WEATHER_CACHE_TTL = 1000 * 60 * 20;
const IMAGE_CACHE_TTL = 1000 * 60 * 60 * 24 * 7;

let map;
let markerLayer;
let scheduled = false;

const state = {
  weather: null,
  locations: LOCATIONS.map((loc) => ({
    ...loc,
    imageUrl: loc.fallbackImage,
    sourceUrl: ''
  }))
};

function getSeason(date = new Date()) {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return 'SPRING';
  if (month >= 6 && month <= 8) return 'SUMMER';
  if (month >= 9 && month <= 11) return 'AUTUMN';
  return 'WINTER';
}

function getTimeOfDay(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return 'MORNING';
  if (hour >= 11 && hour < 17) return 'AFTERNOON';
  if (hour >= 17 && hour < 21) return 'EVENING';
  return 'NIGHT';
}

function formatLabel(value) {
  if (!value) return '—';
  const cleaned = value.replace(/_/g, ' ');
  return cleaned.charAt(0) + cleaned.slice(1).toLowerCase();
}

function getWeatherCategory(code) {
  if (code === 0) return { label: 'Clear', category: 'SUNNY', mood: 'WARM' };
  if (code >= 1 && code <= 3) return { label: 'Partly Cloudy', category: 'CLOUDY', mood: 'ATMOSPHERIC' };
  if (code >= 45 && code <= 48) return { label: 'Fog', category: 'FOGGY', mood: 'MELANCHOLIC' };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return { label: 'Rain', category: 'RAINY', mood: 'MELANCHOLIC' };
  }
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    return { label: 'Snow', category: 'SNOWY', mood: 'MAJESTIC' };
  }
  if (code >= 95) return { label: 'Storm', category: 'RAINY', mood: 'EDGY' };
  return { label: 'Overcast', category: 'CLOUDY', mood: 'ATMOSPHERIC' };
}

function createSeededRandom(seed) {
  let stateValue = seed % 2147483647;
  if (stateValue <= 0) stateValue += 2147483646;
  return () => {
    stateValue = (stateValue * 16807) % 2147483647;
    return (stateValue - 1) / 2147483646;
  };
}

function resolveFilters(context) {
  const seasonValue = seasonFilter.value === 'AUTO' ? context.season : seasonFilter.value;
  const timeValue = timeFilter.value === 'AUTO' ? context.timeOfDay : timeFilter.value;

  return {
    season: seasonValue,
    timeOfDay: timeValue,
    mood: moodFilter.value
  };
}

function filterLocations(locations, context) {
  const filters = resolveFilters(context);
  return locations.filter((location) => {
    const seasonMatch = filters.season === 'ALL' || location.season === 'ALL' || location.season === filters.season;
    const timeMatch = filters.timeOfDay === 'ALL' || location.timeOfDay === 'ANY' || location.timeOfDay === filters.timeOfDay;
    const moodMatch = filters.mood === 'ALL' || location.mood === filters.mood;
    return seasonMatch && timeMatch && moodMatch;
  });
}

function scoreLocation(location, context, random) {
  let score = random() * 0.5;
  if (location.season === 'ALL' || location.season === context.season) score += 2;
  if (location.timeOfDay === 'ANY' || location.timeOfDay === context.timeOfDay) score += 2;
  if (location.weather === 'ANY' || location.weather === context.weatherCategory) score += 1.5;
  if (location.mood === context.suggestedMood) score += 1;
  return score;
}

function getDailySelection(locations, context, count = 3) {
  const dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seed = Number(`${dateKey}${context.weatherCode ?? 0}`);
  const random = createSeededRandom(seed);

  const scored = locations.map((loc) => ({
    loc,
    score: scoreLocation(loc, context, random)
  }));

  scored.sort((a, b) => b.score - a.score);

  const picks = [];
  const usedMoods = new Set();
  for (const item of scored) {
    if (picks.length >= count) break;
    if (usedMoods.has(item.loc.mood)) continue;
    picks.push(item.loc);
    usedMoods.add(item.loc.mood);
  }

  if (picks.length < count) {
    for (const item of scored) {
      if (picks.length >= count) break;
      if (picks.includes(item.loc)) continue;
      picks.push(item.loc);
    }
  }

  return picks;
}

function renderTodaySelection(selection) {
  todayList.innerHTML = '';
  selection.forEach((location) => {
    const card = document.createElement('div');
    card.className = 'today-card';
    card.innerHTML = `
      <img src="${location.imageUrl}" alt="${location.title}" />
      <div>
        <h4>${location.title}</h4>
        <p>${location.location}</p>
        <div class="tag-row">
          <span class="tag">${formatLabel(location.mood)}</span>
          <span class="tag">${formatLabel(location.timeOfDay === 'ANY' ? 'Any time' : location.timeOfDay)}</span>
        </div>
      </div>
    `;
    const image = card.querySelector('img');
    image.loading = 'lazy';
    image.onerror = () => {
      image.src = location.fallbackImage;
    };
    todayList.appendChild(card);
  });
}

function renderCards(locations) {
  cardsRoot.innerHTML = '';

  if (locations.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.innerHTML = `
      <div class="card-content">
        <h3>No matching scenes</h3>
        <p class="card-meta">Try a different mood or let the filters reset.</p>
      </div>
    `;
    cardsRoot.appendChild(empty);
    return;
  }

  locations.forEach((location) => {
    const card = document.createElement('div');
    card.className = 'card';
    const weatherTag = location.weather && location.weather !== 'ANY' ? `<span class="tag">${formatLabel(location.weather)}</span>` : '';
    const sourceLink = location.sourceUrl
      ? `<a href="${location.sourceUrl}" target="_blank" rel="noopener">source</a>`
      : '';
    card.innerHTML = `
      <img src="${location.imageUrl}" alt="${location.title}" />
      <div class="card-content">
        <div class="tag-row">
          <span class="tag">${formatLabel(location.mood)}</span>
          <span class="tag">${formatLabel(location.timeOfDay === 'ANY' ? 'Any time' : location.timeOfDay)}</span>
          ${weatherTag}
        </div>
        <h3>${location.title}</h3>
        <p>${location.description}</p>
        <div class="card-meta">
          <span>${location.location}</span>
          ${sourceLink}
        </div>
      </div>
    `;
    const image = card.querySelector('img');
    image.loading = 'lazy';
    image.onerror = () => {
      image.src = location.fallbackImage;
    };
    cardsRoot.appendChild(card);
  });
}

function createMarker(isToday) {
  const marker = document.createElement('div');
  marker.className = `marker${isToday ? ' today' : ''}`;
  return L.divIcon({
    className: '',
    html: marker.outerHTML,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
}

function renderMap(locations, todayIds) {
  if (!map) {
    map = L.map('map-root', { scrollWheelZoom: false }).setView(berlinCenter, 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
  }

  markerLayer.clearLayers();

  locations.forEach((location) => {
    if (!location.lat || !location.lng) return;
    const marker = L.marker([location.lat, location.lng], { icon: createMarker(todayIds.has(location.id)) });
    marker.bindPopup(`
      <strong>${location.title}</strong><br />
      ${location.location}
    `);
    marker.addTo(markerLayer);
  });
}

function updateHeader(context) {
  const now = new Date();
  seasonPill.textContent = formatLabel(context.season);
  timePill.textContent = formatLabel(context.timeOfDay);
  weatherPill.textContent = formatLabel(context.weatherLabel || 'Unknown');
  localePill.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
  footerDate.textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function setWeatherUI(weatherData) {
  const summary = weatherData.weatherLabel || 'Weather pending';
  weatherSummary.textContent = summary;
  weatherDetail.textContent = weatherData.description || 'Live conditions for Berlin.';
  weatherBadge.textContent = formatLabel(weatherData.category || 'Unknown');
  tempValue.textContent = weatherData.temperature !== null ? `${weatherData.temperature}°C` : '—';
  windValue.textContent = weatherData.windSpeed !== null ? `${weatherData.windSpeed} km/h` : '—';
  sunriseValue.textContent = weatherData.sunrise || '—';
  sunsetValue.textContent = weatherData.sunset || '—';
  moodSuggestion.textContent = formatLabel(weatherData.suggestedMood || 'Atmospheric');
}

function scheduleRender() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    renderAll();
  });
}

function loadFromCache(key, ttl) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > ttl) return null;
    return parsed.data;
  } catch (error) {
    return null;
  }
}

function saveToCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data }));
  } catch (error) {
    // Ignore cache errors
  }
}

async function fetchWeather() {
  const cached = loadFromCache(WEATHER_CACHE_KEY, WEATHER_CACHE_TTL);
  if (cached) return cached;

  const url = `${WEATHER_API}?latitude=${berlinCenter[0]}&longitude=${berlinCenter[1]}&current=temperature_2m,weather_code,wind_speed_10m&daily=sunrise,sunset&timezone=Europe/Berlin`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Weather request failed');
  const data = await response.json();

  const current = data.current || {};
  const daily = data.daily || {};
  const weatherCode = current.weather_code ?? 3;
  const mapped = getWeatherCategory(weatherCode);
  const sunrise = daily.sunrise ? new Date(daily.sunrise[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
  const sunset = daily.sunset ? new Date(daily.sunset[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
  const detailParts = [];
  if (current.temperature_2m !== undefined && current.temperature_2m !== null) {
    detailParts.push(`${current.temperature_2m}°C`);
  }
  if (current.wind_speed_10m !== undefined && current.wind_speed_10m !== null) {
    detailParts.push(`${current.wind_speed_10m} km/h wind`);
  }
  const description = detailParts.length > 0
    ? `Berlin feels ${mapped.label.toLowerCase()} with ${detailParts.join(', ')}.`
    : `Berlin feels ${mapped.label.toLowerCase()} right now.`;

  const weatherData = {
    weatherCode,
    weatherLabel: mapped.label,
    category: mapped.category,
    suggestedMood: mapped.mood,
    temperature: current.temperature_2m ?? null,
    windSpeed: current.wind_speed_10m ?? null,
    sunrise,
    sunset,
    description
  };

  saveToCache(WEATHER_CACHE_KEY, weatherData);
  return weatherData;
}

async function fetchCommonsTitle(location) {
  if (location.commonsQuery) {
    const searchUrl = `${COMMONS_API}?action=query&list=search&srsearch=${encodeURIComponent(location.commonsQuery)}&srnamespace=6&srlimit=1&format=json&origin=*`;
    const response = await fetch(searchUrl);
    if (response.ok) {
      const data = await response.json();
      const result = data?.query?.search?.[0];
      if (result?.title) return result.title;
    }
  }

  if (location.lat && location.lng) {
    const geoUrl = `${COMMONS_API}?action=query&list=geosearch&gscoord=${location.lat}|${location.lng}&gsradius=800&gsnamespace=6&gslimit=1&format=json&origin=*`;
    const response = await fetch(geoUrl);
    if (response.ok) {
      const data = await response.json();
      const result = data?.query?.geosearch?.[0];
      if (result?.title) return result.title;
    }
  }

  return null;
}

async function fetchCommonsImage(location) {
  const cacheKey = `image-${CACHE_VERSION}-${location.id}`;
  const cached = loadFromCache(cacheKey, IMAGE_CACHE_TTL);
  if (cached) return cached;

  const title = await fetchCommonsTitle(location);
  if (!title) return null;

  const infoUrl = `${COMMONS_API}?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|descriptionurl&iiurlwidth=1200&format=json&formatversion=2&origin=*`;
  const response = await fetch(infoUrl);
  if (!response.ok) return null;
  const data = await response.json();
  const imageInfo = data?.query?.pages?.[0]?.imageinfo?.[0];
  if (!imageInfo) return null;

  const imageData = {
    url: imageInfo.thumburl || imageInfo.url,
    sourceUrl: imageInfo.descriptionurl || ''
  };
  saveToCache(cacheKey, imageData);
  return imageData;
}

async function hydrateImages(locations) {
  const queue = [...locations];
  const concurrency = 3;

  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      const location = queue.shift();
      if (!location) return;
      try {
        const imageData = await fetchCommonsImage(location);
        if (imageData?.url) {
          location.imageUrl = imageData.url;
          location.sourceUrl = imageData.sourceUrl || '';
          scheduleRender();
        }
      } catch (error) {
        // Ignore image errors
      }
    }
  });

  await Promise.all(workers);
}

function buildContext() {
  const now = new Date();
  const season = getSeason(now);
  const timeOfDay = getTimeOfDay(now);
  const weather = state.weather || {};

  return {
    season,
    timeOfDay,
    weatherCategory: weather.category || 'CLOUDY',
    weatherLabel: weather.weatherLabel || 'Unknown',
    weatherCode: weather.weatherCode || 3,
    suggestedMood: weather.suggestedMood || 'ATMOSPHERIC'
  };
}

function renderAll() {
  const context = buildContext();
  updateHeader(context);
  setWeatherUI({
    ...state.weather,
    weatherLabel: context.weatherLabel,
    category: context.weatherCategory,
    suggestedMood: context.suggestedMood
  });

  const filtered = filterLocations(state.locations, context);
  const todaySelection = getDailySelection(state.locations, context, 3);
  const todayIds = new Set(todaySelection.map((loc) => loc.id));

  renderTodaySelection(todaySelection);
  renderCards(filtered);
  renderMap(filtered.length > 0 ? filtered : state.locations, todayIds);
}

async function init() {
  const fallbackWeather = {
    weatherLabel: 'Overcast',
    category: 'CLOUDY',
    suggestedMood: 'ATMOSPHERIC',
    temperature: null,
    windSpeed: null,
    sunrise: null,
    sunset: null,
    description: 'Weather data is loading.'
  };

  try {
    state.weather = await fetchWeather();
  } catch (error) {
    state.weather = fallbackWeather;
  }

  renderAll();
  hydrateImages(state.locations);
}

seasonFilter.addEventListener('change', renderAll);
timeFilter.addEventListener('change', renderAll);
moodFilter.addEventListener('change', renderAll);
resetButton.addEventListener('click', () => {
  seasonFilter.value = 'AUTO';
  timeFilter.value = 'AUTO';
  moodFilter.value = 'ALL';
  renderAll();
});

init();
