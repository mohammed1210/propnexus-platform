'use client';

import Link from 'next/link';
import { FiSearch, FiSliders, FiMapPin, FiHome, FiDroplet, FiMaximize2, FiHeart, FiMap } from 'react-icons/fi';
import { useState } from 'react';

export default function ListingsPreview() {
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');

  const filters = ['£200k-£400k', '2+ beds', 'London', 'High Yield'];

  const properties = [
    {
      id: 1,
      title: '2 Bed Apartment in Canary Wharf',
      location: 'Canary Wharf, London',
      price: '£485,000',
      beds: 2,
      baths: 2,
      sqft: '850',
      yield: '5.2%',
      imageGradient: 'from-brand-400 to-cyan-500',
    },
    {
      id: 2,
      title: 'Modern Studio in Shoreditch',
      location: 'Shoreditch, London',
      price: '£325,000',
      beds: 1,
      baths: 1,
      sqft: '485',
      yield: '6.1%',
      imageGradient: 'from-cyan-400 to-teal-500',
    },
    {
      id: 3,
      title: '3 Bed House in Manchester',
      location: 'Northern Quarter, Manchester',
      price: '£295,000',
      beds: 3,
      baths: 2,
      sqft: '1200',
      yield: '7.8%',
      imageGradient: 'from-teal-400 to-emerald-500',
    },
    {
      id: 4,
      title: 'Luxury Penthouse in Westminster',
      location: 'Westminster, London',
      price: '£1,250,000',
      beds: 3,
      baths: 3,
      sqft: '1850',
      yield: '4.2%',
      imageGradient: 'from-emerald-400 to-green-500',
    },
    {
      id: 5,
      title: '1 Bed Flat in Birmingham',
      location: 'City Centre, Birmingham',
      price: '£180,000',
      beds: 1,
      baths: 1,
      sqft: '520',
      yield: '6.8%',
      imageGradient: 'from-blue-400 to-brand-500',
    },
    {
      id: 6,
      title: '2 Bed Townhouse in Bristol',
      location: 'Clifton, Bristol',
      price: '£425,000',
      beds: 2,
      baths: 2,
      sqft: '980',
      yield: '5.5%',
      imageGradient: 'from-indigo-400 to-purple-500',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-slate-900">Property Listings</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 rounded-brand text-sm font-semibold transition-all duration-brand ${
                  viewMode === 'grid'
                    ? 'bg-brand-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Grid View
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`px-4 py-2 rounded-brand text-sm font-semibold transition-all duration-brand ${
                  viewMode === 'map'
                    ? 'bg-brand-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <FiMap className="inline mr-1" />
                Map View
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Search Input - 44px height */}
            <div className="flex-1">
              <div className="relative">
                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by location, postcode, or property type..."
                  className="w-full h-11 pl-12 pr-4 rounded-brand border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition-all duration-brand"
                />
              </div>
            </div>

            {/* Filter Button */}
            <button className="h-11 px-6 rounded-brand border border-slate-300 bg-white hover:bg-slate-50 flex items-center gap-2 font-semibold text-slate-700 transition-all duration-brand">
              <FiSliders className="w-5 h-5" />
              Filters
            </button>
          </div>

          {/* Active Filters Pills */}
          <div className="flex flex-wrap gap-2 mt-3">
            {filters.map((filter, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-100 text-brand-700 text-sm font-medium border border-brand-200"
              >
                {filter}
                <button className="hover:text-brand-900 transition-colors">×</button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {viewMode === 'grid' ? (
          <>
            {/* Results Count */}
            <div className="mb-6 flex items-center justify-between">
              <p className="text-slate-600">
                <span className="font-semibold text-slate-900">{properties.length}</span> properties found
              </p>
              <select className="h-11 px-4 rounded-brand border border-slate-300 bg-white text-slate-700 font-medium focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition-all duration-brand">
                <option>Highest Yield</option>
                <option>Lowest Price</option>
                <option>Highest Price</option>
                <option>Most Recent</option>
              </select>
            </div>

            {/* Property Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map((property) => (
                <Link
                  key={property.id}
                  href="/preview/details"
                  className="group bg-white rounded-brand-xl border border-slate-200 overflow-hidden hover:shadow-brand-lg hover:border-brand-300 transition-all duration-brand"
                >
                  {/* Image Placeholder with Gradient & Aspect Ratio */}
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <div className={`absolute inset-0 bg-gradient-to-br ${property.imageGradient} flex items-center justify-center group-hover:scale-105 transition-transform duration-brand`}>
                      <span className="text-white/50 text-sm font-medium">Property Image</span>
                    </div>
                    <button
                      className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors"
                      aria-label="Save property"
                    >
                      <FiHeart className="w-4 h-4 text-slate-600" />
                    </button>
                    <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-full bg-emerald-500 text-white text-sm font-bold">
                      {property.yield} yield
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold text-slate-900 text-lg leading-tight group-hover:text-brand-600 transition-colors">
                        {property.title}
                      </h3>
                    </div>

                    <p className="flex items-center gap-1.5 text-slate-600 text-sm mb-4">
                      <FiMapPin className="w-4 h-4" />
                      {property.location}
                    </p>

                    <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-200">
                      <span className="flex items-center gap-1.5 text-slate-600 text-sm">
                        <FiHome className="w-4 h-4" />
                        {property.beds}
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-600 text-sm">
                        <FiDroplet className="w-4 h-4" />
                        {property.baths}
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-600 text-sm">
                        <FiMaximize2 className="w-4 h-4" />
                        {property.sqft} sqft
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-slate-900">{property.price}</span>
                      <span className="text-sm text-brand-600 font-semibold">View Details →</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : (
          /* Map View Placeholder */
          <div className="bg-white rounded-brand-xl border border-slate-200 p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-400 to-cyan-500 flex items-center justify-center mx-auto mb-6">
                <FiMap className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Map View</h3>
              <p className="text-slate-600 mb-6">
                Interactive map showing all property locations with clustering and detail popups would appear here.
              </p>
              <button
                onClick={() => setViewMode('grid')}
                className="px-6 py-3 rounded-brand bg-brand-500 text-white font-semibold hover:bg-brand-600 transition-colors duration-brand"
              >
                Back to Grid View
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Back Link */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Link
          href="/preview"
          className="inline-flex items-center gap-2 text-brand-600 hover:text-brand-700 font-semibold transition-colors duration-brand"
        >
          ← Back to Preview Hub
        </Link>
      </div>
    </div>
  );
}
