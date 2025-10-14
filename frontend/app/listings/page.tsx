// frontend/app/listings/page.tsx
"use client";
export const dynamic = "force-dynamic";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import nextDynamic from "next/dynamic";
import type { Map as LeafletMap, LatLngBoundsExpression } from "leaflet";
import { FiSearch } from "react-icons/fi";
import { LuPoundSterling, LuBedDouble } from "react-icons/lu";

import Section from "@/components/ui/Section";
import SectionTitle from "@/components/ui/SectionTitle";
import PropertyCard from "@/components/PropertyCard";
import { getSupabase } from "@/lib/supabaseClient";

const MapContainer = nextDynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false },
);
const TileLayer = nextDynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false },
);
const Marker = nextDynamic(
  () => import("react-leaflet").then((m) => m.Marker),
  { ssr: false },
);
const Popup = nextDynamic(
  () => import("react-leaflet").then((m) => m.Popup),
  { ssr: false },
);

type RawProperty = {
  id: string | null;
  title: string | null;
  location: string | null;
  price: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  yield_percent?: number | null;
  roi_percent?: number | null;
  imageurl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string | null;
};

export default function ListingsPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading…</div>}>
      <ListingsInner />
    </Suspense>
  );
}

/* ---------------- Map ---------------- */
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
            {typeof p.price === "number" && (
              <div className="text-xs opacity-70">£{p.price.toLocaleString()}</div>
            )}
            <div className="mt-1">
              <Link href={`/property/${p.id}`} className="underline text-xs">
                View details
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

/* ---------------- Filters ---------------- */
function FiltersBar() {
  const sp = useSearchParams();
  const router = useRouter();

  const qInit = sp?.get("q") ?? "";
  const minInit = sp?.get("min") ?? "";
  const maxInit = sp?.get("max") ?? "";
  const bedsInit = sp?.get("beds") ?? "";

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
        <FiSearch className="opacity-60" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search area, title, or postcode"
          className="w-full bg-transparent outline-none"
        />
      </div>

      <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white/90 dark:bg-zinc-900/90">
        <LuPoundSterling className="opacity-60" />
        <input
          value={min}
          onChange={(e) => setMin(e.target.value)}
          placeholder="Min"
          inputMode="numeric"
          className="w-full bg-transparent outline-none"
        />
      </div>

      <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white/90 dark:bg-zinc-900/90">
        <LuPoundSterling className="opacity-60" />
        <input
          value={max}
          onChange={(e) => setMax(e.target.value)}
          placeholder="Max"
          inputMode="numeric"
          className="w-full bg-transparent outline-none"
        />
      </div>

      <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white/90 dark:bg-zinc-900/90">
        <LuBedDouble className="opacity-60" />
        <input
          value={beds}
          onChange={(e) => setBeds(e.target.value)}
          placeholder="Any beds"
          inputMode="numeric"
          className="w-full bg-transparent outline-none"
        />
      </div>

      <div className="flex gap-2">
        <button onClick={apply} className="pnx-pnx-btn pnx-pnx-pnx-btn-primary flex-1">
           Apply Filters
        </button>
        <button
          onClick={() => {
            setQ("");
            setMin("");
            setMax("");
            setBeds("");
            router.push("/listings");
          }}
          className="pnx-pnx-btn pnx-pnx-pnx-btn-outline"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

/* ---------------- Data + Layout ---------------- */
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

      // Fetch only the fields we actually use; keep ordering stable
      let query = supabase
        .from("properties")
        .select(
          "id,title,location,price,bedrooms,bathrooms,yield_percent,roi_percent,imageurl,latitude,longitude,created_at",
        )
        .limit(200)
        .order("created_at", { ascending: false });

      if (q) query = query.or(`title.ilike.%${q}%,location.ilike.%${q}%`);
      if (minP) query = query.gte("price", minP);
      if (maxP) query = query.lte("price", maxP);
      if (beds) query = query.gte("bedrooms", beds);

      const { data, error } = await query;
      if (cancelled) return;

      if (error) {
        console.error("[listings] supabase error", error);
        setRows([]);
      } else {
        setRows(data || []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [q, minP, maxP, beds]);

  const points = useMemo(() => {
    return rows
      .filter((r) => r.latitude && r.longitude && r.id && r.title)
      .map((r) => ({
        id: String(r.id),
        title: String(r.title),
        lat: Number(r.latitude),
        lng: Number(r.longitude),
        price: r.price ?? undefined,
      }));
  }, [rows]);

  return (
    <Section>
      <SectionTitle>PropNexus Listings</SectionTitle>

      {/* Sticky filter directly under site header */}
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
          ) : rows.length === 0 ? (
            <div className="p-4">No results.</div>
          ) : (
            rows.map((r) => (
              <Link key={r.id ?? Math.random()} href={`/property/${r.id}`} className="block">
                <PropertyCard p={r as any} />
              </Link>
            ))
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
