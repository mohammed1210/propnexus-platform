
'use client';
import { useEffect, useState } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function Home() {
  const [properties, setProperties] = useState([]);

  const fetchData = async () => {
    try {
      const res = await fetch('https://propnexus-backend-production.up.railway.app/properties');
      const data = await res.json();
      setProperties(data);
      toast.success("Properties loaded successfully!");
    } catch (err) {
      toast.error("Failed to fetch properties.");
    }
  };

  const triggerScrape = async (platform) => {
    try {
      await fetch(`https://propnexus-backend-production.up.railway.app/scrape-${platform}`);
      toast.success(`${platform} scrape triggered.`);
    } catch {
      toast.error(`Failed to trigger ${platform} scrape.`);
    }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <main style={{ padding: 20 }}>
      <h1>PropNexus Deals</h1>
      <button onClick={() => triggerScrape('rightmove')}>Scrape Rightmove</button>
      <button onClick={() => triggerScrape('zoopla')}>Scrape Zoopla</button>
      <ul>
        {properties.map((prop, i) => (
          <li key={i}>{prop.title || "Untitled Property"}</li>
        ))}
      </ul>
      <ToastContainer />
    </main>
  );
}
