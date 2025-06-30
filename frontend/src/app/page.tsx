'use client';

import { useEffect, useState } from 'react';
import GoogleMapReact from 'google-map-react';

const Marker = ({ text }: { text: string }) => (
  <div style={{ color: 'red', fontWeight: 'bold' }}>📍{text}</div>
);

export default function Home() {
  const [properties, setProperties] = useState<any[]>([]);
  const [propertyCoords, setPropertyCoords] = useState<any[]>([]);

  const GOOGLE_API_KEY = 'AIzaSyCkjrvxTk_GSFhDMyuOgpgxBnH9gF-oGSM';

  useEffect(() => {
    fetch('https://propnexus-backend-production.up.railway.app/properties')
      .then((res) => res.json())
      .then((data) => {
        setProperties(data);
        geocodeProperties(data);
      })
      .catch(() => setProperties([]));
  }, []);

  const geocodeProperties = async (props: any[]) => {
    const coordsArray: any[] = [];

    for (const prop of props) {
      if (!prop.location) continue;

      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
            prop.location
          )}&key=${GOOGLE_API_KEY}`
        );
        const data = await response.json();

        if (data.results && data.results[0]) {
          const location = data.results[0].geometry.location;
          coordsArray.push({
            ...prop,
            lat: location.lat,
            lng: location.lng,
          });
        }
      } catch (error) {
        console.error('Geocoding error:', error);
      }
    }

    setPropertyCoords(coordsArray);
  };

  const defaultCenter = {
    lat: 51.5074, // London center default
    lng: -0.1278,
  };

  return (
    <main style={{ padding: '1rem' }}>
      <h1>Live Property Deals (with Map)</h1>

      <div style={{ height: '500px', width: '100%', marginBottom: '2rem' }}>
        <GoogleMapReact
          bootstrapURLKeys={{ key: GOOGLE_API_KEY }}
          defaultCenter={defaultCenter}
          defaultZoom={6}
        >
          {propertyCoords.map((prop, idx) => (
            <Marker
              key={idx}
              lat={prop.lat}
              lng={prop.lng}
              text={prop.title}
            />
          ))}
        </GoogleMapReact>
      </div>

      {properties.length === 0 ? (
        <p>No properties found.</p>
      ) : (
        properties.map((property, idx) => (
          <div
            key={idx}
            style={{
              marginBottom: '1rem',
              border: '1px solid #ccc',
              padding: '1rem',
              borderRadius: '6px',
            }}
          >
            <strong>{property.title}</strong><br />
            Price: £{property.price}<br />
            Location: {property.location}<br />
            Yield: {property.yield_percent ? `${property.yield_percent}%` : 'N/A'}<br />
            ROI: {property.roi_percent ? `${property.roi_percent}%` : 'N/A'}<br />
            Source: {property.source}<br />
            <img
              src={property.imageurl}
              alt={property.title}
              style={{ maxWidth: '100%', marginTop: '0.5rem' }}
            />
            <p>{property.description}</p>
          </div>
        ))
      )}
    </main>
  );
}
