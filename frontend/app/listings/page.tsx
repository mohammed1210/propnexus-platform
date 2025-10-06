"use client";
export const dynamic = "force-dynamic";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import nextDynamic from "next/dynamic";
import type { Map as LeafletMap, LatLngBoundsExpression } from "leaflet";
import { FiSearch } from "react-icons/fi";
import { LuPoundSterling, LuBedDouble } from "react-icons/lu";

import Section from "@/components/ui/Section";
import SectionTitle from "@/components/ui/SectionTitle";
import PropertyCard from "@/components/PropertyCard";
import { getSupabase } from "@/lib/supabaseClient";

/* ------------------------------------------------------------------ */
/*  Dynamic map bits                                                   */
/* ------------------------------------------------------------------ */
const MapContainer = nextDynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = nextDynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false }
);
const Marker = nextDynamic(
  () => import("react-leaflet").then((m) => m.Marker),
  { ssr: false }
);
const Popup = nextDynamic(
  () => import("react-leaflet").then((m) => m.Popup),
  { ssr: false }
);

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type RawProperty = {
  id: string | null;
  title: string | null;
  location: string | null;
  price: number | string | null;
  bedrooms?: number | string | null;
  bathrooms?: number | string | null;
  yield_percent?: number | string | null;
  roi_percent?: number | string | null;
  imageurl?: string | null;       // <- DB column (note: no underscore)
  latitude?: number | null;
  longitude?: number | null;
};

type CardProperty = {
  id: string;
  title?: string | null;
  location?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  yield_percent?: number | null;
  roi_percent?: number | null;
  image_url?: string | null;      // <- what <PropertyCard/> expects
  latitude?: number | null;
  longitude?: number | null;
};

/* Small number coercer (handles null/""/"123") */
const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export default function ListingsPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading…</div>}>
      <ListingsInner />
    </Suspense>
  );
}

