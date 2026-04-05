'use client';

import { useEffect, useState } from 'react';
import TradesmanCard, { type Tradesman } from './TradesmanCard';
import ContactTradesmanModal from './ContactTradesmanModal';

interface TradesmenListProps {
  propertyLat: number;
  propertyLng: number;
  propertyId?: string;
  tradeType?: string;
  radius?: number;
  userEmail?: string;
}

export default function TradesmenList({
  propertyLat,
  propertyLng,
  propertyId,
  tradeType,
  radius = 20,
  userEmail,
}: TradesmenListProps) {
  const [tradesmen, setTradesmen] = useState<Tradesman[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTradesman, setSelectedTradesman] = useState<Tradesman | null>(null);

  useEffect(() => {
    const fetchTradesmen = async () => {
      // Skip if coordinates are invalid
      if (!propertyLat || !propertyLng || Math.abs(propertyLat) > 90 || Math.abs(propertyLng) > 180) {
        setLoading(false);
        setError('Invalid property location');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          lat: propertyLat.toString(),
          lng: propertyLng.toString(),
          radius_km: radius.toString(),
        });

        if (tradeType) {
          params.append('trade_type', tradeType.toLowerCase());
        }

        const response = await fetch(`/api/tradesmen/nearby?${params.toString()}`, {
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch tradesmen');
        }

        const data = await response.json();
        setTradesmen(data || []);
      } catch (err: any) {
        console.error('Error fetching tradesmen:', err);
        setError(err.message || 'Failed to load tradesmen');
      } finally {
        setLoading(false);
      }
    };

    fetchTradesmen();
  }, [propertyLat, propertyLng, tradeType, radius]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-4 animate-pulse">
            <div className="flex gap-3">
              <div className="flex-1 space-y-2">
                <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
              </div>
              <div className="w-20 h-10 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 text-center">
        <p className="text-slate-600 dark:text-slate-400">{error}</p>
      </div>
    );
  }

  if (tradesmen.length === 0) {
    return (
      <div className="card p-6 text-center">
        <p className="text-slate-600 dark:text-slate-400">
          No {tradeType ? tradeType.toLowerCase() + 's' : 'tradesmen'} found within {radius} km of
          this property.
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-500 mt-2">
          Try expanding your search radius or selecting a different trade type.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {tradesmen.map((tradesman) => (
          <TradesmanCard
            key={tradesman.id}
            tradesman={tradesman}
            onContact={setSelectedTradesman}
          />
        ))}
      </div>

      {selectedTradesman && (
        <ContactTradesmanModal
          tradesman={selectedTradesman}
          propertyId={propertyId}
          userEmail={userEmail}
          onClose={() => setSelectedTradesman(null)}
        />
      )}
    </>
  );
}
