import React, { useState, useEffect } from 'react';
import { MapPin, Calendar, Clock, Coffee, Utensils, Navigation, ArrowLeft, Globe } from 'lucide-react';
import './index.css';

// --- Dashboard Components ---

const DashboardHero = () => (
  <div className="hero-container" style={{ position: 'relative', height: '40vh', overflow: 'hidden', borderRadius: '0 0 var(--radius) var(--radius)', background: 'linear-gradient(135deg, #0f172a 0%, #020617 100%)' }}>
    <div className="container flex-col justify-end" style={{ height: '100%', position: 'relative', zIndex: 10, paddingBottom: '3rem' }}>
      <div className="flex items-center gap-3" style={{ marginBottom: '1rem' }}>
        <Globe size={32} className="text-accent" />
        <h1 className="animate-fade-in" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', margin: 0 }}>
          My <span className="text-gradient">Journeys</span>
        </h1>
      </div>
      <p className="text-muted animate-fade-in delay-1" style={{ fontSize: '1.1rem', maxWidth: '600px' }}>
        Select a trip below to view your interactive concierge and itinerary.
      </p>
    </div>
  </div>
);

const TripCard = ({ trip, onClick }) => (
  <div 
    className="glass-panel" 
    onClick={onClick}
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
      <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{trip.title}</h3>
      <div className="flex items-center gap-2 text-muted" style={{ fontSize: '0.95rem' }}>
        <Calendar size={16} className="text-accent" />
        <span>{trip.date}</span>
      </div>
    </div>
  </div>
);

// --- Trip Viewer Components ---

const Hero = ({ bgImage, location, onBack }) => {
  return (
    <div className="hero-container" style={{ position: 'relative', height: '60vh', overflow: 'hidden', borderRadius: '0 0 var(--radius) var(--radius)' }}>
      <div 
        style={{ 
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
          backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center',
          transition: 'background-image 0.5s ease-in-out'
        }} 
      />
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(to bottom, rgba(11, 15, 25, 0.4), var(--bg-color))' }} />
      
      <div className="container" style={{ position: 'relative', zIndex: 10, paddingTop: '2rem' }}>
        <button 
          onClick={onBack}
          style={{ 
            background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255,255,255,0.2)', 
            color: '#fff', padding: '0.5rem 1rem', borderRadius: '20px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.5rem', backdropFilter: 'blur(10px)'
          }}
        >
          <ArrowLeft size={16} /> Back to Trips
        </button>
      </div>

      <div className="container flex-col justify-end" style={{ height: 'calc(100% - 4rem)', position: 'relative', zIndex: 10, paddingBottom: '4rem' }}>
        <h1 className="animate-fade-in" style={{ marginBottom: '1rem' }}>
          Explore <span className="text-gradient">{location}</span>
        </h1>
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
      <h3 style={{ marginBottom: '0.25rem' }}>{dayData.date}</h3>
      <p className="text-muted" style={{ fontSize: '0.85rem' }}>{dayData.location}</p>
    </div>
  );
};

