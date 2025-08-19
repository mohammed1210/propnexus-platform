"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import dynamic from "next/dynamic";

// UI helpers
import Section from "@/components/ui/Section";
import SectionTitle from "@/components/ui/SectionTitle";
import CardActions from "@/components/ui/CardActions";
import Badge from "@/components/ui/Badge";

// Property detail components
import MortgageCalculator from "@/components/property_details/MortgageCalculator";
import StampDutyCalculator from "@/components/property_details/StampDutyCalculator";
import AreaIntel from "@/components/property_details/AreaIntel";
import NotesFields from "@/components/property_details/NotesFields";
import InvestmentInsights from "@/components/property_details/InvestmentInsights";
import AIScoreBars from "@/components/property_details/AIScoreBars";
import AIScoreInfo from "@/components/property_details/AIScoreInfo";
import ExitStrategyGenerator from "@/components/property_details/ExitStrategyGenerator";
import AIChatbot from "@/components/property_details/AIChatbot";

// map (dynamic import to avoid SSR crash)
const MapSingle = dynamic(
  () => import("@/components/property_details/MapSingle"),
  { ssr: false }
);

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// If you already have a shared type in "@/types", feel free to import it instead.
type Property = {
  id: string | number;
  title: string;
  location: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  yield_percent?: number | null;
  roi_percent?: number | null;
  description?: string | null;
  imageurl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  avg_rent?: number | null;
  crime_index?: number | null;
  ofsted_summary?: string | null;
  transport_summary?: string | null;
  propertyType?: string | null;
  investmentType?: string | null;
};

