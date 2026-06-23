import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { MapPin, Calendar, Clock, Coffee, Utensils, Navigation, ArrowLeft, Globe, ArrowDown, Instagram } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import './index.css';

// Fix for default Leaflet icons in Webpack/Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// --- Dashboard Components ---

const DashboardHero = () => (
  <div className="hero-container" style={{ position: 'relative', height: '40vh', overflow: 'hidden', borderRadius: '0 0 var(--radius) var(--radius)', background: 'linear-gradient(135deg, #0f172a 0%, #020617 100%)' }}>
    <div className="container flex-col justify-end" style={{ height: '100%', position: 'relative', zIndex: 10, paddingBottom: '3rem' }}>
      <div className="flex items-center gap-3" style={{ marginBottom: '1rem' }}>
        <Globe size={32} className="text-accent" />
        <h1 className="animate-fade-in font-serif" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', margin: 0 }}>
          My <span className="text-gradient">Journeys</span>
        </h1>
      </div>
      <p className="text-muted animate-fade-in delay-1" style={{ fontSize: '1.1rem', maxWidth: '600px' }}>
        Select a trip below to view your interactive concierge and itinerary.
      </p>
    </div>
  </div>
);

const TripCard = ({ trip }) => {
  const navigate = useNavigate();
  return (
    <div 
      className="glass-panel" 
      onClick={() => navigate(`/trip/${trip.id}`)}
      style={{ 
        cursor: 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        transition: 'all 0.3s ease'
      }}
    >
      <div style={{ height: '200px', width: '100%', overflow: 'hidden', position: 'relative' }}>
        <img 
          src={trip.coverImage} 
          alt={trip.title} 
          style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease' }} 
          className="trip-card-image"
        />
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(to top, rgba(11, 15, 25, 0.9), transparent)' }} />
      </div>
      <div style={{ padding: '1.5rem', position: 'relative', zIndex: 2, marginTop: '-50px' }}>
        <h3 className="font-serif" style={{ fontSize: '1.4rem', marginBottom: '0.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{trip.title}</h3>
        <div className="flex items-center gap-2 text-muted" style={{ fontSize: '0.95rem' }}>
          <Calendar size={16} className="text-accent" />
          <span>{trip.date}</span>
        </div>
      </div>
    </div>
  );
};

// --- Trip Viewer Components ---

const Countdown = ({ targetDate }) => {
  const [timeLeft, setTimeLeft] = useState({ days: '00', hours: '00', minutes: '00', seconds: '00' });

  useEffect(() => {
    if (!targetDate) return;
    
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = new Date(targetDate).getTime() - now;

      if (distance < 0) {
        clearInterval(interval);
        return;
      }

      setTimeLeft({
        days: String(Math.floor(distance / (1000 * 60 * 60 * 24))).padStart(2, '0'),
        hours: String(Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))).padStart(2, '0'),
        minutes: String(Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0'),
        seconds: String(Math.floor((distance % (1000 * 60)) / 1000)).padStart(2, '0')
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  return (
    <div className="flex justify-center gap-4 animate-fade-in delay-2">
      <div className="countdown-box"><div className="countdown-number">{timeLeft.days}</div><div className="countdown-label">Days</div></div>
      <div className="countdown-box"><div className="countdown-number">{timeLeft.hours}</div><div className="countdown-label">Hrs</div></div>
      <div className="countdown-box"><div className="countdown-number">{timeLeft.minutes}</div><div className="countdown-label">Min</div></div>
      <div className="countdown-box"><div className="countdown-number">{timeLeft.seconds}</div><div className="countdown-label">Sec</div></div>
    </div>
  );
};

const TripHero = ({ trip }) => {
  const navigate = useNavigate();
  const titleParts = trip.title.split('&');
  
  return (
    <div className="hero-container" style={{ position: 'relative', height: '100vh', minHeight: '800px', overflow: 'hidden' }}>
      <div 
        style={{ 
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
          backgroundImage: `url(${trip.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center'
        }} 
      />
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(to bottom, rgba(11, 15, 25, 0.8), var(--bg-color))' }} />
      
      <div className="container" style={{ position: 'relative', zIndex: 10, paddingTop: '2rem' }}>
        <button 
          onClick={() => navigate('/')}
          style={{ 
            background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem', opacity: 0.7
          }}
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      </div>

      <div className="container flex-col justify-center items-center text-center" style={{ height: 'calc(100% - 100px)', position: 'relative', zIndex: 10 }}>
        {trip.stats && (
          <div className="hero-pill animate-fade-in">
            {trip.date.toUpperCase()} &middot; {trip.stats.days} DAYS &middot; {trip.stats.cities} CITIES
          </div>
        )}
        
        <h1 className="hero-title animate-fade-in delay-1">
          {titleParts[0].trim()}
          {titleParts.length > 1 && <> <span className="hero-title-amp">&</span> {titleParts[1].trim()}</>}
        </h1>
        
        <p className="hero-subtitle animate-fade-in delay-2">
          {trip.subtitle}
        </p>

        <Countdown targetDate={trip.startDate} />

        {trip.stats && (
          <div className="stats-row animate-fade-in delay-3">
            <div className="stat-item"><div className="stat-number">{trip.stats.days}</div><div className="stat-label">Days</div></div>
            <div className="stat-item"><div className="stat-number">{trip.stats.cities}</div><div className="stat-label">Cities</div></div>
            <div className="stat-item"><div className="stat-number">{trip.stats.temples}</div><div className="stat-label">Temples</div></div>
            <div className="stat-item"><div className="stat-number">{trip.stats.food}</div><div className="stat-label">Food Stops</div></div>
            <div className="stat-item"><div className="stat-number">{trip.stats.shopping}</div><div className="stat-label">Shopping</div></div>
          </div>
        )}

        <button 
          className="btn-primary animate-fade-in delay-3"
          onClick={() => {
            const el = document.getElementById('itinerary-start');
            if(el) el.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          Plan the journey <ArrowDown size={18} />
        </button>
      </div>
    </div>
  );
};

const DayCard = ({ dayData, isActive, onClick }) => {
  return (
    <div 
      className={`glass-panel flex-col ${isActive ? 'active-day' : ''}`} 
      onClick={onClick}
      style={{ 
        padding: '1.5rem', cursor: 'pointer', minWidth: '140px', flex: '0 0 auto',
        border: isActive ? '1px solid var(--accent)' : '1px solid var(--surface-border)',
        background: isActive ? 'var(--surface-color-hover)' : 'var(--surface-color)'
      }}
    >
      <div className="flex items-center gap-2 text-muted" style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
        <Calendar size={16} />
        <span>Day {dayData.day}</span>
      </div>
      <h3 className="font-serif" style={{ marginBottom: '0.25rem' }}>{dayData.date}</h3>
      <p className="text-muted" style={{ fontSize: '0.85rem' }}>{dayData.location}</p>
    </div>
  );
};

const TimelineItem = ({ title, estimatedTime, icon: Icon, type }) => {
  // Convert title to a valid instagram hashtag string (e.g. "Siam Paragon" -> "siamparagon")
  const hashtag = title.toLowerCase().replace(/[^a-z0-9]/g, '');
  const instaUrl = `https://www.instagram.com/explore/tags/${hashtag}/`;

  return (
    <div className="flex gap-4 animate-fade-in delay-2" style={{ position: 'relative', marginBottom: '2rem' }}>
      <div className="timeline-line" style={{ position: 'absolute', left: '19px', top: '40px', bottom: '-20px', width: '2px', background: 'var(--surface-border)', zIndex: 0 }} />
      <div 
        className="flex items-center justify-center" 
        style={{ 
          width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-color)', 
          border: `2px solid ${type === 'food' ? '#f87171' : 'var(--accent)'}`, zIndex: 1 
        }}
      >
        <Icon size={20} color={type === 'food' ? '#f87171' : 'var(--accent)'} />
      </div>
      <div 
        className="glass-panel flex-col" 
        style={{ flex: 1, padding: '1.5rem', overflow: 'hidden' }}
      >
        <div className="flex justify-between items-center" style={{ marginBottom: '0.5rem' }}>
          <h4 style={{ fontSize: '1.2rem', margin: 0 }}>{title}</h4>
          {estimatedTime && (
            <div className="flex items-center gap-1 text-muted" style={{ fontSize: '0.85rem' }}>
              <Clock size={14} />
              <span>{estimatedTime}</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between text-muted" style={{ fontSize: '0.9rem' }}>
          <div className="flex items-center gap-2">
            {type === 'destination' ? <MapPin size={14} /> : <Utensils size={14} />}
            <span>{type === 'destination' ? 'Destination' : 'Dining'}</span>
          </div>
          <a 
            href={instaUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ 
              color: '#E1306C', 
              fontSize: '0.8rem', 
              letterSpacing: '0.05em',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              textDecoration: 'none',
              fontWeight: 500
            }}
          >
            <Instagram size={14} />
            Explore #{hashtag}
          </a>
        </div>
      </div>
    </div>
  );
};

const TripViewer = ({ trips }) => {
  const { id } = useParams();
  const [activeDay, setActiveDay] = useState(0);

  const trip = trips.find(t => t.id === id);

  if (!trip) {
    return <div className="app-container flex items-center justify-center" style={{ height: '100vh' }}>Trip not found</div>;
  }

  if (!trip.itinerary || trip.itinerary.length === 0) {
    return (
      <div className="app-container">
        <TripHero trip={trip} />
      </div>
    );
  }

  const activeData = trip.itinerary[activeDay];

  // Combine and filter places that have valid coordinates
  const allPlaces = [...activeData.destinations, ...activeData.food].filter(p => p.coordinates);
  
  // Calculate bounding box for the map to auto-zoom
  const bounds = allPlaces.length > 0 
    ? allPlaces.map(p => [p.coordinates.lat, p.coordinates.lng])
    : undefined;

  return (
    <div className="app-container">
      <TripHero trip={trip} />
      
      <div id="itinerary-start" className="container" style={{ position: 'relative', zIndex: 20 }}>
        {/* Dynamic Day Cover Image Banner */}
        <div 
          style={{ 
            height: '250px', 
            borderRadius: 'var(--radius)', 
            overflow: 'hidden', 
            marginBottom: '2rem',
            position: 'relative' 
          }}
        >
          <div 
            style={{ 
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
              backgroundImage: `url(${activeData.image})`, backgroundSize: 'cover', backgroundPosition: 'center',
            }} 
          />
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(to top, var(--bg-color), transparent)' }} />
        </div>

        <div 
          className="flex gap-4" 
          style={{ 
            overflowX: 'auto', padding: '1rem 0', scrollbarWidth: 'none', msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch', marginTop: '-100px', position: 'relative', zIndex: 10
          }}
        >
          {trip.itinerary.map((day, idx) => (
            <DayCard 
              key={idx} 
              dayData={day} 
              isActive={activeDay === idx} 
              onClick={() => setActiveDay(idx)} 
            />
          ))}
        </div>

        <div className="section" style={{ paddingTop: '2rem' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '3rem' }}>
            <h2 className="font-serif">Day {activeData.day} Itinerary</h2>
            <div className="glass-panel flex items-center gap-2" style={{ padding: '0.5rem 1rem', borderRadius: '20px' }}>
              <Navigation size={16} className="text-accent" />
              <span style={{ fontSize: '0.9rem' }}>{activeData.location}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '4rem' }}>
            {/* Timeline Column */}
            <div>
              {activeData.destinations.map((dest, i) => (
                <TimelineItem 
                  key={`dest-${i}`} 
                  title={dest.name} 
                  estimatedTime={dest.estimatedTime}
                  icon={MapPin} 
                  type="destination" 
                />
              ))}
              {activeData.food.map((food, i) => (
                <TimelineItem 
                  key={`food-${i}`} 
                  title={food.name} 
                  estimatedTime={food.estimatedTime}
                  icon={Coffee} 
                  type="food" 
                />
              ))}
              {activeData.destinations.length === 0 && activeData.food.length === 0 && (
                <div className="glass-panel flex-col items-center justify-center" style={{ padding: '4rem', textAlign: 'center' }}>
                  <p className="text-muted">No scheduled activities for this day.</p>
                </div>
              )}
            </div>

            {/* Premium Dark Theme Leaflet Map Column */}
            <div>
              <div style={{ position: 'sticky', top: '2rem' }}>
                <h3 className="font-serif" style={{ marginBottom: '1.5rem', color: 'var(--accent)' }}>Daily Route</h3>
                {allPlaces.length > 0 ? (
                  <div className="glass-panel animate-fade-in" style={{ height: '600px', overflow: 'hidden', padding: 0 }}>
                    {/* Using key={activeDay} forces the map to fully remount and re-calculate bounds when switching days */}
                    <MapContainer 
                      key={activeDay}
                      bounds={bounds} 
                      style={{ height: '100%', width: '100%', zIndex: 1, background: '#1c1c1c' }}
                      scrollWheelZoom={false}
                    >
                      <TileLayer
                        attribution='&copy; Google Maps'
                        url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                      />
                      {allPlaces.map((place, idx) => (
                        <Marker key={idx} position={[place.coordinates.lat, place.coordinates.lng]}>
                          <Popup className="premium-popup">
                            <strong style={{ color: '#000' }}>{place.name}</strong><br />
                            {place.estimatedTime && <span style={{ color: '#666', fontSize: '0.85rem' }}>{place.estimatedTime}</span>}
                          </Popup>
                        </Marker>
                      ))}
                      <Polyline 
                        positions={allPlaces.map(p => [p.coordinates.lat, p.coordinates.lng])}
                        color="var(--accent)"
                        weight={4}
                        opacity={0.8}
                        dashArray="5, 10"
                      />
                    </MapContainer>
                  </div>
                ) : (
                  <div className="glass-panel flex items-center justify-center" style={{ height: '600px' }}>
                    <p className="text-muted">No route data available for this day.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Dashboard = ({ trips }) => (
  <div className="app-container" style={{ minHeight: '100vh' }}>
    <DashboardHero />
    <div className="container section" style={{ paddingTop: '4rem' }}>
      <h2 className="font-serif" style={{ marginBottom: '2rem' }}>All Trips</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '2rem' }}>
        {trips.map(trip => (
          <TripCard key={trip.id} trip={trip} />
        ))}
      </div>
    </div>
  </div>
);

// --- Main App ---

const App = () => {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/trips.json')
      .then(res => res.json())
      .then(data => {
        setTrips(data);
        setLoading(false);
      })
      .catch(err => console.error("Failed to load trips", err));
  }, []);

  if (loading) {
    return <div className="app-container flex items-center justify-center" style={{ height: '100vh' }}>Loading...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard trips={trips} />} />
        <Route path="/trip/:id" element={<TripViewer trips={trips} />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
