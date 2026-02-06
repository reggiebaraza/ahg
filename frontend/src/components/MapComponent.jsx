import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix for default marker icons in Leaflet with React
const createCustomIcon = (isToday = false) => {
  const size = isToday ? 16 : 12;
  const color = isToday ? '#f59e0b' : '#94a3b8';
  const shadowColor = isToday ? 'rgba(245, 158, 11, 0.5)' : 'rgba(148, 163, 184, 0.3)';
  const pulseClass = isToday ? 'pulse-animation' : '';

  return L.divIcon({
    className: `custom-pin ${pulseClass}`,
    html: `<div style="
      background-color: ${color};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 0 0 4px ${shadowColor};
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
};

function MapComponent({ allInspirations = [], todayInspirations = [] }) {
  const berlinCenter = [52.5200, 13.4050]

  const todayIds = new Set(todayInspirations.map(i => i.id));

  return (
    <div className="map-wrapper mb-5">
      <div id="map-container" style={{ height: '500px', width: '100%', borderRadius: '20px', overflow: 'hidden' }}>
        <style>
          {`
            @keyframes pulse {
              0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7); }
              70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(245, 158, 11, 0); }
              100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
            }
            .pulse-animation div {
              animation: pulse 2s infinite;
            }
          `}
        </style>
        <MapContainer 
          center={berlinCenter} 
          zoom={12} 
          scrollWheelZoom={false} 
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          {Array.isArray(allInspirations) && allInspirations.map((insp) => {
            const isToday = todayIds.has(insp.id);
            return insp.lat && insp.lng && (
              <Marker key={insp.id} position={[insp.lat, insp.lng]} icon={createCustomIcon(isToday)}>
                <Popup className="custom-popup">
                  <div className="popup-content" style={{ width: '200px' }}>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6 style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: 0 }}>{insp.title}</h6>
                      {isToday && <span className="badge bg-warning text-dark p-1" style={{ fontSize: '0.6rem' }}>TODAY</span>}
                    </div>
                    <img src={insp.imageUrl} alt={insp.title} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px', marginBottom: '8px' }} />
                    <p className="small text-muted mb-0"><i className="bi bi-geo-alt-fill me-1 text-warning"></i>{insp.location}</p>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  )
}

export default MapComponent
