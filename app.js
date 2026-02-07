import { LOCATIONS } from './data.js';

const seasonPill = document.getElementById('season-pill');
const timePill = document.getElementById('time-pill');
const weatherPill = document.getElementById('weather-pill');
const localePill = document.getElementById('locale-pill');
const footerDate = document.getElementById('footer-date');
const todayList = document.getElementById('today-list');
const cardsRoot = document.getElementById('cards');
const cardCount = document.getElementById('card-count');
const mapCount = document.getElementById('map-count');
const extraStatus = document.getElementById('extra-status');
const expandToggle = document.getElementById('expand-toggle');
const showMoreButton = document.getElementById('show-more');
const seasonFilter = document.getElementById('season-filter');
const timeFilter = document.getElementById('time-filter');
const weatherFilter = document.getElementById('weather-filter');
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

const modal = document.getElementById('image-modal');
const modalClose = document.getElementById('modal-close');
const modalImage = document.getElementById('modal-image');
const modalTitle = document.getElementById('modal-title');
const modalDescription = document.getElementById('modal-description');
const modalLocation = document.getElementById('modal-location');
const modalMaps = document.getElementById('modal-maps');
const modalSource = document.getElementById('modal-source');

const berlinCenter = [52.52, 13.405];
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const WIKIDATA_API = 'https://query.wikidata.org/sparql';
const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';

const CACHE_VERSION = 3;
const WEATHER_CACHE_KEY = `weather-cache-v${CACHE_VERSION}`;
const WEATHER_CACHE_TTL = 1000 * 60 * 20;
const IMAGE_CACHE_TTL = 1000 * 60 * 60 * 24 * 7;
const EXTRA_CACHE_KEY = `extra-locations-v${CACHE_VERSION}`;
const EXTRA_CACHE_TTL = 1000 * 60 * 60 * 12;
const WIKIDATA_CACHE_KEY = `wikidata-locations-v${CACHE_VERSION}`;
const WIKIDATA_CACHE_TTL = 1000 * 60 * 60 * 24;
const MIN_RECOMMENDATIONS = 18;
const PAGE_SIZE = 24;

let map;
let markerLayer;
let scheduled = false;
let locationIndex = new Map();
let visibleCount = PAGE_SIZE;

const state = {
  weather: null,
  baseLocations: LOCATIONS.map((loc) => ({
    ...loc,
    imageUrl: loc.fallbackImage,
    sourceUrl: ''
  })),
  extraLocations: [],
  extrasLoaded: false,
  extrasFailed: false,
  expandedMode: false
};

function getAllLocations() {
  return [...state.baseLocations, ...state.extraLocations];
}

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

