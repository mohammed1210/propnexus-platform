'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Property } from '../../../types';
import supabase from '@lib/supabaseClient';
import html2pdf from 'html2pdf.js';
import AIChatbot from '@components/AIChatbot';

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
  const [notes, setNotes] = useState('');
  const [customField, setCustomField] = useState('');
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`https://propnexus-backend-production.up.railway.app/properties/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setProperty(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    const userId = 'demo-user';
    const { error } = await supabase.from('saved_deals').insert({
      user_id: userId,
      property_id: property?.id,
    });
    if (error) {
      alert('Failed to save deal!');
    } else {
      alert('Deal saved!');
    }
  };

  const getAIScore = () => {
    const yieldScore = Math.min(property?.yield_percent || 0, 10) * 5;
    const roiScore = Math.min(property?.roi_percent || 0, 20) * 2.5;
    const bonus = (property?.price || 0) < 200000 ? 5 : 0;
    return Math.min(Math.round(yieldScore + roiScore + bonus), 100);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#facc15';
    return '#ef4444';
  };

  const handleDownload = () => {
    if (pdfRef.current) {
      html2pdf().from(pdfRef.current).save('deal-pack.pdf');
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('🔗 Link copied to clipboard!');
  };

  const calculateMortgage = () => {
    if (!property) return null;
    const price = property.price;
    const deposit = price * (depositPercent / 100);
    const loanAmount = price - deposit;
    const monthlyRate = mortgageRate / 100 / 12;
    const numPayments = termYears * 12;
    const monthlyRepayment = (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -numPayments));
    return {
      deposit,
      loanAmount,
      monthlyRepayment,
      totalRepayment: monthlyRepayment * numPayments,
    };
  };

  const aiScore = getAIScore();
  const scoreColor = getScoreColor(aiScore);
  const mortgage = calculateMortgage();

  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    backgroundColor: 'white',
    color: '#1e293b',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    maxWidth: '240px',
    zIndex: 10,
    marginTop: '4px',
  };

  if (!id) return <p>Invalid property ID.</p>;
  if (loading) return <p>Loading...</p>;
  if (!property) return <p>Property not found.</p>;

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
        <div ref={pdfRef} style={{ flex: 2 }}>
          <button onClick={() => router.back()} style={backBtnStyle}>← Back to Listings</button>

          <img src={property.imageurl || '/placeholder.jpg'} alt={property.title} style={imgStyle} />

          <h1 style={headingStyle}>{property.title}</h1>

          <div style={{ margin: '8px 0 16px', display: 'flex', gap: '12px', alignItems: 'center', position: 'relative' }}>
            <span
              style={{
                backgroundColor: scoreColor,
                color: '#fff',
                padding: '4px 12px',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer'
              }}
              onClick={() => setShowTooltip(!showTooltip)}
            >
              🔥 AI Score: {aiScore}/100
            </span>
            {showTooltip && (
              <div style={tooltipStyle}>
                <strong>AI Score Breakdown:</strong><br />
                ✅ Yield up to 10% × 5<br />
                ✅ ROI up to 20% × 2.5<br />
                ✅ Bonus if price under £200k
              </div>
            )}
          </div>

          <p style={{ fontSize: '18px', color: '#64748b' }}>{property.location}</p>
          <p style={{ fontSize: '24px', fontWeight: 600 }}>£{property.price.toLocaleString()}</p>
          <p style={{ fontSize: '16px', marginTop: '10px' }}>
            🛏 {property.bedrooms} beds • 🛁 {property.bathrooms || 0} bath
          </p>

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

          <Section title="Investment Metrics">
            <table style={{ width: '100%' }}>
              <tbody>
                <tr><td>Gross Yield</td><td><strong>{property.yield_percent}%</strong></td></tr>
                <tr><td>ROI</td><td><strong>{property.roi_percent}%</strong></td></tr>
                <tr><td>Property Type</td><td>{property.propertyType}</td></tr>
                <tr><td>Investment Type</td><td>{property.investmentType}</td></tr>
                <tr><td>Listing Source</td><td>{property.source}</td></tr>
              </tbody>
            </table>
          </Section>

          <Section title="Mortgage Calculator">
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <label>Deposit (%): <input type="number" value={depositPercent} onChange={e => setDepositPercent(+e.target.value)} style={inputStyle} /></label>
              <label>Interest Rate (%): <input type="number" value={mortgageRate} onChange={e => setMortgageRate(+e.target.value)} style={inputStyle} /></label>
              <label>Term (years): <input type="number" value={termYears} onChange={e => setTermYears(+e.target.value)} style={inputStyle} /></label>
            </div>
            {mortgage && (
              <div style={{ fontSize: '15px', marginTop: '10px' }}>
                <p><strong>Loan:</strong> £{Math.round(mortgage.loanAmount).toLocaleString()}</p>
                <p><strong>Monthly:</strong> £{Math.round(mortgage.monthlyRepayment).toLocaleString()}</p>
                <p><strong>Total:</strong> £{Math.round(mortgage.totalRepayment).toLocaleString()}</p>
              </div>
            )}
          </Section>

          <Section title="Custom Notes + Fields">
            <textarea placeholder="Notes..." value={notes} onChange={e => setNotes(e.target.value)} style={textareaStyle} />
            <input placeholder="e.g. Agent Name" value={customField} onChange={e => setCustomField(e.target.value)} style={inputBoxStyle} />
          </Section>

          <Section title="Description">
            <p style={{ fontSize: '15px', lineHeight: '1.6' }}>{property.description || 'No description available.'}</p>
          </Section>
        </div>

        <div style={sidebarStyle}>
          <h3 style={{ fontSize: '20px', fontWeight: 600 }}>Deal Summary</h3>
          <div><strong>Yield:</strong> {property.yield_percent}%</div>
          <div><strong>ROI:</strong> {property.roi_percent}%</div>
          <div><strong>Type:</strong> {property.propertyType}</div>
          <div><strong>Investment:</strong> {property.investmentType}</div>
          <div><strong>Source:</strong> {property.source}</div>
          <button onClick={handleSave} style={btnStyle}>💾 Save Deal</button>
          <button onClick={handleDownload} style={{ ...btnStyle, backgroundColor: '#3b82f6' }}>📥 Download Deal Pack</button>
          <button onClick={handleShare} style={{ ...btnStyle, backgroundColor: '#facc15', color: '#1f2937' }}>🔗 Copy Link</button>
        </div>
      </div>

      <AIChatbot />
    </>
  );
}

// === Reusable Subcomponents and Styles ===

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ marginTop: '32px' }}>
    <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#1e293b' }}>{title}</h2>
    <div style={{ marginTop: '10px' }}>{children}</div>
  </div>
);

const btnStyle = {
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
};

const inputStyle = {
  marginLeft: '8px',
  marginRight: '16px',
  padding: '6px',
  borderRadius: '6px',
  border: '1px solid #d1d5db',
  width: '80px',
};

const inputBoxStyle = {
  width: '100%',
  padding: '10px',
  borderRadius: '8px',
  border: '1px solid #ccc',
  marginTop: '8px',
};

const textareaStyle = {
  width: '100%',
  padding: '10px',
  borderRadius: '8px',
  border: '1px solid #ccc',
  marginTop: '8px',
  minHeight: '80px',
};

const backBtnStyle = {
  marginBottom: '20px',
  backgroundColor: '#e2e8f0',
  border: 'none',
  padding: '10px 16px',
  borderRadius: '8px',
  cursor: 'pointer',
  color: '#1e293b',
  fontWeight: '500',
};

const headingStyle = {
  fontSize: '30px',
  fontWeight: '700',
  color: '#0f172a',
};

const imgStyle = {
  width: '100%',
  height: 'auto',
  borderRadius: '10px',
  marginBottom: '24px',
  backgroundColor: '#f1f5f9',
};

const sidebarStyle = {
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
};