const TimelineItem = ({ title, estimatedTime, icon: Icon, type, city }) => {
  const [isMapOpen, setIsMapOpen] = useState(false);
  const mapQuery = encodeURIComponent(`${title} ${city}`);

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
      <div className="glass-panel flex-col" style={{ flex: 1, padding: '1.5rem', overflow: 'hidden' }}>
        <div className="flex justify-between items-center" style={{ marginBottom: '0.5rem' }}>
          <h4 style={{ fontSize: '1.2rem', margin: 0 }}>{title}</h4>
          {estimatedTime && (
            <div className="flex items-center gap-1 text-muted" style={{ fontSize: '0.85rem' }}>
              <Clock size={14} />
              <span>{estimatedTime}</span>
            </div>
          )}
        </div>
        <div className="flex justify-between items-center text-muted" style={{ fontSize: '0.9rem' }}>
          <div className="flex items-center gap-2">
            {type === 'destination' ? <MapPin size={14} /> : <Utensils size={14} />}
            <span>{type === 'destination' ? 'Destination' : 'Dining'}</span>
          </div>
          
          <button 
            onClick={() => setIsMapOpen(!isMapOpen)}
            style={{
              background: 'transparent',
              border: 'none',
              color: isMapOpen ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.85rem',
              transition: 'color 0.2s',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
            }}
          >
            <MapPin size={14} />
            {isMapOpen ? 'Hide Map' : 'View on Map'}
          </button>
        </div>

        <div 
          style={{ 
            height: isMapOpen ? '200px' : '0', 
            marginTop: isMapOpen ? '1rem' : '0',
            opacity: isMapOpen ? 1 : 0,
            transition: 'all 0.3s ease-in-out',
            borderRadius: '8px',
            overflow: 'hidden'
          }}
        >
          {isMapOpen && (
            <iframe
              title={`Map of ${title}`}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              src={`https://maps.google.com/maps?q=${mapQuery}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
            />
          )}
        </div>
      </div>
    </div>
  );
};

const TripViewer = ({ trip, onBack }) => {
  const [activeDay, setActiveDay] = useState(0);

  if (!trip.itinerary || trip.itinerary.length === 0) {
    return (
      <div className="app-container">
        <Hero bgImage={trip.coverImage} location={trip.title} onBack={onBack} />
        <div className="container" style={{ marginTop: '2rem', textAlign: 'center' }}>
          <div className="glass-panel" style={{ padding: '4rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>Itinerary Coming Soon</h2>
            <p className="text-muted">The schedule for {trip.title} is currently being planned.</p>
          </div>
        </div>
      </div>
    );
  }

  const activeData = trip.itinerary[activeDay];

  return (
    <div className="app-container">
      <Hero bgImage={activeData.image} location={activeData.location} onBack={onBack} />
      
      <div className="container" style={{ marginTop: '-2rem', position: 'relative', zIndex: 20 }}>
        <div 
          className="flex gap-4" 
          style={{ 
            overflowX: 'auto', padding: '1rem 0', scrollbarWidth: 'none', msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
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

        <div className="section">
          <div className="flex items-center justify-between" style={{ marginBottom: '3rem' }}>
            <h2>Day {activeData.day} Itinerary</h2>
            <div className="glass-panel flex items-center gap-2" style={{ padding: '0.5rem 1rem', borderRadius: '20px' }}>
              <Navigation size={16} className="text-accent" />
              <span style={{ fontSize: '0.9rem' }}>{activeData.location}</span>
            </div>
          </div>

          <div style={{ maxWidth: '800px' }}>
            {activeData.destinations.map((dest, i) => (
              <TimelineItem 
                key={`dest-${i}`} 
                title={dest.name} 
                estimatedTime={dest.estimatedTime}
                icon={MapPin} 
                type="destination" 
                city={activeData.location}
              />
            ))}
            {activeData.food.map((food, i) => (
              <TimelineItem 
                key={`food-${i}`} 
                title={food.name} 
                estimatedTime={food.estimatedTime}
                icon={Coffee} 
                type="food" 
                city={activeData.location}
              />
            ))}
            {activeData.destinations.length === 0 && activeData.food.length === 0 && (
              <div className="glass-panel flex-col items-center justify-center" style={{ padding: '4rem', textAlign: 'center' }}>
                <p className="text-muted">No scheduled activities for this day.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

const App = () => {
  const [trips, setTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState(null);
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

  const selectedTrip = trips.find(t => t.id === selectedTripId);

  if (selectedTrip) {
    return <TripViewer trip={selectedTrip} onBack={() => setSelectedTripId(null)} />;
  }

  return (
    <div className="app-container" style={{ minHeight: '100vh' }}>
      <DashboardHero />
      <div className="container section" style={{ paddingTop: '4rem' }}>
        <h2 style={{ marginBottom: '2rem' }}>All Trips</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '2rem' }}>
          {trips.map(trip => (
            <TripCard 
              key={trip.id} 
              trip={trip} 
              onClick={() => setSelectedTripId(trip.id)} 
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