function formatSentence(value) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
  if (!value) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(value) {
  if (!value) return '';
  try {
    const parsed = new URL(value, window.location.href);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch (error) {
    return '';
  }
  return '';
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
  const weatherValue = weatherFilter.value === 'AUTO' ? context.weatherCategory : weatherFilter.value;

  return {
    season: seasonValue,
    timeOfDay: timeValue,
    mood: moodFilter.value,
    weather: weatherValue
  };
}

function filterLocations(locations, context) {
  const filters = resolveFilters(context);
  return locations.filter((location) => {
    const seasonMatch = filters.season === 'ALL' || location.season === 'ALL' || location.season === filters.season;
    const timeMatch = filters.timeOfDay === 'ALL' || location.timeOfDay === 'ANY' || location.timeOfDay === filters.timeOfDay;
    const moodMatch = filters.mood === 'ALL' || location.mood === filters.mood;
    const weatherMatch = filters.weather === 'ALL' || location.weather === 'ANY' || location.weather === filters.weather;
    return seasonMatch && timeMatch && moodMatch && weatherMatch;
  });
}

function relaxedFilter(locations) {
  const moodValue = moodFilter.value;
  if (moodValue === 'ALL') return locations;
  return locations.filter((location) => location.mood === moodValue);
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

function createMapsUrl(location) {
  if (location.lat && location.lng) {
    return `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.location} Berlin`)}`;
}

function updateLocationIndex() {
  locationIndex = new Map();
  getAllLocations().forEach((location) => {
    locationIndex.set(String(location.id), location);
  });
}

function renderTodaySelection(selection) {
  todayList.innerHTML = '';
  selection.forEach((location) => {
    const card = document.createElement('div');
    card.className = 'today-card';
    const mapsUrl = createMapsUrl(location);
    const title = escapeHtml(location.title);
    const place = escapeHtml(location.location);
    card.innerHTML = `
      <img src="${escapeHtml(safeUrl(location.imageUrl) || location.fallbackImage || '')}" alt="${title}" data-location-id="${location.id}" />
      <div>
        <h4>${title}</h4>
        <p>${place}</p>
        <div class="tag-row">
          <span class="tag">${formatLabel(location.mood)}</span>
          <span class="tag">${formatLabel(location.timeOfDay === 'ANY' ? 'Any time' : location.timeOfDay)}</span>
        </div>
        <div class="card-meta">
          <a href="${mapsUrl}" target="_blank" rel="noopener">Open in Maps</a>
        </div>
      </div>
    `;
    const image = card.querySelector('img');
    image.loading = 'lazy';
    image.onerror = () => {
      image.src = location.fallbackImage || location.imageUrl;
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

  const visible = locations.slice(0, visibleCount);

  visible.forEach((location) => {
    const card = document.createElement('div');
    card.className = 'card';
    const weatherTag = location.weather && location.weather !== 'ANY' ? `<span class="tag">${formatLabel(location.weather)}</span>` : '';
    const sourceUrl = safeUrl(location.sourceUrl);
    const sourceLink = sourceUrl
      ? `<a href="${sourceUrl}" target="_blank" rel="noopener">Source</a>`
      : '';
    const mapsUrl = createMapsUrl(location);
    const title = escapeHtml(location.title);
    const description = escapeHtml(location.description);
    const place = escapeHtml(location.location);
    card.innerHTML = `
      <img src="${escapeHtml(safeUrl(location.imageUrl) || location.fallbackImage || '')}" alt="${title}" data-location-id="${location.id}" />
      <div class="card-content">
        <div class="tag-row">
          <span class="tag">${formatLabel(location.mood)}</span>
          <span class="tag">${formatLabel(location.timeOfDay === 'ANY' ? 'Any time' : location.timeOfDay)}</span>
          ${weatherTag}
        </div>
        <h3>${title}</h3>
        <p>${description}</p>
        <div class="card-meta">
          <span>${place}</span>
          <div class="modal-links">
            <a href="${mapsUrl}" target="_blank" rel="noopener">Open in Maps</a>
            ${sourceLink}
          </div>
        </div>
      </div>
    `;
    const image = card.querySelector('img');
    image.loading = 'lazy';
    image.onerror = () => {
      image.src = location.fallbackImage || location.imageUrl;
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
    map = L.map('map-root', { scrollWheelZoom: false, preferCanvas: true }).setView(berlinCenter, 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
  }

  markerLayer.clearLayers();

  locations.forEach((location) => {
    if (!location.lat || !location.lng) return;
    const marker = L.marker([location.lat, location.lng], { icon: createMarker(todayIds.has(location.id)) });
    const mapsUrl = createMapsUrl(location);
    const title = escapeHtml(location.title);
    const place = escapeHtml(location.location);
    marker.bindPopup(`
      <strong>${title}</strong><br />
      ${place}<br />
      <a href="${mapsUrl}" target="_blank" rel="noopener">Open in Maps</a>
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

function assignMood(seed) {
  const moods = ['ROMANTIC', 'URBAN', 'ATMOSPHERIC', 'MINIMALIST', 'FUTURISTIC', 'MAJESTIC', 'WARM', 'MELANCHOLIC', 'EDGY'];
  const index = Math.abs(seed) % moods.length;
  return moods[index];
}

function assignTimeOfDay(seed) {
  const times = ['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT', 'ANY'];
  const index = Math.abs(seed) % times.length;
  return times[index];
}

async function fetchExtraLocations() {
  const cached = loadFromCache(EXTRA_CACHE_KEY, EXTRA_CACHE_TTL);
  if (cached) return cached;

  const categoryUrl = `${WIKI_API}?action=query&list=categorymembers&cmtitle=Category:Tourist_attractions_in_Berlin&cmlimit=50&format=json&origin=*`;
  const categoryResponse = await fetch(categoryUrl);
  if (!categoryResponse.ok) return [];
  const categoryData = await categoryResponse.json();
  const members = categoryData?.query?.categorymembers || [];
  const pageIds = members.filter((member) => member.ns === 0).map((member) => member.pageid);
  if (pageIds.length === 0) return [];

  const infoUrl = `${WIKI_API}?action=query&pageids=${pageIds.join('|')}&prop=coordinates|pageimages|pageprops&piprop=original&pithumbsize=1200&format=json&origin=*`;
  const infoResponse = await fetch(infoUrl);
  if (!infoResponse.ok) return [];
  const infoData = await infoResponse.json();
  const pages = Object.values(infoData?.query?.pages || {});

  const baseTitles = new Set(state.baseLocations.map((loc) => loc.title.toLowerCase()));
  const locations = pages
    .filter((page) => page?.coordinates?.length)
    .map((page, index) => {
      const coord = page.coordinates[0];
      const shortDesc = page.pageprops?.['wikibase-shortdesc'] || '';
      const imageUrl = page.original?.source || page.thumbnail?.source || '';
      const seed = page.pageid || index;
      return {
        id: `wp-${page.pageid}`,
        title: page.title,
        description: shortDesc ? formatSentence(shortDesc) : 'A Berlin landmark worth exploring for new compositions.',
        location: page.title,
        lat: coord.lat,
        lng: coord.lon,
        mood: assignMood(seed),
        season: 'ALL',
        timeOfDay: assignTimeOfDay(seed),
        weather: 'ANY',
        imageUrl: imageUrl || '',
        fallbackImage: imageUrl || 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1400&q=80',
        sourceUrl: `https://en.wikipedia.org/?curid=${page.pageid}`,
        dynamic: true
      };
    })
    .filter((location) => !baseTitles.has(location.title.toLowerCase()));

  saveToCache(EXTRA_CACHE_KEY, locations);
  return locations;
}

function parseWktPoint(value) {
  const match = /Point\(([-0-9.]+) ([-0-9.]+)\)/.exec(value);
  if (!match) return null;
  return {
    lng: parseFloat(match[1]),
    lat: parseFloat(match[2])
  };
}

function buildWikidataQuery(limit) {
  return `SELECT ?item ?itemLabel ?coord ?image ?description WHERE {
    SERVICE wikibase:around {
      ?item wdt:P625 ?coord.
      bd:serviceParam wikibase:center "Point(${berlinCenter[1]} ${berlinCenter[0]})"^^geo:wktLiteral.
      bd:serviceParam wikibase:radius "15".
    }
    OPTIONAL { ?item wdt:P18 ?image. }
    OPTIONAL { ?item schema:description ?description FILTER(LANG(?description) = "en"). }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }
  LIMIT ${limit}`;
}

async function fetchWikidataLocations() {
  const cached = loadFromCache(WIKIDATA_CACHE_KEY, WIKIDATA_CACHE_TTL);
  if (cached) return cached;

  const query = buildWikidataQuery(600);
  const url = `${WIKIDATA_API}?format=json&query=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/sparql-results+json'
    }
  });

  if (!response.ok) return [];
  const data = await response.json();
  const bindings = data?.results?.bindings || [];

  const locations = bindings
    .map((row) => {
      const coord = parseWktPoint(row.coord?.value || '');
      if (!coord) return null;
      const itemUrl = row.item?.value || '';
      const qid = itemUrl.split('/').pop();
      const title = row.itemLabel?.value || qid || 'Berlin location';
      const imageUrl = row.image?.value || '';
      const description = row.description?.value || '';
      const seed = qid ? qid.replace('Q', '') : title.length;
      return {
        id: `wd-${qid || Math.random().toString(36).slice(2)}`,
        title,
        description: description ? formatSentence(description) : 'A Berlin spot worth composing in a new way.',
        location: title,
        lat: coord.lat,
        lng: coord.lng,
        mood: assignMood(seed),
        season: 'ALL',
        timeOfDay: assignTimeOfDay(seed),
        weather: 'ANY',
        imageUrl: imageUrl || 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1400&q=80',
        fallbackImage: imageUrl || 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1400&q=80',
        sourceUrl: itemUrl,
        dynamic: true
      };
    })
    .filter(Boolean);

  saveToCache(WIKIDATA_CACHE_KEY, locations);
  return locations;
}

function dedupeLocations(locations) {
  const seen = new Set();
  return locations.filter((location) => {
    const key = `${location.title?.toLowerCase() || ''}-${location.lat?.toFixed(4) || ''}-${location.lng?.toFixed(4) || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

  const allLocations = getAllLocations();
  updateLocationIndex();

  const filtered = filterLocations(allLocations, context);
  let recommendations = filtered;
  let expanded = state.expandedMode;
  if (!expanded && filtered.length < MIN_RECOMMENDATIONS) {
    recommendations = relaxedFilter(allLocations);
    expanded = true;
  } else if (expanded) {
    recommendations = relaxedFilter(allLocations);
  }
  if (recommendations.length === 0) {
    recommendations = allLocations;
    expanded = true;
  }

  const todaySelection = getDailySelection(state.baseLocations, context, 3);
  const todayIds = new Set(todaySelection.map((loc) => loc.id));

  renderTodaySelection(todaySelection);
  renderCards(recommendations);
  renderMap(filtered.length > 0 ? filtered : allLocations, todayIds);

  if (cardCount) {
    const showing = Math.min(recommendations.length, visibleCount);
    const status = expanded ? 'Expanded' : 'Filtered';
    cardCount.textContent = `${status}: ${showing} of ${recommendations.length} locations`;
  }
  if (mapCount) {
    mapCount.textContent = `Map markers: ${filtered.length > 0 ? filtered.length : allLocations.length}`;
  }
  if (extraStatus) {
    if (state.extrasLoaded) {
      extraStatus.textContent = `Live locations loaded: ${state.extraLocations.length}`;
    } else if (state.extrasFailed) {
      extraStatus.textContent = 'Live locations unavailable';
    } else {
      extraStatus.textContent = 'Loading more locations…';
    }
  }
  if (expandToggle) {
    expandToggle.textContent = state.expandedMode ? 'Use strict filters' : 'Expand recommendations';
  }
  if (showMoreButton) {
    if (recommendations.length > visibleCount) {
      showMoreButton.style.display = 'inline-flex';
    } else {
      showMoreButton.style.display = 'none';
    }
  }
}

function openPreview(location) {
  if (!location) return;
  modalImage.src = safeUrl(location.imageUrl) || location.fallbackImage || '';
  modalImage.alt = location.title || 'Preview image';
  modalTitle.textContent = location.title || 'Untitled';
  modalDescription.textContent = location.description || 'A Berlin scene worth exploring.';
  modalLocation.textContent = location.location || '';
  modalMaps.href = createMapsUrl(location);

  const sourceUrl = safeUrl(location.sourceUrl);
  if (sourceUrl) {
    modalSource.href = sourceUrl;
    modalSource.style.display = 'inline-flex';
  } else {
    modalSource.style.display = 'none';
  }

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closePreview() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

function handlePreviewClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.tagName !== 'IMG') return;
  const locationId = target.dataset.locationId;
  if (!locationId) return;
  const location = locationIndex.get(locationId);
  openPreview(location);
}

async function loadExtras() {
  const [wikipediaResult, wikidataResult] = await Promise.allSettled([
    fetchExtraLocations(),
    fetchWikidataLocations()
  ]);

  const extras = [];
  if (wikipediaResult.status === 'fulfilled') {
    extras.push(...wikipediaResult.value);
  }
  if (wikidataResult.status === 'fulfilled') {
    extras.push(...wikidataResult.value);
  }

  state.extraLocations = dedupeLocations(extras);
  const allFailed = wikipediaResult.status === 'rejected' && wikidataResult.status === 'rejected';
  state.extrasLoaded = !allFailed;
  state.extrasFailed = allFailed;
  scheduleRender();
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
  hydrateImages(state.baseLocations);
  try {
    await loadExtras();
  } catch (error) {
    state.extrasFailed = true;
    scheduleRender();
  }
}

seasonFilter.addEventListener('change', () => {
  visibleCount = PAGE_SIZE;
  renderAll();
});
timeFilter.addEventListener('change', () => {
  visibleCount = PAGE_SIZE;
  renderAll();
});
weatherFilter.addEventListener('change', () => {
  visibleCount = PAGE_SIZE;
  renderAll();
});
moodFilter.addEventListener('change', () => {
  visibleCount = PAGE_SIZE;
  renderAll();
});
resetButton.addEventListener('click', () => {
  seasonFilter.value = 'AUTO';
  timeFilter.value = 'AUTO';
  weatherFilter.value = 'AUTO';
  moodFilter.value = 'ALL';
  state.expandedMode = false;
  visibleCount = PAGE_SIZE;
  renderAll();
});

if (expandToggle) {
  expandToggle.addEventListener('click', () => {
    state.expandedMode = !state.expandedMode;
    visibleCount = PAGE_SIZE;
    renderAll();
  });
}

if (showMoreButton) {
  showMoreButton.addEventListener('click', () => {
    visibleCount += PAGE_SIZE;
    renderAll();
  });
}

cardsRoot.addEventListener('click', handlePreviewClick);
todayList.addEventListener('click', handlePreviewClick);
modal.addEventListener('click', (event) => {
  if (event.target === modal) closePreview();
});
modalClose.addEventListener('click', closePreview);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closePreview();
});

init();
