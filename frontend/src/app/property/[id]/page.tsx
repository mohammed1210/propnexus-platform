'use client'

// === [0] IMPORTS ===
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Property } from '@/types'
import InvestmentSummary from '@details/InvestmentSummary'
import ExitStrategyGenerator from '@details/ExitStrategyGenerator'
import MortgageCalculator from '@details/MortgageCalculator'
import StampDutyCalculator from '@details/StampDutyCalculator'
import NotesFields from '@details/NotesFields'
import AIChatbot from '@details/AIChatbot'
import dynamic from 'next/dynamic'
import html2pdf from 'html2pdf.js'
import {
  FaSave,
  FaDownload,
  FaCopy,
  FaInfoCircle,
} from 'react-icons/fa'
import MapSingle from '@details/MapSingle';

const MapView = dynamic(() => import('@/app/MapView'), { ssr: false })
const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_API_URL

// === [1] MAIN COMPONENT ===
export default function PropertyDetailsPage() {
  const params = useParams() as { id: string }
  const id = params.id

  const [property, setProperty] = useState<Property | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [strategies, setStrategies] = useState<string[]>([])
  const [showExplanation, setShowExplanation] = useState(false)

  // === [2] FETCH PROPERTY DATA ===
  useEffect(() => {
    const fetchProperty = async () => {
      const res = await fetch(`${BACKEND_BASE_URL}/api/properties/${id}`)
      const data = await res.json()
      setProperty(data)
    }
    fetchProperty()
  }, [id])

  if (!property) return <div>Loading...</div>

  // === [3] EXPORT TO PDF ===
  const handleDownloadPDF = () => {
    const element = document.getElementById('property-detail-page')
    if (element) {
      html2pdf().from(element).save('deal-pack.pdf')
    }
  }

  // === [4] COPY TO CLIPBOARD ===
  const handleCopyToCRM = () => {
    const dealInfo = JSON.stringify(property, null, 2)
    navigator.clipboard.writeText(dealInfo)
    alert('Deal copied to clipboard!')
  }

  return (
    <div
      id="property-detail-page"
      className="property-detail-page"
      style={{ padding: '2rem' }}
    >
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        {/* === LEFT COLUMN === */}
        <div style={{ flex: 2, minWidth: '60%' }}>
          {/* === [5] TITLE + IMAGE === */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <div style={{ flex: 1, minWidth: '300px' }}>
              <h1>{property.title}</h1>
              <p style={{ color: '#666' }}>{property.location}</p>
              {property.imageurl && (
                <img
                  src={property.imageurl}
                  alt={property.title}
                  style={{
                    width: '100%',
                    maxWidth: '500px',
                    height: 'auto',
                    borderRadius: '8px',
                    marginTop: '1rem',
                  }}
                />
              )}
            </div>

            {/* === [6] DEAL SUMMARY + ACTIONS === */}
            <div style={{ flex: 1, textAlign: 'right' }}>
              <h3>💼 Deal Summary</h3>
              <p>
                <strong>Price:</strong> £{property.price.toLocaleString()}
              </p>
              <p>
                <strong>Yield:</strong> {property.yield_percent}%
              </p>
              <p>
                <strong>ROI:</strong> {property.roi_percent}%
              </p>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                <button className="button-primary">
                  <FaSave /> Save Deal
                </button>
                <button className="button-secondary" onClick={handleDownloadPDF}>
                  <FaDownload /> Download Deal Pack
                </button>
                <button className="button-tertiary" onClick={handleCopyToCRM}>
                  <FaCopy /> Copy to CRM
                </button>
              </div>
            </div>
          </div>

          {/* === [7] GPT Investment Summary === */}
          <div style={{ marginTop: '2rem' }}>
            <InvestmentSummary property={property} />
          </div>

          {/* === [8] Exit Strategy Generator === */}
          <div style={{ marginTop: '2rem' }}>
            <ExitStrategyGenerator {...property} />
          </div>

          {/* === [9] AI Deal Score Breakdown === */}
          <div style={{ marginTop: '2rem' }}>
            <h3>🤖 AI Deal Score</h3>
            <p><strong>ROI Strength</strong></p>
            <p><strong>Yield Potential</strong></p>
            <button
              className="button-tertiary"
              style={{ marginTop: '0.5rem' }}
              onClick={() => setShowExplanation(!showExplanation)}
            >
              <FaInfoCircle /> What do these scores mean?
            </button>
            {showExplanation && (
              <div className="text-sm mt-2 text-gray-700 dark:text-gray-300">
                ROI and Yield scores are based on projected returns, market trends, and AI risk analysis.
              </div>
            )}
          </div>

          {/* === [10] Mortgage Calculator === */}
          <div style={{ marginTop: '2rem' }}>
            <MortgageCalculator price={property.price} />
          </div>

          {/* === [11] Stamp Duty Calculator === */}
          <div style={{ marginTop: '2rem' }}>
            <StampDutyCalculator price={property.price} />
          </div>

          {/* === [12] Area Intelligence === */}
          <div className="mt-10">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
              Area Intelligence
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Avg. rental yield: 5.2% | Crime rate: Low | Transport: Excellent | Schools: Ofsted Good
            </p>
          </div>

          {/* === [13] Notes Field === */}
          <div style={{ marginTop: '2rem' }}>
            <NotesFields propertyId={id} />
          </div>
        </div>

        {/* === [14] RIGHT COLUMN: Static Map === */}
        <div className="md:w-1/3 md:pl-6 md:sticky md:top-4 mt-8 md:mt-0">
          <MapSingle
            latitude={property.latitude}
            longitude={property.longitude}
            title={property.title}
          />
        </div>
      </div>

      {/* === [15] Floating AI Assistant === */}
      <AIChatbot property={property} />
    </div>
  )
}
