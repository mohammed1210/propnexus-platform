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
import MortgageCalculator from "@/components/property-details/MortgageCalculator";
import StampDutyCalculator from "@/components/property-details/StampDutyCalculator";
import AreaIntel from "@/components/property-details/AreaIntel";
import NotesFields from "@/components/property-details/NotesFields";
import InvestmentInsights from "@/components/property-details/InvestmentInsights";
import AIScoreBars from "@/components/property-details/AIScoreBars";
import AIScoreInfo from "@/components/property-details/AIScoreInfo";
import ExitStrategyGenerator from "@/components/property-details/ExitStrategyGenerator";
import AIChatbot from "@/components/property-details/AIChatbot";

// map (dynamic import to avoid SSR crash)
const MapSingle = dynamic(() => import("@/components/MapSingle"), { ssr: false });

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Property = {
  id: string;
  title: string;
  location: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  yield_percent: number;
  roi_percent: number;
  description?: string;
  imageurl?: string;
  latitude?: number;
  longitude?: number;
  avg_rent?: number;
  crime_index?: number;
  ofsted_summary?: string;
  transport_summary?: string;
};

export default function PropertyDetailsPage() {
  const { id } = useParams();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  // AI Score state
  const [aiOverall, setAiOverall] = useState(0);
  const [aiItems, setAiItems] = useState<{ label: string; score: number }[]>([]);

  useEffect(() => {
    if (!id) return;
    fetchProperty();
  }, [id]);

  async function fetchProperty() {
    setLoading(true);
    const { data, error } = await supabase.from("properties").select("*").eq("id", id).single();
    if (error) {
      console.error("Error fetching property:", error);
    } else {
      setProperty(data);
      computeAIScore(data);
    }
    setLoading(false);
  }

  function computeAIScore(p: Property) {
    if (!p) return;
    const items = [
      { label: "Yield", score: Math.min(100, (p.yield_percent || 0) * 10) },
      { label: "ROI", score: Math.min(100, (p.roi_percent || 0) * 10) },
      { label: "Bedrooms", score: Math.min(100, (p.bedrooms || 0) * 20) },
      { label: "Bathrooms", score: Math.min(100, (p.bathrooms || 0) * 25) },
    ];
    setAiItems(items);
    const overall = Math.round(items.reduce((sum, i) => sum + i.score, 0) / items.length);
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

  const hasCoords = property.latitude && property.longitude;
  const postcode = property.location?.split(" ").pop();

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* LEFT — Main Content */}
      <div className="md:col-span-2 space-y-6">
        {/* Header */}
        <header className="mb-4 md:mb-6">
          <h1 className="text-[clamp(1.5rem,4vw,2.25rem)] font-extrabold leading-tight text-balance">
            {property.title}
          </h1>
          <p className="text-slate-600 mt-1">{property.location}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <CardActions
              size="sm"
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
            AI Deal Score <span className="ml-2 text-xs font-medium text-slate-500">beta</span>
          </SectionTitle>
          <AIScoreBars overall={aiOverall} items={aiItems} showHeader={false} className="mt-3" />
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
          <MortgageCalculator price={property.price} />
        </Section>

        {/* Stamp Duty */}
        <Section>
          <StampDutyCalculator price={property.price} />
        </Section>

        {/* Area Intelligence */}
        <Section>
          <AreaIntel
            locationLabel={property?.location}
            postcode={postcode}
            data={{
              avgYieldPct: property?.yield_percent,
              avgRent: property?.avg_rent,
              crimeRateIndex: property?.crime_index,
              ofstedSummary: property?.ofsted_summary,
              transportSummary: property?.transport_summary,
            }}
          />
        </Section>

        {/* Investment Insights */}
        <Section>
          <InvestmentInsights
            price={property.price}
            yield_percent={property.yield_percent}
            roi_percent={property.roi_percent}
            postcode={postcode}
            aiOverall={aiOverall}
            aiItems={aiItems}
            hideTitle   // NEW: prevents duplicate “Investment Insights” header
          />
        </Section>

        {/* Notes */}
        <Section>
          <SectionTitle icon={<span>📝</span>}>Notes</SectionTitle>
          <NotesFields propertyId={property.id} />
        </Section>
      </div>

      {/* RIGHT — Sidebar */}
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
              <Badge>Price</Badge> £{property.price.toLocaleString()}
            </li>
            <li>
              <Badge>Yield</Badge> {property.yield_percent}%
            </li>
            <li>
              <Badge>ROI</Badge> {property.roi_percent}%
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
      <AIChatbot />
    </div>
  );
}