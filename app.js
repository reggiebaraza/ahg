import { LOCATIONS } from './data.js';

const seasonPill = document.getElementById('season-pill');
const timePill = document.getElementById('time-pill');
const localePill = document.getElementById('locale-pill');
const footerDate = document.getElementById('footer-date');
const todayList = document.getElementById('today-list');
const cardsRoot = document.getElementById('cards');
const seasonFilter = document.getElementById('season-filter');
const timeFilter = document.getElementById('time-filter');
const moodFilter = document.getElementById('mood-filter');
const resetButton = document.getElementById('reset-filters');

const berlinCenter = [52.5200, 13.4050];
let map;
let markerLayer;

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

function createSeededRandom(seed) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function getDailySelection(items, count = 3) {
  const dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seed = Number(dateKey);
  const random = createSeededRandom(seed);
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy.slice(0, count);
}

function formatLabel(value) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function resolveFilters() {
  const currentSeason = getSeason();
  const currentTime = getTimeOfDay();

  const seasonValue = seasonFilter.value === 'AUTO' ? currentSeason : seasonFilter.value;
  const timeValue = timeFilter.value === 'AUTO' ? currentTime : timeFilter.value;

  return {
    season: seasonValue,
    timeOfDay: timeValue,
    mood: moodFilter.value
  };
}

function filterLocations(locations) {
  const filters = resolveFilters();
  return locations.filter((location) => {
    const seasonMatch = filters.season === 'ALL' || location.season === 'ALL' || location.season === filters.season;
    const timeMatch = filters.timeOfDay === 'ALL' || location.timeOfDay === 'ANY' || location.timeOfDay === filters.timeOfDay;
    const moodMatch = filters.mood === 'ALL' || location.mood === filters.mood;
    return seasonMatch && timeMatch && moodMatch;
  });
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
      </div>
    `;
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
    card.innerHTML = `
      <img src="${location.imageUrl}" alt="${location.title}" />
      <div class="card-content">
        <div class="tag-row">
          <span class="tag">${formatLabel(location.mood)}</span>
          <span class="tag">${formatLabel(location.timeOfDay === 'ANY' ? 'Any time' : location.timeOfDay)}</span>
        </div>
        <h3>${location.title}</h3>
        <p>${location.description}</p>
        <div class="card-meta">${location.location}</div>
      </div>
    `;
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

function updateHeader() {
  const now = new Date();
  const season = getSeason(now);
  const time = getTimeOfDay(now);
  const locale = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';

  seasonPill.textContent = formatLabel(season);
  timePill.textContent = formatLabel(time);
  localePill.textContent = locale;
  footerDate.textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function renderAll() {
  updateHeader();
  const filtered = filterLocations(LOCATIONS);
  const todaySelection = getDailySelection(LOCATIONS, 3);
  const todayIds = new Set(todaySelection.map((loc) => loc.id));

  renderTodaySelection(todaySelection);
  renderCards(filtered);
  renderMap(filtered.length > 0 ? filtered : LOCATIONS, todayIds);
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

renderAll();
