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
    return {
      total: Math.min(Math.round(yieldScore + roiScore + bonus), 100),
      yieldScore,
      roiScore,
      bonus,
    };
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

  if (!id) return <p>Invalid property ID.</p>;
  if (loading) return <p>Loading...</p>;
  if (!property) return <p>Property not found.</p>;

  const ai = getAIScore();
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

  const inputStyle: React.CSSProperties = {
    marginLeft: '8px',
    marginRight: '16px',
    padding: '6px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    width: '80px',
  };

  const barStyle = (score: number, color: string): React.CSSProperties => ({
    width: `${Math.min(score, 100)}%`,
    height: '10px',
    backgroundColor: color,
    borderRadius: '5px',
    transition: 'width 0.5s ease-in-out',
  });

  const labelStyle = { fontSize: '14px', color: '#475569', marginTop: '8px' };

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
          <button
            onClick={() => router.back()}
            style={{
              marginBottom: '20px',
              backgroundColor: '#e2e8f0',
              border: 'none',
              padding: '10px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              color: '#1e293b',
              fontWeight: '500',
            }}
          >
            ← Back to Listings
          </button>

          <img
            src={property.imageurl || '/placeholder.jpg'}
            alt={property.title}
            style={{
              width: '100%',
              height: 'auto',
              borderRadius: '10px',
              marginBottom: '24px',
              backgroundColor: '#f1f5f9',
            }}
          />

          <h1 style={{ fontSize: '30px', fontWeight: '700', color: '#0f172a' }}>
            {property.title}
          </h1>

          {/* AI Score */}
          <div style={{ margin: '16px 0 20px', display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                backgroundColor: getScoreColor(ai.total),
                color: '#fff',
                padding: '4px 12px',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                width: 'fit-content'
              }}
              onClick={() => setShowModal(true)}
            >
              🔥 AI Score: {ai.total}/100
            </span>
            {/* Animated Score Bars */}
            <div style={{ marginTop: '12px' }}>
              <div style={labelStyle}>Yield Score: {Math.round(ai.yieldScore)}</div>
              <div style={{ backgroundColor: '#e2e8f0', borderRadius: '5px', height: '10px' }}>
                <div style={barStyle(ai.yieldScore, '#3b82f6')} />
              </div>
              <div style={labelStyle}>ROI Score: {Math.round(ai.roiScore)}</div>
              <div style={{ backgroundColor: '#e2e8f0', borderRadius: '5px', height: '10px' }}>
                <div style={barStyle(ai.roiScore, '#6366f1')} />
              </div>
              <div style={labelStyle}>Bonus Score: {Math.round(ai.bonus)}</div>
              <div style={{ backgroundColor: '#e2e8f0', borderRadius: '5px', height: '10px' }}>
                <div style={barStyle(ai.bonus, '#10b981')} />
              </div>
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
          </div>

          {/* ... Existing content continues here ... */}
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
        </div>
      </div>

      {/* AI Explanation Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
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
};