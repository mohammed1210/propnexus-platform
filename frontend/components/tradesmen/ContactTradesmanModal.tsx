'use client';

import { useState, Fragment } from 'react';
import { FiX, FiSend } from 'react-icons/fi';
import type { Tradesman } from './TradesmanCard';

interface ContactTradesmanModalProps {
  tradesman: Tradesman | null;
  propertyId?: string;
  onClose: () => void;
  userEmail?: string;
}

export default function ContactTradesmanModal({
  tradesman,
  propertyId,
  onClose,
  userEmail = '',
}: ContactTradesmanModalProps) {
  const [email, setEmail] = useState(userEmail);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!tradesman) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !message || message.length < 10) {
      setError('Please provide a valid email and message (at least 10 characters)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Resolve backend URL using standard env var priority (consistent with lib/api.ts)
      const apiBase =
        process.env.NEXT_PUBLIC_BACKEND_URL ||
        process.env.NEXT_PUBLIC_API_BASE ||
        process.env.NEXT_PUBLIC_API_URL ||
        'https://propnexus-backend-production.up.railway.app';

      const response = await fetch(`${apiBase}/tradesmen/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tradesman_id: tradesman.id,
          property_id: propertyId || null,
          user_email: email,
          message: message,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to send contact request');
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="card max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Contact {tradesman.full_name}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 capitalize mt-1">
              {tradesman.trade_type}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {success ? (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 text-center">
            <p className="text-emerald-700 dark:text-emerald-300 font-medium">
              ✓ Message sent successfully!
            </p>
            <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
              {tradesman.full_name} will receive your message shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                Your Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                required
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label
                htmlFor="message"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                Message
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hi, I'm interested in discussing a property renovation project..."
                rows={6}
                minLength={10}
                required
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Minimum 10 characters
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <FiSend className="w-4 h-4" />
                    <span>Send Message</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
