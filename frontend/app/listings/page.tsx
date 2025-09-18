'use client'
export const dynamic = 'force-dynamic'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import nextDynamic from 'next/dynamic'
import type { Map as LeafletMap, LatLngBoundsExpression } from 'leaflet'

import Section from '@/components/ui/Section'
import SectionTitle from '@/components/ui/SectionTitle'
import PropertyCard from '@/components/PropertyCard'
import { getSupabase } from '@/lib/supabaseClient'

const MapContainer = nextDynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false })
const TileLayer    = nextDynamic(() => import('react-leaflet').then(m => m.TileLayer),    { ssr: false })
const Marker       = nextDynamic(() => import('react-leaflet').then(m => m.Marker),       { ssr: false })
const Popup        = nextDynamic(() => import('react-leaflet').then(m => m.Popup),        { ssr: false })

type RawProperty = {
  id: string | null
  title: string | null
  location: string | null
  price: number | null
  bedrooms?: number | null
  bathrooms?: number | null
  yield_percent?: number | null
  roi_percent?: number | null
  imageurl?: string | null
  latitude?: number | null
  longitude?: number | null
  investment_type?: string | null
}

export default function ListingsPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading…</div>}>
      <ListingsInner />
    </Suspense>
  )
}

function ClientMap({
  points,
  defaultCenter,
}: {
  points: { id: string; title: string; lat: number; lng: number; price?: number }[]
  defaultCenter: [number, number]
}) {
  const mapRef = useRef<LeafletMap | null>(null)

  const fitToPoints = (m: LeafletMap, pts: { lat: number; lng: number }[]) => {
    if (!pts.length) return
    const bounds: LatLngBoundsExpression = pts.map(p => [p.lat, p.lng]) as LatLngBoundsExpression
    m.fitBounds(bounds, { padding: [24, 24] })
  }

  const setMap = (instance: LeafletMap | null) => {
    if (!instance) return
    mapRef.current = instance
    if (points.length) fitToPoints(instance, points)
    else instance.setView(defaultCenter, 6)
  }

  useEffect(() => {
    const m = mapRef.current
    if (!m) return
    if (points.length) fitToPoints(m, points)
    else m.setView(defaultCenter, 6)
  }, [points, defaultCenter])

  return (
    <MapContainer
      ref={setMap as any}
      center={defaultCenter}
      zoom={6}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {points.map(p => (
        <Marker key={p.id} position={{ lat: p.lat, lng: p.lng }}>
          <Popup>
            <div className="text-sm font-medium">{p.title}</div>
            {p.price ? <div className="text-xs opacity-70">£{p.price.toLocaleString()}</div> : null}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}

/* --------------------------- Filters bar --------------------------- */
function FiltersBar() {
  const sp = useSearchParams()
  const router = useRouter()

  // Narrow sp before using
  const qInit    = sp ? sp.get('q')    ?? '' : ''
  const minInit  = sp ? sp.get('min')  ?? '' : ''
  const maxInit  = sp ? sp.get('max')  ?? '' : ''
  const bedsInit = sp ? sp.get('beds') ?? '' : ''
  const typeInit = sp ? sp.get('type') ?? '' : ''

  const [q, setQ]       = useState(qInit)
  const [min, setMin]   = useState(minInit)
  const [max, setMax]   = useState(maxInit)
  const [beds, setBeds] = useState(bedsInit)
  const [type, setType] = useState(typeInit)

  const apply = () => {
    const p = new URLSearchParams()
    if (q)    p.set('q', q)
    if (min)  p.set('min', min)
    if (max)  p.set('max', max)
    if (beds) p.set('beds', beds)
    if (type) p.set('type', type)
    router.push(`/listings?${p.toString()}`)
  }

  const reset = () => router.push('/listings')

  return (
    <div className="mb-6 grid grid-cols-1 md:grid-cols-[2fr_repeat(4,1fr)_auto] gap-3 items-center">
      {/* Big, prominent search */}
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search by area, title, or postcode"
        className="border rounded-lg px-4 py-3 text-lg w-full shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {/* Min/Max */}
      <input
        value={min}
        onChange={e => setMin(e.target.value)}
        placeholder="Min £"
        inputMode="numeric"
        className="border rounded-lg px-3 py-2 w-full shadow-sm focus:ring-indigo-500"
      />
      <input
        value={max}
        onChange={e => setMax(e.target.value)}
        placeholder="Max £"
        inputMode="numeric"
        className="border rounded-lg px-3 py-2 w-full shadow-sm focus:ring-indigo-500"
      />

      {/* Beds dropdown */}
      <select
        value={beds}
        onChange={e => setBeds(e.target.value)}
        className="border rounded-lg px-3 py-2 w-full shadow-sm focus:ring-indigo-500"
      >
        <option value="">Any beds</option>
        <option value="1">1+ bed</option>
        <option value="2">2+ beds</option>
        <option value="3">3+ beds</option>
        <option value="4">4+ beds</option>
      </select>

      {/* Investment type */}
      <select
        value={type}
        onChange={e => setType(e.target.value)}
        className="border rounded-lg px-3 py-2 w-full shadow-sm focus:ring-indigo-500"
      >
        <option value="">All types</option>
        <option value="btl">Buy-to-Let</option>
        <option value="hmo">HMO</option>
        <option value="flip">Flip</option>
        <option value="sa">Serviced Accom</option>
      </select>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={apply}
          className="rounded-lg bg-indigo-600 text-white px-4 py-2.5 shadow-sm hover:bg-indigo-500 transition"
        >
          Apply
        </button>
        <button
          onClick={reset}
          className="rounded-lg border px-4 py-2.5 hover:bg-zinc-50"
          title="Clear filters"
        >
          Reset
        </button>
      </div>
    </div>
  )
}

/* ------------------------ Listings (data) ------------------------- */
function ListingsInner() {
  const searchParams = useSearchParams()

  const q    = searchParams?.get('q')    ?? ''
  const minP = Number(searchParams?.get('min')  ?? '') || 0
  const maxP = Number(searchParams?.get('max')  ?? '') || 0
  const beds = Number(searchParams?.get('beds') ?? '') || 0
  const type = searchParams?.get('type') ?? '' // ✅ new

  const [rows, setRows] = useState<RawProperty[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const supabase = getSupabase()

      let query = supabase.from('properties').select('*').limit(200)

      if (q)    query = query.or(`title.ilike.%${q}%,location.ilike.%${q}%`)
      if (minP) query = query.gte('price', minP)
      if (maxP) query = query.lte('price', maxP)
      if (beds) query = query.gte('bedrooms', beds)
      if (type) query = query.eq('investment_type', type) // ✅ filter by type if present

      const { data, error } = await query

      if (!cancelled) {
        if (error) console.error(error)
        setRows(data || [])
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [q, minP, maxP, beds, type])

  const points = useMemo(() => {
    return rows
      .filter(r => r.latitude && r.longitude && r.id && r.title)
      .map(r => ({
        id: String(r.id),
        title: r.title as string,
        lat: r.latitude as number,
        lng: r.longitude as number,
        price: r.price ?? undefined,
      }))
  }, [rows])

  return (
    <Section>
      <SectionTitle>Listings</SectionTitle>

      <FiltersBar />

      <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-6">
        {/* left: list */}
        <div className="space-y-3">
          {loading ? (
            <div className="p-4">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="p-4">No results.</div>
          ) : (
            rows.map((r, i) => <PropertyCard key={`${r.id}-${i}`} p={r as any} />)
          )}
        </div>

        {/* right: sticky full-height map */}
        <div className="md:sticky md:top-20 h-[calc(100vh-6rem)]">
          <ClientMap points={points} defaultCenter={[53.5, -2]} />
        </div>
      </div>
    </Section>
  )
}
