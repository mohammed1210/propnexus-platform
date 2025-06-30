'use client';

import { useEffect, useState } from 'react';

export default function Home() {
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('https://propnexus-backend-production.up.railway.app/properties')
      .then((res) => res.json())
      .then(async (data) => {
        console.log('Fetched properties:', data);

        const updated = await Promise.all(
          data.map(async (property: any) => {
            if (property.location) {
              const coords = await geocodePostcode(property.location);
              return { ...property, lat: coords.lat, lng: coords.lng };
            }
            return property;
          })
        );

        setProperties(updated);
        setLoading(false);
      })
      .catch(() => {
        setProperties([]);
        setLoading(false);
      });
  }, []);

  // Function to geocode using Google Maps API
  async function geocodePostcode(postcode: string) {
    try {
      const apiKey = 'AIzaSyCkjrvxTk_GSFhDMyuOgpgxBnH9gF-oGSM';
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          postcode
        )}&key=${apiKey}`
      );
      const data = await response.json();
      if (data.status === 'OK') {
        const location = data.results[0].geometry.location;
        return { lat: location.lat, lng: location.lng };
      } else {
        console.error('Geocoding failed:', data.status);
        return { lat: 0, lng: 0 };
      }
    } catch (err) {
      console.error('Error fetching geocode:', err);
      return { lat: 0, lng: 0 };
    }
  }

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Live Property Deals</h1>
      {loading ? (
        <p>Loading properties...</p>
      ) : properties.length === 0 ? (
        <p>No properties found.</p>
      ) : (
        <>
          <div style={{ height: '500px', width: '100%', marginBottom: '2rem' }}>
            <iframe
              width="100%"
              height="100%"
              loading="lazy"
              allowFullScreen
              src={`https://www.google.com/maps/embed/v1/view?key=AIzaSyCkjrvxTk_GSFhDMyuOgpgxBnH9gF-oGSM&center=${properties[0].lat},${properties[0].lng}&zoom=6`}
            ></iframe>
          </div>

          {properties.map((property, idx) => (
            <div key={idx} style={{ marginBottom: '1rem', borderBottom: '1px solid #333', paddingBottom: '1rem' }}>
              <strong>{property.title}</strong><br />
              Price: £{property.price}<br />
              Location: {property.location}<br />
              Yield: {property.yield_percent ? `${property.yield_percent}%` : 'N/A'}<br />
              ROI: {property.roi_percent ? `${property.roi_percent}%` : 'N/A'}<br />
              Source: {property.source}
            </div>
          ))}
        </>
      )}
    </main>
  );
}
