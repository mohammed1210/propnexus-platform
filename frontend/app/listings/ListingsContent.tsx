'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseClient';
import ListingsFilters from '@/components/listings/ListingsFilters';
import PropertyGrid from '@/components/listings/PropertyGrid';
import PropertyMap from '@/components/listings/PropertyMap';
import ResultsSummary from '@/components/listings/ResultsSummary';
import { Property, FilterParams } from '@/types/listings';

// Mock data for development/fallback
const MOCK_PROPERTIES: Property[] = [
  {
    id: '1',
    title: '3-Bed Victorian Terrace - High ROI Potential',
    location: 'Manchester, Greater Manchester',
    price: 185000,
    bedrooms: 3,
    bathrooms: 1,
    yield_percent: 6.5,
    roi_percent: 14.2,
    imageurl: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&h=600&fit=crop',
    latitude: 53.4808,
    longitude: -2.2426,
    created_at: new Date().toISOString(),
    investment_type: 'BTL',
  },
  {
    id: '2',
    title: 'Modern 2-Bed Apartment - City Centre',
    location: 'Birmingham, West Midlands',
    price: 165000,
    bedrooms: 2,
    bathrooms: 2,
    yield_percent: 5.8,
    roi_percent: 11.5,
    imageurl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=600&fit=crop',
    latitude: 52.4862,
    longitude: -1.8904,
    created_at: new Date().toISOString(),
    investment_type: 'BTL',
  },
  {
    id: '3',
    title: '5-Bed HMO - Excellent Student Area',
    location: 'Leeds, West Yorkshire',
    price: 225000,
    bedrooms: 5,
    bathrooms: 2,
    yield_percent: 8.2,
    roi_percent: 16.8,
    imageurl: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&h=600&fit=crop',
    latitude: 53.8008,
    longitude: -1.5491,
    created_at: new Date().toISOString(),
    investment_type: 'HMO',
  },
  {
    id: '4',
    title: '4-Bed Semi-Detached - Family Favorite',
    location: 'Liverpool, Merseyside',
    price: 195000,
    bedrooms: 4,
    bathrooms: 2,
    yield_percent: 5.2,
    roi_percent: 10.8,
    imageurl: 'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=800&h=600&fit=crop',
    latitude: 53.4084,
    longitude: -2.9916,
    created_at: new Date().toISOString(),
    investment_type: 'BTL',
  },
  {
    id: '5',
    title: 'Serviced Apartment - Prime Location',
    location: 'Newcastle upon Tyne, Tyne and Wear',
    price: 145000,
    bedrooms: 1,
    bathrooms: 1,
    yield_percent: 7.5,
    roi_percent: 13.9,
    imageurl: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop',
    latitude: 54.9783,
    longitude: -1.6178,
    created_at: new Date().toISOString(),
    investment_type: 'SA',
  },
  {
    id: '6',
    title: 'Commercial Property - Mixed Use',
    location: 'Sheffield, South Yorkshire',
    price: 285000,
    bedrooms: 0,
    bathrooms: 2,
    yield_percent: 6.8,
    roi_percent: 12.4,
    imageurl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&h=600&fit=crop',
    latitude: 53.3811,
    longitude: -1.4701,
    created_at: new Date().toISOString(),
    investment_type: 'Commercial',
  },
];