export default function PropertyDetailsPage() {
  const params = useParams();
  const rawId = (params as Record<string, string | string[] | undefined>)?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  // AI Score state
  const [aiOverall, setAiOverall] = useState(0);
  const [aiItems, setAiItems] = useState<{ label: string; score: number }[]>(
    []
  );

  useEffect(() => {
    if (!id) return;
    fetchProperty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function fetchProperty() {
    setLoading(true);
    try {
      // 1) Try matching id as a string (uuid-like)
      let { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      // 2) If empty and id is numeric-looking, try numeric match
      if (!data && Number.isFinite(Number(id))) {
        const numeric = Number(id);
        const { data: dataNum, error: errNum } = await supabase
          .from("properties")
          .select("*")
          .eq("id", numeric)
          .maybeSingle();
        data = dataNum ?? null;
        error = errNum ?? null;
      }

      if (error) {
        console.error("[property details] fetch error:", error);
      }

      if (!data) {
        setProperty(null);
        setLoading(false);
        return;
      }

      setProperty(data as Property);
      computeAIScore(data as Property);
    } catch (err) {
      console.error("[property details] unexpected error:", err);
    } finally {
      setLoading(false);
    }
  }

  function computeAIScore(p: Property) {
    if (!p) return;
    const items = [
      { label: "Yield", score: Math.min(100, Number(p.yield_percent ?? 0) * 10) },
      { label: "ROI", score: Math.min(100, Number(p.roi_percent ?? 0) * 10) },
      { label: "Bedrooms", score: Math.min(100, Number(p.bedrooms ?? 0) * 20) },
      { label: "Bathrooms", score: Math.min(100, Number(p.bathrooms ?? 0) * 25) },
    ];
    setAiItems(items);
    const overall = Math.round(
      items.reduce((sum, i) => sum + i.score, 0) / items.length
    );
    setAiOverall(overall);
  }

  async function handleSaveDeal() {
    if (!property) return;
    await supabase.from("saved_deals").insert([{ property_id: property.id }]);
    alert("Deal saved!");
  }

  function handleDownloadPdf() {
    alert("Export to PDF coming soon!");
  }

  if (loading) return <p className="p-6">Loading…</p>;
  if (!property) return <p className="p-6">Property not found.</p>;

  const hasCoords =
    property.latitude != null &&
    property.longitude != null &&
    Number.isFinite(property.latitude) &&
    Number.isFinite(property.longitude);

  const postcode =
    property.location?.trim()?.split(/\s+/)?.slice(-1)?.[0] ?? undefined;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* ───────────────────────── Left (Main) ───────────────────────── */}
      <div className="md:col-span-2 space-y-6">
        {/* Header */}
        <header className="mb-4 md:mb-6">
          <h1 className="text-[clamp(1.5rem,4vw,2.25rem)] font-extrabold leading-tight text-balance">
            {property.title}
          </h1>
          <p className="text-slate-600 mt-1">{property.location}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <CardActions
              onSave={handleSaveDeal}
              onPdf={handleDownloadPdf}
              onCrm={() => alert("Sending to CRM…")}
            />
          </div>
        </header>

        {/* Hero Image */}
        {property.imageurl && (
          <img
            src={property.imageurl}
            alt={property.title}
            className="w-full h-72 md:h-96 object-cover rounded-xl shadow-sm"
          />
        )}

        {/* Description */}
        {property.description && (
          <Section>
            <SectionTitle icon={<span>📋</span>}>Overview</SectionTitle>
            <p className="text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
              {property.description}
            </p>
          </Section>
        )}

        {/* AI Deal Score */}
        <Section id="ai-score-section">
          <SectionTitle icon={<span>🧠</span>}>
            AI Deal Score{" "}
            <span className="ml-2 text-xs font-medium text-slate-500">beta</span>
          </SectionTitle>
          <AIScoreBars
            overall={aiOverall}
            items={aiItems}
            showHeader={false}
            className="mt-3"
          />
          <div className="mt-3">
            <AIScoreInfo />
          </div>
        </Section>

        {/* Exit Strategy Generator */}
        <Section>
          <SectionTitle icon={<span>🚪</span>}>Exit Strategies</SectionTitle>
          <ExitStrategyGenerator property={property} />
        </Section>

        {/* Mortgage */}
        <Section>
          <MortgageCalculator price={Number(property.price)} />
        </Section>

        {/* Stamp Duty */}
        <Section>
          <StampDutyCalculator price={Number(property.price)} />
        </Section>

        {/* Area Intelligence */}
        <Section>
          <AreaIntel
            locationLabel={property?.location}
            postcode={postcode}
            data={{
              avgYieldPct: property?.yield_percent ?? undefined,
              avgRent: property?.avg_rent ?? undefined,
              crimeRateIndex: property?.crime_index ?? undefined,
              ofstedSummary: property?.ofsted_summary ?? undefined,
              transportSummary: property?.transport_summary ?? undefined,
            }}
          />
        </Section>

        {/* Investment Insights */}
        <Section>
          <InvestmentInsights
            price={Number(property.price)}
            yield_percent={property.yield_percent ?? undefined}
            roi_percent={property.roi_percent ?? undefined}
            postcode={postcode}
            aiOverall={aiOverall}
            aiItems={aiItems.map((i) => ({
              label: i.label,
              value: i.score,
            }))}
            hideTitle
          />
        </Section>

        {/* Notes */}
        <Section>
          <SectionTitle icon={<span>📝</span>}>Notes</SectionTitle>
          <NotesFields propertyId={String(property.id)} />
        </Section>
      </div>

      {/* ───────────────────────── Right (Sidebar) ───────────────────────── */}
      <aside className="md:col-span-1 space-y-6">
        <Section>
          <SectionTitle icon={<span>⚡</span>}>Quick Actions</SectionTitle>
          <CardActions
            onSave={handleSaveDeal}
            onPdf={handleDownloadPdf}
            onCrm={() => alert("Sending to CRM…")}
          />
        </Section>

        <Section>
          <SectionTitle icon={<span>📊</span>}>Deal Summary</SectionTitle>
          <ul className="space-y-2 text-sm">
            <li>
              <Badge>Price</Badge> £{Number(property.price).toLocaleString()}
            </li>
            <li>
              <Badge>Yield</Badge>{" "}
              {property.yield_percent != null ? `${property.yield_percent}%` : "—"}
            </li>
            <li>
              <Badge>ROI</Badge>{" "}
              {property.roi_percent != null ? `${property.roi_percent}%` : "—"}
            </li>
            <li>
              <Badge>Beds</Badge> {property.bedrooms}
            </li>
            <li>
              <Badge>Baths</Badge> {property.bathrooms}
            </li>
          </ul>
        </Section>

        <Section>
          <SectionTitle icon={<span>🗺️</span>}>Location</SectionTitle>
          {hasCoords ? (
            <MapSingle property={property} height={260} zoom={14} scrollWheelZoom={false} />
          ) : (
            <p className="text-gray-500">Map unavailable — no coordinates provided.</p>
          )}
        </Section>
      </aside>

      {/* Floating Chatbot */}
      <AIChatbot property={property as Partial<Property>} />
    </div>
  );
}