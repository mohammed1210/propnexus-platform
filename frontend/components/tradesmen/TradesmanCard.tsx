'use client';

import { FiStar, FiMapPin, FiMail, FiPhone } from 'react-icons/fi';

export interface Tradesman {
  id: string;
  full_name: string;
  trade_type: string;
  email?: string;
  phone?: string;
  website?: string;
  rating: number;
  distance_km?: number;
  service_radius_km: number;
}

interface TradesmanCardProps {
  tradesman: Tradesman;
  onContact: (tradesman: Tradesman) => void;
}

export default function TradesmanCard({ tradesman, onContact }: TradesmanCardProps) {
  const { full_name, trade_type, rating, distance_km, phone, email } = tradesman;

  return (
    <div className="card p-4 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-lg text-slate-900 dark:text-white mb-1">
            {full_name}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 capitalize mb-2">
            {trade_type}
          </p>
          
          <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 mb-3">
            {rating > 0 && (
              <div className="flex items-center gap-1">
                <FiStar className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <span className="font-medium">{rating.toFixed(1)}</span>
              </div>
            )}
            {distance_km !== undefined && (
              <div className="flex items-center gap-1">
                <FiMapPin className="w-4 h-4" />
                <span>{distance_km.toFixed(1)} km away</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-500">
            {phone && (
              <div className="flex items-center gap-1">
                <FiPhone className="w-3 h-3" />
              </div>
            )}
            {email && (
              <div className="flex items-center gap-1">
                <FiMail className="w-3 h-3" />
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => onContact(tradesman)}
          className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          Contact
        </button>
      </div>
    </div>
  );
}
