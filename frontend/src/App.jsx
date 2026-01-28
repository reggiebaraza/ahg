import { useState, useEffect } from 'react'
import MapComponent from './components/MapComponent'

function App() {
  const [inspirations, setInspirations] = useState([])
  const [allInspirations, setAllInspirations] = useState([])
  const [weatherData, setWeatherData] = useState({ weather: '...', season: '...' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [inspRes, weatherRes, allInspRes] = await Promise.all([
          fetch('/api/inspirations'),
          fetch('/api/weather'),
          fetch('/api/all-inspirations')
        ])
        
        if (!inspRes.ok || !weatherRes.ok || !allInspRes.ok) {
          throw new Error('Failed to fetch data from API')
        }

        const inspData = await inspRes.json()
        const weatherInfo = await weatherRes.json()
        const allInspData = await allInspRes.json()
        
        setInspirations(Array.isArray(inspData) ? inspData : [])
        setWeatherData(weatherInfo || { weather: 'Unknown', season: 'Unknown' })
        setAllInspirations(Array.isArray(allInspData) ? allInspData : [])
        setLoading(false)
      } catch (error) {
        console.error("Error fetching data:", error)
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh', backgroundColor: '#f8fafc' }}>
        <div className="text-center">
          <div className="spinner-grow text-warning mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <h2 className="display-6 fw-light">Curating your Berlin inspiration...</h2>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="hero">
        <div className="container">
          <h1 className="display-1">Berlin Moods</h1>
          <p className="lead mb-4">Discover the city through a lens. Your daily guide to the most photogenic spots in Berlin, tailored to today's atmosphere.</p>
          <div className="d-flex justify-content-center gap-3">
            <span className="badge badge-weather d-flex align-items-center">
              <i className="bi bi-cloud-sun me-2"></i>
              {weatherData.weather}
            </span>
            <span className="badge badge-season d-flex align-items-center">
              <i className="bi bi-calendar3 me-2"></i>
              {weatherData.season}
            </span>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="row justify-content-center">
          <div className="col-xl-10">
            <MapComponent allInspirations={allInspirations} todayInspirations={inspirations} />
          </div>
        </div>
        
        <div className="text-center mb-5">
          <h2 className="section-title">Today's Selection</h2>
          <p className="lead text-muted">Hand-picked locations matching the current vibe of the city.</p>
        </div>

        <div className="row g-4">
          {inspirations.length > 0 ? (
            inspirations.map((insp) => (
              <div key={insp.id} className="col-lg-4 col-md-6">
                <div className="card inspiration-card h-100">
                  <div className="overflow-hidden position-relative">
                    <img 
                      src={insp.imageUrl} 
                      className="card-img-top" 
                      alt={insp.title}
                      onError={(e) => {
                        e.target.onerror = null; 
                        e.target.src="https://images.unsplash.com/photo-1560969184-10fe8719e047?auto=format&fit=crop&w=800&q=80"
                      }}
                    />
                    <div className="position-absolute top-0 end-0 m-3">
                      <span className="badge bg-dark bg-opacity-50 text-white backdrop-blur">{insp.timeOfDay}</span>
                    </div>
                  </div>
                  <div className="card-body d-flex flex-column">
                    <h3 className="card-title h4">{insp.title}</h3>
                    <p className="card-text flex-grow-1 text-secondary">{insp.description}</p>
                    <div className="mt-4 pt-4 border-top">
                      <div className="d-flex align-items-center mb-3">
                        <i className="bi bi-geo-alt-fill text-warning me-2"></i>
                        <span className="small fw-semibold">{insp.location}</span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="badge bg-light text-dark border-0 shadow-sm">{insp.mood}</span>
                        <button className="btn btn-outline-dark btn-sm rounded-pill px-3">View Details</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-12 text-center py-5">
              <div className="py-5 bg-white rounded-4 shadow-sm">
                <i className="bi bi-search display-1 text-light mb-4 d-block"></i>
                <h3 className="h4 text-muted">No specific inspirations for this exact mood yet.</h3>
                <p className="text-muted">But Berlin is always beautiful. Explore the map for all-time favorites!</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="bg-dark text-white py-5 mt-5">
        <div className="container text-center">
          <p className="mb-2"><strong>Berlin Photographer's Guide</strong></p>
          <p className="text-muted small mb-0">&copy; {new Date().getFullYear()} All rights reserved. Content updated automatically based on weather patterns.</p>
        </div>
      </footer>
    </>
  )
}

export default App