export default function ListingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Parse filters from URL
  const filters = useMemo<FilterParams>(() => ({
    search: searchParams?.get('q') || '',
    minPrice: searchParams?.get('min') ? parseInt(searchParams.get('min')!) : undefined,
    maxPrice: searchParams?.get('max') ? parseInt(searchParams.get('max')!) : undefined,
    bedrooms: searchParams?.get('beds') ? parseInt(searchParams.get('beds')!) : undefined,
    bathrooms: searchParams?.get('baths') ? parseInt(searchParams.get('baths')!) : undefined,
    investmentTypes: searchParams?.get('types')?.split(',').filter(Boolean) || [],
    sort: (searchParams?.get('sort') as any) || 'created_at',
    sortDirection: (searchParams?.get('dir') as any) || 'desc',
  }), [searchParams]);

  // Fetch properties
  useEffect(() => {
    let cancelled = false;

    const fetchProperties = async () => {
      setLoading(true);
      setError(null);

      try {
        const supabase = getSupabase();
        let query = supabase
          .from('properties')
          .select('*')
          .limit(100);

        // Apply filters
        if (filters.search) {
          query = query.or(`title.ilike.%${filters.search}%,location.ilike.%${filters.search}%`);
        }
        if (filters.minPrice) query = query.gte('price', filters.minPrice);
        if (filters.maxPrice) query = query.lte('price', filters.maxPrice);
        if (filters.bedrooms) query = query.gte('bedrooms', filters.bedrooms);
        if (filters.bathrooms) query = query.gte('bathrooms', filters.bathrooms);

        // Apply sorting
        query = query.order(filters.sort, { 
          ascending: filters.sortDirection === 'asc',
          nullsFirst: false 
        });

        const { data, error: fetchError } = await query;

        if (cancelled) return;

        if (fetchError) {
          console.warn('[Listings] Using mock data - Supabase unavailable');
          // Apply client-side filters to mock data
          let filtered = [...MOCK_PROPERTIES];
          
          if (filters.search) {
            const search = filters.search.toLowerCase();
            filtered = filtered.filter(p => 
              p.title?.toLowerCase().includes(search) || 
              p.location?.toLowerCase().includes(search)
            );
          }
          if (filters.minPrice) filtered = filtered.filter(p => (p.price ?? 0) >= filters.minPrice!);
          if (filters.maxPrice) filtered = filtered.filter(p => (p.price ?? 0) <= filters.maxPrice!);
          if (filters.bedrooms) filtered = filtered.filter(p => (p.bedrooms ?? 0) >= filters.bedrooms!);
          if (filters.bathrooms) filtered = filtered.filter(p => (p.bathrooms ?? 0) >= filters.bathrooms!);
          
          setProperties(filtered);
        } else {
          setProperties(data || []);
        }
      } catch (err) {
        console.error('[Listings] Error:', err);
        setError('Failed to load properties');
        setProperties(MOCK_PROPERTIES);
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();

    return () => {
      cancelled = true;
    };
  }, [filters]);

  const handleFilterChange = useCallback((newFilters: Partial<FilterParams>) => {
    const params = new URLSearchParams();
    
    const merged = { ...filters, ...newFilters };
    
    if (merged.search) params.set('q', merged.search);
    if (merged.minPrice) params.set('min', merged.minPrice.toString());
    if (merged.maxPrice) params.set('max', merged.maxPrice.toString());
    if (merged.bedrooms) params.set('beds', merged.bedrooms.toString());
    if (merged.bathrooms) params.set('baths', merged.bathrooms.toString());
    if (merged.investmentTypes.length) params.set('types', merged.investmentTypes.join(','));
    if (merged.sort) params.set('sort', merged.sort);
    if (merged.sortDirection) params.set('dir', merged.sortDirection);

    router.push(`/listings?${params.toString()}`);
  }, [filters, router]);

  const mapPoints = useMemo(() => {
    return properties
      .filter(p => p.latitude && p.longitude)
      .map(p => ({
        id: p.id,
        title: p.title,
        lat: p.latitude!,
        lng: p.longitude!,
        price: p.price,
      }));
  }, [properties]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-[1920px] mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Property Listings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Discover investment opportunities across the UK
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6">
          <ListingsFilters 
            filters={filters}
            onFilterChange={handleFilterChange}
          />
        </div>

        {/* Results Summary */}
        <div className="mb-6">
          <ResultsSummary 
            totalCount={properties.length}
            filters={filters}
            loading={loading}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Properties Grid */}
          <div className="lg:col-span-2">
            <PropertyGrid 
              properties={properties}
              loading={loading}
              error={error}
              viewMode={viewMode}
            />
          </div>

          {/* Map */}
          <div className="hidden lg:block">
            <div className="sticky top-6">
              <PropertyMap 
                points={mapPoints}
                loading={loading}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
