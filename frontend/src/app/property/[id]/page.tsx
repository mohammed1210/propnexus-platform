"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import supabase from "@/lib/supabase";
import dynamic from "next/dynamic";
import html2pdf from "html2pdf.js";
import styles from "./page.module.css";

const AIChatbot = dynamic(() => import("@/components/AIChatbot"), { ssr: false });

export default function PropertyDetailsPage() {
  const { id } = useParams();
  const [property, setProperty] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [customField, setCustomField] = useState("");
  const [customFields, setCustomFields] = useState<string[]>([]);
  const [deposit, setDeposit] = useState(25);
  const [interestRate, setInterestRate] = useState(5);
  const [term, setTerm] = useState(25);
  const [aiSummary, setAiSummary] = useState("Loading investment summary...");
  const [exitPlan, setExitPlan] = useState("Loading exit strategy...");

  useEffect(() => {
    fetch(`/api/properties/${id}`)
      .then(res => res.json())
      .then(data => setProperty(data));
  }, [id]);

  useEffect(() => {
    if (property) {
      fetch("/api/gpt-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property }),
      })
        .then(res => res.json())
        .then(data => setAiSummary(data.summary || "No summary found."));

      fetch("/api/exit-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property }),
      })
        .then(res => res.json())
        .then(data => setExitPlan(data.strategy || "No strategy found."));
    }
  }, [property]);

  const saveNotes = async () => {
    await supabase.from("notes").upsert({ property_id: id, notes });
  };

  const handleDownload = () => {
    const element = document.getElementById("deal-pack");
    html2pdf().from(element).save(`${property?.title || "property"}.pdf`);
  };

  const loanAmount = property ? property.price * (1 - deposit / 100) : 0;
  const monthlyRate = interestRate / 100 / 12;
  const payments = term * 12;
  const monthlyPayment = loanAmount
    ? (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -payments))
    : 0;
  const totalRepayment = monthlyPayment * payments;

  const stampDuty = (price: number) => {
    if (price <= 250000) return 0;
    if (price <= 925000) return (price - 250000) * 0.05;
    return 33750 + (price - 925000) * 0.1;
  };

  if (!property) return <div>Loading...</div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button onClick={() => window.history.back()}>&larr; Back to Listings</button>
      </div>

      <div className={styles.detailsContainer} id="deal-pack">
        <div className={styles.leftColumn}>
          <img
            src={property.imageurl || "/placeholder.jpg"}
            alt={property.title}
            className={styles.image}
          />
          <h1>{property.title}</h1>
          <p>{property.location}</p>
          <p>£{property.price.toLocaleString()}</p>
          <p>
            🛏 {property.bedrooms} beds • 🛁 {property.bathrooms} baths
          </p>

          {/* GPT Investment Summary Generator */}
          <section className={styles.section}>
            <h2>🧠 GPT Investment Summary</h2>
            <p>{aiSummary}</p>
          </section>

          {/* Exit Strategy Generator */}
          <section className={styles.section}>
            <h2>🚪 Suggested Exit Strategy</h2>
            <p>{exitPlan}</p>
          </section>

          {/* Google Map */}
          {property.latitude && property.longitude && (
            <iframe
              width="100%"
              height="200"
              style={{ border: 0, marginTop: "1rem" }}
              loading="lazy"
              src={`https://www.google.com/maps?q=${property.latitude},${property.longitude}&output=embed`}
            ></iframe>
          )}

          {/* Area Intelligence */}
          <section className={styles.section}>
            <h2>📍 Area Intelligence</h2>
            <p>Average Rent: £{property.avg_rent || "N/A"}</p>
            <p>Crime Rate: {property.crime_rate || "Unknown"}</p>
            <p>Schools: {property.ofsted_schools || "N/A"}</p>
          </section>

          {/* Description */}
          <section className={styles.section}>
            <h2>Description</h2>
            <p>{property.description}</p>
          </section>
        </div>

        <div className={styles.rightColumn}>
          {/* Deal Summary */}
          <section className={styles.card}>
            <h2>Deal Summary</h2>
            <p>Yield: {property.yield_percent}%</p>
            <p>ROI: {property.roi_percent}%</p>
            <p>Property Type: {property.type}</p>
            <p>Investment Type: {property.investment_type}</p>
            <p>Source: {property.listing_source}</p>
            <button onClick={handleDownload}>📄 Download Deal Pack</button>
          </section>

          {/* AI Score Breakdown */}
          <section className={styles.card}>
            <h2>🔥 AI Score: {property.ai_score || "N/A"}</h2>
            <p>Yield Score: {property.yield_score || 0}</p>
            <p>ROI Score: {property.roi_score || 0}</p>
            <p>Bonus Score: {property.bonus_score || 0}</p>
          </section>

          {/* Investment Metrics */}
          <section className={styles.card}>
            <h2>📊 Investment Metrics</h2>
            <p>Gross Yield: {property.yield_percent}%</p>
            <p>Return on Investment (ROI): {property.roi_percent}%</p>
            <p>Property Type: {property.type}</p>
            <p>Investment Type: {property.investment_type}</p>
            <p>Listing Source: {property.listing_source}</p>
          </section>

          {/* Mortgage Calculator */}
          <section className={styles.card}>
            <h2>🏦 Mortgage Calculator</h2>
            <label>Deposit (%):
              <input type="number" value={deposit} onChange={e => setDeposit(Number(e.target.value))} />
            </label>
            <label>Interest Rate (%):
              <input type="number" value={interestRate} onChange={e => setInterestRate(Number(e.target.value))} />
            </label>
            <label>Term (years):
              <input type="number" value={term} onChange={e => setTerm(Number(e.target.value))} />
            </label>
            <p>Loan Amount: £{loanAmount.toLocaleString()}</p>
            <p>Monthly Payment: £{monthlyPayment.toFixed(0)}</p>
            <p>Total Repayment: £{totalRepayment.toFixed(0)}</p>
          </section>

          {/* Stamp Duty */}
          <section className={styles.card}>
            <h2>💰 Stamp Duty</h2>
            <p>Stamp Duty on £{property.price.toLocaleString()}: £{stampDuty(property.price).toLocaleString()}</p>
          </section>

          {/* Custom Notes + Fields */}
          <section className={styles.card}>
            <h2>📝 Custom Notes + Fields</h2>
            <textarea
              placeholder="Your notes about this deal..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
            />
            <button onClick={saveNotes}>💾 Save Notes</button>
            <input
              type="text"
              placeholder="Add custom field (e.g. Agent Name)"
              value={customField}
              onChange={e => setCustomField(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  setCustomFields([...customFields, customField]);
                  setCustomField("");
                }
              }}
            />
            <ul>
              {customFields.map((field, i) => (
                <li key={i}>{field}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <AIChatbot />
    </div>
  );
}
