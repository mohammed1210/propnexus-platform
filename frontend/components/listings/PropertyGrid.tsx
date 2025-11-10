'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Property } from '@/types/listings';
import { LuBedDouble, LuBath, LuTrendingUp, LuPercent } from 'react-icons/lu';
import { FiHeart } from 'react-icons/fi';

interface PropertyGridProps {
  properties: Property[];
  loading: boolean;
  error: string | null;
  viewMode: 'grid' | 'list';
}

export default function PropertyGrid({ properties, loading, error, viewMode }: PropertyGridProps) {
  if (loading) {
    return <LoadingSkeleton viewMode={viewMode} />;
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-8 text-center">
        <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-12 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiHeart className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No properties found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Try adjusting your filters to see more results
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={viewMode === 'grid' 
      ? 'grid grid-cols-1 md:grid-cols-2 gap-6'
      : 'space-y-4'
    }>
      {properties.map((property) => (
        <PropertyCard key={property.id} property={property} viewMode={viewMode} />
      ))}
    </div>
  );
}

function PropertyCard({ property, viewMode }: { property: Property; viewMode: 'grid' | 'list' }) {
  const formatPrice = (price?: number | null) => {
    if (!price) return '—';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getBadgeColor = (value: number, type: 'yield' | 'roi') => {
    const threshold = type === 'yield' ? 6 : 12;
    const mediumThreshold = type === 'yield' ? 4 : 8;
    
    if (value >= threshold) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    if (value >= mediumThreshold) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  return (
    <Link 
      href={`/property/${property.id}`}
      className="group block bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 
               overflow-hidden hover:shadow-xl hover:border-indigo-300 dark:hover:border-indigo-700 
               transition-all duration-300 hover:-translate-y-1"
    >
      {/* Image */}
      <div className="relative aspect-[16/9] overflow-hidden bg-gray-100 dark:bg-gray-700">
        <Image
          src={property.imageurl || '/placeholder.jpg'}
          alt={property.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover group-hover:scale-110 transition-transform duration-500"
        />
        
        {/* Badges */}
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          {typeof property.yield_percent === 'number' && (
            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold backdrop-blur-md shadow-lg ${getBadgeColor(property.yield_percent, 'yield')}`}>
              <LuPercent className="inline w-3 h-3 mr-1" />
              {property.yield_percent.toFixed(1)}% Yield
            </span>
          )}
          {typeof property.roi_percent === 'number' && (
            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold backdrop-blur-md shadow-lg ${getBadgeColor(property.roi_percent, 'roi')}`}>
              <LuTrendingUp className="inline w-3 h-3 mr-1" />
              {property.roi_percent.toFixed(1)}% ROI
            </span>
          )}
        </div>

        {/* Investment Type Badge */}
        {property.investment_type && (
          <div className="absolute bottom-3 left-3">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/90 dark:bg-gray-900/90 text-gray-900 dark:text-white backdrop-blur-md shadow-lg">
              {property.investment_type}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 space-y-3">
        {/* Price */}
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {formatPrice(property.price)}
          </span>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // TODO: Add to favorites
            }}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Add to favorites"
          >
            <FiHeart className="w-5 h-5 text-gray-400 hover:text-red-500" />
          </button>
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {property.title}
        </h3>

        {/* Location */}
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
          📍 {property.location || 'Location not specified'}
        </p>

        {/* Stats */}
        <div className="flex items-center gap-4 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
            <LuBedDouble className="w-4 h-4" />
            <span className="font-medium">{property.bedrooms || 0}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
            <LuBath className="w-4 h-4" />
            <span className="font-medium">{property.bathrooms || 0}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function LoadingSkeleton({ viewMode }: { viewMode: 'grid' | 'list' }) {
  return (
    <div className={viewMode === 'grid' 
      ? 'grid grid-cols-1 md:grid-cols-2 gap-6'
      : 'space-y-4'
    }>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden animate-pulse">
          <div className="aspect-[16/9] bg-gray-200 dark:bg-gray-700" />
          <div className="p-5 space-y-3">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-full" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
            <div className="flex gap-4 pt-3">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