/* ------------------------------------------------------------------ */
/*  Map                                                                */
/* ------------------------------------------------------------------ */
function ClientMap({
  points,
  defaultCenter,
}: {
  points: { id: string; title: string; lat: number; lng: number; price?: number }[];
  defaultCenter: [number, number];
}) {
  const mapRef = useRef<LeafletMap | null>(null);

  const fit = (m: LeafletMap, pts: { lat: number; lng: number }[]) => {
    if (!pts.length) return;
    const bounds: LatLngBoundsExpression = pts.map((p) => [p.lat, p.lng]) as any;
    m.fitBounds(bounds, { padding: [24, 24] });
  };

  const setMap = (instance: LeafletMap | null) => {
    if (!instance) return;
    mapRef.current = instance;
    if (points.length) fit(instance, points);
    else instance.setView(defaultCenter, 6);
  };

  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (points.length) fit(m, points);
    else m.setView(defaultCenter, 6);
  }, [points, defaultCenter]);

  return (
    <MapContainer
      ref={setMap as any}
      center={defaultCenter}
      zoom={6}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {points.map((p) => (
        <Marker key={p.id} position={{ lat: p.lat, lng: p.lng }}>
          <Popup>
            <div className="text-sm font-medium">{p.title}</div>
            {typeof p.price === "number" ? (
              <div className="text-xs opacity-70">£{p.price.toLocaleString()}</div>
            ) : null}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

/* ------------------------------------------------------------------ */
/*  Filters                                                            */
/* ------------------------------------------------------------------ */
function FiltersBar() {
  const sp = useSearchParams();
  const router = useRouter();

  const qInit = sp ? sp.get("q") ?? "" : "";
  const minInit = sp ? sp.get("min") ?? "" : "";
  const maxInit = sp ? sp.get("max") ?? "" : "";
  const bedsInit = sp ? sp.get("beds") ?? "" : "";

  const [q, setQ] = useState(qInit);
  const [min, setMin] = useState(minInit);
  const [max, setMax] = useState(maxInit);
  const [beds, setBeds] = useState(bedsInit);

  const apply = () => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (min) p.set("min", min);
    if (max) p.set("max", max);
    if (beds) p.set("beds", beds);
    router.push(`/listings?${p.toString()}`);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
      <div className="col-span-2 flex items-center gap-2 border rounded-xl px-3 py-2 bg-white/90 dark:bg-zinc-900/90">
        <FiSearch className="opacity-60" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search area, title, or postcode"
          className="w-full bg-transparent outline-none"
          aria-label="Search"
        />
      </div>

      <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white/90 dark:bg-zinc-900/90">
        <LuPoundSterling className="opacity-60" aria-hidden />
        <input
          value={min}
          onChange={(e) => setMin(e.target.value)}
          placeholder="Min"
          inputMode="numeric"
          className="w-full bg-transparent outline-none"
          aria-label="Min price"
        />
      </div>

      <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white/90 dark:bg-zinc-900/90">
        <LuPoundSterling className="opacity-60" aria-hidden />
        <input
          value={max}
          onChange={(e) => setMax(e.target.value)}
          placeholder="Max"
          inputMode="numeric"
          className="w-full bg-transparent outline-none"
          aria-label="Max price"
        />
      </div>

      <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white/90 dark:bg-zinc-900/90">
        <LuBedDouble className="opacity-60" aria-hidden />
        <input
          value={beds}
          onChange={(e) => setBeds(e.target.value)}
          placeholder="Any beds"
          inputMode="numeric"
          className="w-full bg-transparent outline-none"
          aria-label="Minimum beds"
        />
      </div>

      <div className="flex gap-2">
        <button onClick={apply} className="btn btn-primary flex-1">
          Apply
        </button>
        <button
          onClick={() => {
            setQ("");
            setMin("");
            setMax("");
            setBeds("");
            router.push("/listings");
          }}
          className="btn btn-outline"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Data + Rendering                                                   */
/* ------------------------------------------------------------------ */
function ListingsInner() {
  const searchParams = useSearchParams();

  const q = searchParams?.get("q") ?? "";
  const minP = Number(searchParams?.get("min") ?? "") || 0;
  const maxP = Number(searchParams?.get("max") ?? "") || 0;
  const beds = Number(searchParams?.get("beds") ?? "") || 0;

  const [rows, setRows] = useState<RawProperty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const supabase = getSupabase();

      let query = supabase.from("properties").select("*").limit(200);

      if (q) query = query.or(`title.ilike.%${q}%,location.ilike.%${q}%`);
      if (minP) query = query.gte("price", minP);
      if (maxP) query = query.lte("price", maxP);
      if (beds) query = query.gte("bedrooms", beds);

      const { data, error } = await query;

      if (!cancelled) {
        if (error) console.error(error);
        setRows(data || []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q, minP, maxP, beds]);

  /* Normalise data for cards (fixes missing fields on the UI) */
  const cards: CardProperty[] = useMemo(() => {
    return (rows || [])
      .filter((r) => r && r.id) // must have an id
      .map((r) => ({
        id: String(r.id),
        title: r.title ?? null,
        location: r.location ?? null,
        price: toNum(r.price),
        bedrooms: toNum(r.bedrooms),
        bathrooms: toNum(r.bathrooms),
        yield_percent: toNum(r.yield_percent),
        roi_percent: toNum(r.roi_percent),
        image_url: r.imageurl ?? null,       // <- key rename here
        latitude: r.latitude ?? null,
        longitude: r.longitude ?? null,
      }));
  }, [rows]);

  const points = useMemo(() => {
    return cards
      .filter((r) => typeof r.latitude === "number" && typeof r.longitude === "number")
      .map((r) => ({
        id: r.id,
        title: r.title || "Property",
        lat: r.latitude as number,
        lng: r.longitude as number,
        price: r.price ?? undefined,
      }));
  }, [cards]);

  return (
    <Section>
      <SectionTitle>PropNexus Listings</SectionTitle>

      {/* Sticky shell directly under site header */}
      <div className="sticky-filter">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <FiltersBar />
        </div>
      </div>

      <div className="content-layout pt-4">
        {/* left: list */}
        <div className="space-y-3">
          {loading ? (
            <div className="p-4">Loading…</div>
          ) : cards.length === 0 ? (
            <div className="p-4">No results.</div>
          ) : (
            cards.map((p) => <PropertyCard key={p.id} p={p as any} />)
          )}
        </div>

        {/* right: sticky map */}
        <div className="map-sticky">
          <div className="leaflet-panel">
            <ClientMap points={points} defaultCenter={[53.5, -2]} />
          </div>
        </div>
      </div>
    </Section>
  );
}
