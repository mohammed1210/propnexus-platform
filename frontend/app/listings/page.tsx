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

/* ---------- filter options ---------- */
const PRICE_MIN = [
  { v: '', label: 'Min £' },
  { v: '75000',  label: '£75k+' },
  { v: '100000', label: '£100k+' },
  { v: '150000', label: '£150k+' },
  { v: '200000', label: '£200k+' },
  { v: '300000', label: '£300k+' },
  { v: '500000', label: '£500k+' },
]
const PRICE_MAX = [
  { v: '', label: 'Max £' },
  { v: '100000', label: '£100k' },
  { v: '150000', label: '£150k' },
  { v: '200000', label: '£200k' },
  { v: '300000', label: '£300k' },
  { v: '500000', label: '£500k' },
  { v: '750000', label: '£750k' },
]
const BEDS = [
  { v: '', label: 'Any beds' },
  { v: '1', label: '1+ bed' },
  { v: '2', label: '2+ beds' },
  { v: '3', label: '3+ beds' },
  { v: '4', label: '4+ beds' },
]
const TYPES = [
  { v: '',     label: 'All types' },
  { v: 'btl',  label: 'Buy-to-Let' },
  { v: 'hmo',  label: 'HMO' },
  { v: 'flip', label: 'Flip' },
  { v: 'sa',   label: 'Serviced Accom' },
]

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

/* --------------------- Filters bar (polished) --------------------- */
function FiltersBar() {
  const sp = useSearchParams()
  const router = useRouter()

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
    // (no outer margins here; wrapper handles sticky + padding)
    <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-3 items-center">
      {/* prominent search */}
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search by area, title, or postcode"
        className="border rounded-lg px-4 py-3 text-lg w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
      />

      <select
        value={min}
        onChange={e => setMin(e.target.value)}
        className="border rounded-lg px-3 py-2 w-full focus:ring-indigo-500 bg-white"
      >
        {PRICE_MIN.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>

      <select
        value={max}
        onChange={e => setMax(e.target.value)}
        className="border rounded-lg px-3 py-2 w-full focus:ring-indigo-500 bg-white"
      >
        {PRICE_MAX.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>

      <select
        value={beds}
        onChange={e => setBeds(e.target.value)}
        className="border rounded-lg px-3 py-2 w-full focus:ring-indigo-500 bg-white"
      >
        {BEDS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>

      <select
        value={type}
        onChange={e => setType(e.target.value)}
        className="border rounded-lg px-3 py-2 w-full focus:ring-indigo-500 bg-white"
      >
        {TYPES.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>

      <div className="flex gap-2">
        <button
          onClick={apply}
          className="rounded-lg bg-indigo-600 text-white px-4 py-2.5 shadow-sm hover:bg-indigo-500"
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

/* ----------------------- Listings (data) ----------------------- */
function ListingsInner() {
  const searchParams = useSearchParams()

  const q     = searchParams?.get('q')    ?? ''
  const minP  = Number(searchParams?.get('min')  ?? '') || 0
  const maxP  = Number(searchParams?.get('max')  ?? '') || 0
  const beds  = Number(searchParams?.get('beds') ?? '') || 0
  const type  = searchParams?.get('type') ?? ''

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
      if (type) query = query.eq('investment_type', type)

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

      {/* Sticky wrapper for the filter bar */}
      <div className="
        sticky top-16 md:top-20 z-30
        bg-white/80 dark:bg-zinc-950/80 backdrop-blur
        supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-zinc-950/60
        border border-zinc-200 dark:border-zinc-800
        rounded-xl p-3 mb-6
      ">
        <FiltersBar />
      </div>

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