'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Property } from '../../../types';
import supabase from '@lib/supabaseClient';
import html2pdf from 'html2pdf.js';

export default function PropertyDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id!;
  const router = useRouter();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);
  const [mortgageRate, setMortgageRate] = useState(5);
  const [depositPercent, setDepositPercent] = useState(25);
  const [termYears, setTermYears] = useState(25);

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
      console.error('Error saving deal:', error.message);
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
    if (score >= 80) return '#10b981'; // green
    if (score >= 60) return '#facc15'; // yellow
    return '#ef4444'; // red
  };

  const handleDownload = () => {
    const element = document.getElementById('deal-pack');
    if (!element) return alert('Property not loaded.');
    html2pdf().set({
      margin: 0.5,
      filename: `${property?.title?.slice(0, 50) || 'Deal'}-PropNexus.pdf`,
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
    }).from(element).save();
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

  if (!id) return <p>Invalid property ID.</p>;
  if (loading) return <p>Loading...</p>;
  if (!property) return <p>Property not found.</p>;

  const aiScore = getAIScore();
  const scoreColor = getScoreColor(aiScore);
  const mortgage = calculateMortgage();

  return (
    <div style={{
      maxWidth: '1280px',
      margin: '40px auto',
      padding: '24px',
      display: 'flex',
      flexDirection: 'row',
      gap: '32px',
    }}>
      <div style={{ flex: 2 }} id="deal-pack">
        <button onClick={() => router.back()} style={backBtnStyle}>
          ← Back to Listings
        </button>

        <img src={property.imageurl || '/placeholder.jpg'} alt={property.title} style={imgStyle} />

        <h1 style={titleStyle}>{property.title}</h1>

        <div style={{ margin: '8px 0 16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            style={{
              backgroundColor: scoreColor,
              color: '#fff',
              padding: '4px 12px',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
            }}>
            🔥 AI Score: {aiScore}/100
          </span>
          {showTooltip && (
            <div style={tooltipStyle}>
              <strong>AI Score Breakdown:</strong><br />
              ✅ Yield up to 10% × 5<br />
              ✅ ROI up to 20% × 2.5<br />
              ✅ Bonus if price &lt; £200K
            </div>
          )}
        </div>

        <p style={locationStyle}>{property.location}</p>
        <p style={priceStyle}>£{property.price.toLocaleString()}</p>
        <p style={infoStyle}>🛏 {property.bedrooms} beds • 🛁 {property.bathrooms || 0} bath</p>

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

        <h2 style={sectionTitle}>Investment Metrics</h2>
        <table style={tableStyle}>
          <tbody>
            <tr><td>Gross Yield</td><td><strong>{property.yield_percent}%</strong></td></tr>
            <tr><td>ROI</td><td><strong>{property.roi_percent}%</strong></td></tr>
            <tr><td>Property Type</td><td>{property.propertyType}</td></tr>
            <tr><td>Investment Type</td><td>{property.investmentType}</td></tr>
            <tr><td>Source</td><td>{property.source}</td></tr>
          </tbody>
        </table>

        <h2 style={sectionTitle}>Mortgage Calculator</h2>
        <div style={{ marginTop: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <label>Deposit (%): <input type="number" value={depositPercent} onChange={e => setDepositPercent(Number(e.target.value))} style={inputStyle} /></label>
          <label>Interest Rate (%): <input type="number" value={mortgageRate} onChange={e => setMortgageRate(Number(e.target.value))} style={inputStyle} /></label>
          <label>Term (years): <input type="number" value={termYears} onChange={e => setTermYears(Number(e.target.value))} style={inputStyle} /></label>
        </div>

        {mortgage && (
          <div style={{ marginTop: '14px', fontSize: '15px' }}>
            <p><strong>Loan Amount:</strong> £{Math.round(mortgage.loanAmount).toLocaleString()}</p>
            <p><strong>Monthly Payment:</strong> £{Math.round(mortgage.monthlyRepayment).toLocaleString()}</p>
            <p><strong>Total Repayment:</strong> £{Math.round(mortgage.totalRepayment).toLocaleString()}</p>
          </div>
        )}

        <h2 style={sectionTitle}>Description</h2>
        <p style={{ marginTop: '8px', fontSize: '15px', lineHeight: '1.7', color: '#334155' }}>
          {property.description || 'No description available.'}
        </p>
      </div>

      <div style={sidePanelStyle}>
        <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#1e293b' }}>Deal Summary</h3>
        <div><strong>Yield:</strong> {property.yield_percent || 0}%</div>
        <div><strong>ROI:</strong> {property.roi_percent || 0}%</div>
        <div><strong>Property Type:</strong> {property.propertyType || 'N/A'}</div>
        <div><strong>Investment Type:</strong> {property.investmentType || 'N/A'}</div>
        <div><strong>Source:</strong> {property.source || 'Unknown'}</div>

        <button onClick={handleSave} style={btnStyle}>💾 Save Deal</button>
        <button onClick={handleDownload} style={{ ...btnStyle, backgroundColor: '#3b82f6' }}>📥 Download Deal Pack</button>
        <button onClick={handleShare} style={{ ...btnStyle, backgroundColor: '#facc15', color: '#1f2937' }}>🔗 Copy Link</button>
      </div>
    </div>
  );
}

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
const imgStyle = {
  width: '100%',
  height: 'auto',
  borderRadius: '10px',
  marginBottom: '24px',
  backgroundColor: '#f1f5f9',
};
const titleStyle = { fontSize: '30px', fontWeight: '700', color: '#0f172a' };
const locationStyle = { fontSize: '18px', color: '#64748b', marginBottom: '8px' };
const priceStyle = { fontSize: '24px', fontWeight: '600', color: '#0f172a' };
const infoStyle = { marginTop: '10px', fontSize: '16px', color: '#475569' };
const sectionTitle = { marginTop: '32px', fontSize: '20px', color: '#1e293b', fontWeight: 600 };
const tableStyle = { marginTop: '10px', width: '100%', borderCollapse: 'collapse' };
const tooltipStyle = {
  position: 'absolute',
  backgroundColor: '#fff',
  color: '#0f172a',
  padding: '10px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  fontSize: '13px',
  maxWidth: '260px',
  zIndex: 10,
  marginTop: '4px',
};
const sidePanelStyle = {
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
