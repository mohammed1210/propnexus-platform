'use client';

import Link from 'next/link';
import { FiHome, FiDroplet, FiMaximize2, FiMapPin, FiHeart, FiShare2, FiPhone, FiMail, FiCalendar, FiMap } from 'react-icons/fi';
import { useState } from 'react';

export default function DetailsPreview() {
  const [loanAmount, setLoanAmount] = useState(350000);
  const [interestRate, setInterestRate] = useState(4.5);
  const [years, setYears] = useState(25);

  const monthlyPayment = (loanAmount * (interestRate / 100 / 12) * Math.pow(1 + interestRate / 100 / 12, years * 12)) / (Math.pow(1 + interestRate / 100 / 12, years * 12) - 1);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link
            href="/preview/listings"
            className="inline-flex items-center gap-2 text-brand-600 hover:text-brand-700 font-semibold mb-4 transition-colors duration-brand"
          >
            ← Back to Listings
          </Link>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Gallery Placeholder */}
            <div className="bg-white rounded-brand-xl border border-slate-200 overflow-hidden">
              <div className="aspect-[16/9] bg-gradient-to-br from-brand-400 via-cyan-500 to-teal-500 flex items-center justify-center relative">
                <span className="text-white/70 text-lg font-medium">Property Image Gallery</span>
                <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-brand bg-white/90 backdrop-blur-sm text-sm font-semibold text-slate-900">
                  1 / 12
                </div>
              </div>
            </div>

            {/* Property Summary Card */}
            <div className="bg-white rounded-brand-xl border border-slate-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 mb-2">
                    Modern 2 Bed Apartment in Canary Wharf
                  </h1>
                  <p className="flex items-center gap-2 text-slate-600">
                    <FiMapPin className="w-5 h-5" />
                    Canary Wharf, London E14
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="w-10 h-10 rounded-brand border border-slate-300 flex items-center justify-center hover:bg-slate-50 transition-colors" aria-label="Save">
                    <FiHeart className="w-5 h-5 text-slate-600" />
                  </button>
                  <button className="w-10 h-10 rounded-brand border border-slate-300 flex items-center justify-center hover:bg-slate-50 transition-colors" aria-label="Share">
                    <FiShare2 className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
              </div>

              <div className="flex items-end justify-between pt-4 border-t border-slate-200">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2 text-slate-600">
                    <FiHome className="w-5 h-5" />
                    <span className="font-semibold">2 beds</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <FiDroplet className="w-5 h-5" />
                    <span className="font-semibold">2 baths</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <FiMaximize2 className="w-5 h-5" />
                    <span className="font-semibold">850 sqft</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-slate-900">£485,000</div>
                  <div className="text-sm text-emerald-600 font-semibold">5.2% yield</div>
                </div>
              </div>
            </div>

            {/* Description Card */}
            <div className="bg-white rounded-brand-xl border border-slate-200 p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Property Description</h2>
              <div className="text-slate-600 space-y-3 leading-relaxed">
                <p>
                  A stunning two-bedroom apartment located in the heart of Canary Wharf, one of London&apos;s most prestigious business districts. This modern residence offers the perfect blend of luxury and convenience.
                </p>
                <p>
                  The property features an open-plan living and dining area with floor-to-ceiling windows, offering breathtaking views of the Thames and city skyline. The contemporary kitchen is fully equipped with high-end appliances.
                </p>
                <p>
                  Both bedrooms are generously sized with built-in wardrobes. The master bedroom benefits from an en-suite bathroom, while a separate family bathroom serves the second bedroom.
                </p>
                <p>
                  Residents enjoy access to a 24-hour concierge service, secure underground parking, and excellent transport links including the nearby Canary Wharf tube station.
                </p>
              </div>
            </div>

            {/* Mortgage Calculator Card */}
            <div className="bg-white rounded-brand-xl border border-slate-200 p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Mortgage Calculator</h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Loan Amount: £{loanAmount.toLocaleString()}
                  </label>
                  <input
                    type="range"
                    min="50000"
                    max="500000"
                    step="10000"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-brand appearance-none cursor-pointer accent-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Interest Rate: {interestRate}%
                  </label>
                  <input
                    type="range"
                    min="2"
                    max="8"
                    step="0.1"
                    value={interestRate}
                    onChange={(e) => setInterestRate(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-brand appearance-none cursor-pointer accent-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Term: {years} years
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="35"
                    step="1"
                    value={years}
                    onChange={(e) => setYears(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-brand appearance-none cursor-pointer accent-brand-500"
                  />
                </div>

                <div className="pt-6 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Estimated Monthly Payment</span>
                    <span className="text-3xl font-bold text-brand-600">
                      £{Math.round(monthlyPayment).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* SDLT Calculator Card */}
            <div className="bg-white rounded-brand-xl border border-slate-200 p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Stamp Duty Land Tax (SDLT)</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-slate-200">
                  <span className="text-slate-600">Property Price</span>
                  <span className="font-semibold text-slate-900">£485,000</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-slate-200">
                  <span className="text-slate-600">SDLT (Standard Rate)</span>
                  <span className="font-semibold text-slate-900">£14,250</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-slate-600 font-semibold">Total Cost</span>
                  <span className="text-2xl font-bold text-slate-900">£499,250</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Sticky Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              {/* Quick Stats Card */}
              <div className="bg-white rounded-brand-xl border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Quick Stats</h3>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-slate-600 mb-1">Property Type</div>
                    <div className="font-semibold text-slate-900">Apartment</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-600 mb-1">Tenure</div>
                    <div className="font-semibold text-slate-900">Leasehold</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-600 mb-1">Council Tax Band</div>
                    <div className="font-semibold text-slate-900">Band D</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-600 mb-1">EPC Rating</div>
                    <div className="inline-flex items-center gap-2">
                      <span className="font-semibold text-slate-900">B</span>
                      <div className="flex-1 h-2 bg-slate-200 rounded-full">
                        <div className="h-2 bg-emerald-500 rounded-full" style={{ width: '80%' }} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-600 mb-1">Year Built</div>
                    <div className="font-semibold text-slate-900">2019</div>
                  </div>
                </div>
              </div>

              {/* Quick Actions Card */}
              <div className="bg-white rounded-brand-xl border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <button className="w-full h-11 px-4 rounded-brand bg-gradient-to-r from-brand-500 to-brand-600 text-white font-semibold hover:from-brand-600 hover:to-brand-700 shadow-brand hover:shadow-brand-md transition-all duration-brand flex items-center justify-center gap-2">
                    <FiPhone className="w-4 h-4" />
                    Call Agent
                  </button>
                  <button className="w-full h-11 px-4 rounded-brand border-2 border-brand-500 text-brand-600 font-semibold hover:bg-brand-50 transition-all duration-brand flex items-center justify-center gap-2">
                    <FiMail className="w-4 h-4" />
                    Email Enquiry
                  </button>
                  <button className="w-full h-11 px-4 rounded-brand border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-all duration-brand flex items-center justify-center gap-2">
                    <FiCalendar className="w-4 h-4" />
                    Book Viewing
                  </button>
                </div>
              </div>

              {/* Map Card */}
              <div className="bg-white rounded-brand-xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200">
                  <h3 className="text-lg font-bold text-slate-900">Location</h3>
                </div>
                <div className="aspect-square bg-gradient-to-br from-brand-100 to-cyan-100 flex items-center justify-center relative">
                  <FiMap className="w-12 h-12 text-brand-400" />
                  <span className="absolute bottom-4 text-sm text-slate-600">Map placeholder</span>
                </div>
                <div className="p-4">
                  <p className="text-sm text-slate-600">
                    <FiMapPin className="inline w-4 h-4 mr-1" />
                    Canary Wharf, London E14
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Back Link */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Link
          href="/preview"
          className="inline-flex items-center gap-2 text-brand-600 hover:text-brand-700 font-semibold transition-colors duration-brand"
        >
          ← Back to Preview Hub
        </Link>
      </div>
    </div>
  );
}
