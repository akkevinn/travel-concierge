import React, { useState, useEffect } from 'react';
import { MapPin, Calendar, Clock, Coffee, Utensils, Navigation } from 'lucide-react';
import './index.css';

const Hero = ({ bgImage, location }) => {
  return (
    <div className="hero-container" style={{ position: 'relative', height: '60vh', overflow: 'hidden', borderRadius: '0 0 var(--radius) var(--radius)' }}>
      <div 
        style={{ 
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
          backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center',
          transition: 'background-image 0.5s ease-in-out'
        }} 
      />
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(to bottom, rgba(11, 15, 25, 0.2), var(--bg-color))' }} />
      <div className="container flex-col justify-end" style={{ height: '100%', position: 'relative', zIndex: 10, paddingBottom: '4rem' }}>
        <h1 className="animate-fade-in" style={{ marginBottom: '1rem' }}>
          Explore <span className="text-gradient">{location}</span>
        </h1>
        <p className="text-muted animate-fade-in delay-1" style={{ fontSize: '1.2rem', maxWidth: '600px' }}>
          Your personalized interactive travel concierge for an unforgettable journey.
        </p>
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
            onMouseOver={(e) => e.currentTarget.style.color = 'var(--text-main)'}
            onMouseOut={(e) => e.currentTarget.style.color = isMapOpen ? 'var(--accent)' : 'var(--text-muted)'}
          >
            <MapPin size={14} />
            {isMapOpen ? 'Hide Map' : 'View on Map'}
          </button>
        </div>

        {/* Map Embed Container */}
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

const App = () => {
  const [activeDay, setActiveDay] = useState(0);
  const [itineraryData, setItineraryData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/itinerary.json')
      .then(res => res.json())
      .then(data => {
        setItineraryData(data);
        setLoading(false);
      })
      .catch(err => console.error("Failed to load itinerary", err));
  }, []);

  if (loading || itineraryData.length === 0) {
    return <div className="app-container flex items-center justify-center" style={{ height: '100vh' }}>Loading...</div>;
  }

  const activeData = itineraryData[activeDay];

  return (
    <div className="app-container">
      <Hero bgImage={activeData.image} location={activeData.location} />
      
      <div className="container" style={{ marginTop: '-2rem', position: 'relative', zIndex: 20 }}>
        {/* Day Selector Horizontal Scroll */}
        <div 
          className="flex gap-4" 
          style={{ 
            overflowX: 'auto', padding: '1rem 0', scrollbarWidth: 'none', msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {itineraryData.map((day, idx) => (
            <DayCard 
              key={idx} 
              dayData={day} 
              isActive={activeDay === idx} 
              onClick={() => setActiveDay(idx)} 
            />
          ))}
        </div>

        {/* Itinerary Details */}
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

export default App;
