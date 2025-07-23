'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Property } from '../../../types';
import supabase from '@lib/supabaseClient';
import html2pdf from 'html2pdf.js';
import dynamic from 'next/dynamic';

const AIChatbot = dynamic(() => import('@components/AIChatbot'), { ssr: false });

export default function PropertyDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id!;
  const router = useRouter();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [mortgageRate, setMortgageRate] = useState(5);
  const [depositPercent, setDepositPercent] = useState(25);
  const [termYears, setTermYears] = useState(25);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [notes, setNotes] = useState('');
  const [customField, setCustomField] = useState('');
  const [areaStats, setAreaStats] = useState({
    avgRent: '£1,350',
    crimeRate: 'Low',
    schools: 'Good-rated primary nearby',
  });
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
@@ -35,12 +40,31 @@
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (property?.location) {
      fetchAreaIntelligence(property.location);
    }
  }, [property?.location]);

  const fetchAreaIntelligence = async (location: string) => {
    try {
      setAreaStats({
        avgRent: '£1,420',
        crimeRate: 'Moderate',
        schools: '2 Ofsted Outstanding Schools Nearby',
      });
    } catch (err) {
      console.error('Error fetching area stats:', err);
    }
  };

  const handleSave = async () => {
    const userId = 'demo-user';
    const { error } = await supabase.from('saved_deals').insert({
      user_id: userId,
      property_id: property?.id,
    });

    if (error) {
      console.error('Error saving deal:', error.message);
      alert('Failed to save deal!');
@@ -133,17 +157,20 @@

  const labelStyle = { fontSize: '14px', color: '#475569', marginTop: '8px' };

  return (
    return (
    <>
      <div style={{
        maxWidth: '1280px',
        margin: '40px auto',
        padding: '24px',
        display: 'flex',
        flexDirection: 'row',
        gap: '32px',
      }}>
      <div
        style={{
          maxWidth: '1280px',
          margin: '40px auto',
          padding: '24px',
          display: 'flex',
          flexDirection: 'row',
          gap: '32px',
        }}
      >
        <div ref={pdfRef} style={{ flex: 2 }}>
          {/* Back Button */}
          <button
            onClick={() => router.back()}
            style={{
@@ -160,6 +187,7 @@
            ← Back to Listings
          </button>

          {/* Property Image */}
          <img
            src={property.imageurl || '/placeholder.jpg'}
            alt={property.title}
@@ -172,11 +200,10 @@
            }}
          />

          <h1 style={{ fontSize: '30px', fontWeight: '700', color: '#0f172a' }}>
            {property.title}
          </h1>
          {/* Title + AI Score */}
          <h1 style={{ fontSize: '30px', fontWeight: '700', color: '#0f172a' }}>{property.title}</h1>

          {/* AI Score */}
          {/* AI Score & Tooltip */}
          <div style={{ margin: '16px 0 20px', display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
@@ -187,13 +214,29 @@
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                width: 'fit-content'
                width: 'fit-content',
              }}
              onClick={() => setShowModal(true)}
              onClick={() => setShowTooltip(!showTooltip)}
              onDoubleClick={() => setShowExplanation(true)}
            >
              🔥 AI Score: {ai.total}/100
            </span>
            {/* Animated Score Bars */}

            {showTooltip && (
              <div style={tooltipStyle}>
                <strong>AI Score Breakdown:</strong>
                <br />
                ✅ Yield up to 10% × 5
                <br />
                ✅ ROI up to 20% × 2.5
                <br />
                ✅ Bonus if price under £200k
                <br />
                💡 Double-click the score to see full explanation.
              </div>
            )}

            {/* Score Bars */}
            <div style={{ marginTop: '12px' }}>
              <div style={labelStyle}>Yield Score: {Math.round(ai.yieldScore)}</div>
              <div style={{ backgroundColor: '#e2e8f0', borderRadius: '5px', height: '10px' }}>
@@ -210,92 +253,149 @@
            </div>
          </div>

          {/* Live Area Intelligence */}
          <div style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '10px', color: '#1e293b' }}>📍 Area Intelligence</h2>
            <ul style={{ fontSize: '15px', color: '#334155', lineHeight: 1.8 }}>
              <li><strong>Average Rent:</strong> £1,250 PCM</li>
              <li><strong>Crime Level:</strong> Moderate (source: data.police.uk)</li>
              <li><strong>School Quality:</strong> 2 Ofsted Outstanding schools nearby</li>
            </ul>
          {/* Location */}
          <p style={{ fontSize: '18px', color: '#64748b', marginBottom: '8px' }}>{property.location}</p>
          <p style={{ fontSize: '24px', fontWeight: '600', color: '#0f172a' }}>
            £{property.price.toLocaleString()}
          </p>
          <p style={{ marginTop: '10px', fontSize: '16px', color: '#475569' }}>
            🛏 {property.bedrooms} beds • 🛁 {property.bathrooms || 0} bath
          </p>

          {/* Google Map */}
          {property.latitude && property.longitude && (
            <div style={{ marginTop: '24px' }}>
              <iframe
                width="100%"
                height="240"
                style={{ borderRadius: '10px' }}
                loading="lazy"
                src={`https://maps.google.com/maps?q=${property.latitude},${property.longitude}&z=15&output=embed`}
              ></iframe>
            </div>
          )}

          {/* 📍 Area Intelligence */}
          <div style={{ marginTop: '28px', padding: '18px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px' }}>📍 Area Intelligence</h2>
            <p><strong>Average Rent:</strong> {areaStats.avgRent}</p>
            <p><strong>Crime Rate:</strong> {areaStats.crimeRate}</p>
            <p><strong>Schools:</strong> {areaStats.schools}</p>
          </div>

          {/* ... Existing content continues here ... */}
          {/* 📊 Investment Metrics */}
          <h2 style={{ marginTop: '32px', fontSize: '20px', color: '#1e293b', fontWeight: 600 }}>Investment Metrics</h2>
          <table style={{ marginTop: '10px', width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr><td>Gross Yield</td><td><strong>{property.yield_percent}%</strong></td></tr>
              <tr><td>Return on Investment (ROI)</td><td><strong>{property.roi_percent}%</strong></td></tr>
              <tr><td>Property Type</td><td>{property.propertyType}</td></tr>
              <tr><td>Investment Type</td><td>{property.investmentType}</td></tr>
              <tr><td>Listing Source</td><td>{property.source}</td></tr>
            </tbody>
          </table>

          {/* 💰 Mortgage Calculator */}
          <h2 style={{ marginTop: '32px', fontSize: '20px', color: '#1e293b', fontWeight: 600 }}>Mortgage Calculator</h2>
          <div style={{ marginTop: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <label>Deposit (%): <input type="number" value={depositPercent} onChange={(e) => setDepositPercent(Number(e.target.value))} style={inputStyle} /></label>
            <label>Interest Rate (%): <input type="number" value={mortgageRate} onChange={(e) => setMortgageRate(Number(e.target.value))} style={inputStyle} /></label>
            <label>Term (years): <input type="number" value={termYears} onChange={(e) => setTermYears(Number(e.target.value))} style={inputStyle} /></label>
          </div>
          {mortgage && (
            <div style={{ marginTop: '14px', fontSize: '15px' }}>
              <p><strong>Loan Amount:</strong> £{Math.round(mortgage.loanAmount).toLocaleString()}</p>
              <p><strong>Monthly Payment:</strong> £{Math.round(mortgage.monthlyRepayment).toLocaleString()}</p>
              <p><strong>Total Repayment:</strong> £{Math.round(mortgage.totalRepayment).toLocaleString()}</p>
            </div>
          )}

          <ExitStrategyGenerator
  title={property.title}
  location={property.location}
  price={property.price}
  yield_percent={property.yield_percent}
  roi_percent={property.roi_percent}
  propertyType={property.property_type}
  investmentType={property.investment_type}
/>  

          {/* Notes */}
          <h2 style={{ marginTop: '32px', fontSize: '20px', color: '#1e293b', fontWeight: 600 }}>Custom Notes + Fields</h2>
          <textarea placeholder="Your notes about this deal..." value={notes} onChange={(e) => setNotes(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', marginTop: '8px', minHeight: '80px' }} />
          <input type="text" placeholder="Add custom field (e.g. Agent Name, Renovation Est.)" value={customField} onChange={(e) => setCustomField(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', marginTop: '8px' }} />

          {/* Description */}
          <h2 style={{ marginTop: '32px', fontSize: '20px', color: '#1e293b', fontWeight: 600 }}>Description</h2>
          <p style={{ marginTop: '8px', fontSize: '15px', lineHeight: '1.7', color: '#334155' }}>
            {property.description || 'No description available.'}
          </p>
        </div>

        {/* Right Sidebar */}
        <div style={{
          flex: 1,
          position: 'sticky',
          top: '40px',
          alignSelf: 'flex-start',
          padding: '20px',
          backgroundColor: '#f8fafc',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
        {/* Deal Summary Sidebar */}
        <div
          style={{
            flex: 1,
            position: 'sticky',
            top: '40px',
            alignSelf: 'flex-start',
            padding: '20px',
            backgroundColor: '#f8fafc',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#1e293b' }}>Deal Summary</h3>
          <div><strong>Yield:</strong> {property.yield_percent || 0}%</div>
          <div><strong>ROI:</strong> {property.roi_percent || 0}%</div>
          <div><strong>Property Type:</strong> {property.propertyType || 'N/A'}</div>
          <div><strong>Investment Type:</strong> {property.investmentType || 'N/A'}</div>
          <div><strong>Source:</strong> {property.source || 'Unknown'}</div>
          <button onClick={handleSave} style={btnStyle}>💾 Save Deal</button>
          <button onClick={handleDownload} style={{ ...btnStyle, backgroundColor: '#3b82f6' }}>
            📥 Download Deal Pack
          </button>
          <button onClick={handleShare} style={{ ...btnStyle, backgroundColor: '#facc15', color: '#1f2937' }}>
            🔗 Copy Link
          </button>
          <button onClick={handleDownload} style={{ ...btnStyle, backgroundColor: '#3b82f6' }}>📥 Download Deal Pack</button>
          <button onClick={handleShare} style={{ ...btnStyle, backgroundColor: '#facc15', color: '#1f2937' }}>🔗 Copy Link</button>
        </div>
      </div>

      {/* AI Explanation Modal */}
      {showModal && (
      {/* Chatbot + Modal */}
      <AIChatbot />
      {showExplanation && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          zIndex: 1000,
          maxWidth: '400px',
          textAlign: 'center',
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '10px',
            maxWidth: '400px',
            textAlign: 'center',
            boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
          }}>
            <h2 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 700 }}>AI Score Explanation</h2>
            <p style={{ fontSize: '15px', marginBottom: '12px' }}>AI Score = Yield × 5 + ROI × 2.5 + Bonus</p>
            <p style={{ fontSize: '14px' }}>This score helps assess profitability and affordability quickly. Properties under £200k get bonus points.</p>
            <button onClick={() => setShowModal(false)} style={{ marginTop: '16px', padding: '10px 16px', borderRadius: '8px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
              Close
            </button>
          </div>
          <h2 style={{ fontSize: '20px', marginBottom: '12px' }}>AI Score Explanation</h2>
          <p style={{ fontSize: '15px', color: '#334155' }}>
            This score reflects a weighted breakdown of investment quality based on:<br /><br />
            ✅ Yield potential<br />
            ✅ ROI projections<br />
            ✅ Property price vs affordability benchmark<br /><br />
            Use it as a signal — not the sole decision factor!
          </p>
          <button
            onClick={() => setShowExplanation(false)}
            style={{ marginTop: '20px', padding: '10px 18px', borderRadius: '8px', backgroundColor: '#14b8a6', color: 'white', border: 'none', cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      )}

      <AIChatbot />
    </>
  );
}

const btnStyle: React.CSSProperties = {
  marginTop: '8px',
  backgroundColor: '#14b8a6',
  color: 'white',
  padding: '12px 20px',
  border: 'none',
  borderRadius: '8px',
  fontWeight: 600,
  cursor: 'pointer',
  width: '100%',
  fontSize: '15px',
