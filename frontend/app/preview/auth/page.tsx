'use client';

import Link from 'next/link';
import { FiMail, FiZap, FiShield, FiClock } from 'react-icons/fi';
import { useState } from 'react';

export default function AuthPreview() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-brand-xl bg-gradient-to-br from-brand-500 to-cyan-500 items-center justify-center mb-4 shadow-brand-lg">
            <span className="text-white font-bold text-2xl">PN</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome to PropNexus</h1>
          <p className="text-slate-600">Sign in to access your property dashboard</p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-brand-xl border border-slate-200 shadow-brand-xl p-8">
          {!submitted ? (
            <>
              {/* Magic Link Form */}
              <form onSubmit={handleSubmit}>
                <div className="mb-6">
                  <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                      className="w-full h-11 pl-12 pr-4 rounded-brand border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition-all duration-brand"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full h-12 rounded-brand bg-gradient-to-r from-brand-500 to-brand-600 text-white font-bold hover:from-brand-600 hover:to-brand-700 shadow-brand hover:shadow-brand-md transition-all duration-brand focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 flex items-center justify-center gap-2"
                >
                  <FiZap className="w-5 h-5" />
                  Send Magic Link
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-white text-slate-500">Or continue with</span>
                </div>
              </div>

              {/* Social Login Buttons */}
              <div className="space-y-3">
                <button className="w-full h-11 rounded-brand border border-slate-300 bg-white hover:bg-slate-50 font-semibold text-slate-700 transition-all duration-brand flex items-center justify-center gap-3">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>

                <button className="w-full h-11 rounded-brand border border-slate-300 bg-white hover:bg-slate-50 font-semibold text-slate-700 transition-all duration-brand flex items-center justify-center gap-3">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  Continue with GitHub
                </button>
              </div>

              {/* Info Text */}
              <p className="mt-6 text-sm text-slate-500 text-center">
                By continuing, you agree to our{' '}
                <a href="#" className="text-brand-600 hover:text-brand-700 font-medium">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#" className="text-brand-600 hover:text-brand-700 font-medium">
                  Privacy Policy
                </a>
              </p>
            </>
          ) : (
            /* Success State */
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mx-auto mb-6">
                <FiMail className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-3">Check Your Email</h2>
              <p className="text-slate-600 mb-6 leading-relaxed">
                We&apos;ve sent a magic link to <strong>{email}</strong>. Click the link to sign in instantly.
              </p>
              <div className="bg-brand-50 border border-brand-200 rounded-brand-lg p-4 text-sm text-slate-700">
                <p className="font-semibold mb-2">Didn&apos;t receive the email?</p>
                <ul className="space-y-1 text-left">
                  <li>• Check your spam folder</li>
                  <li>• Make sure the email address is correct</li>
                  <li>• Wait a few minutes and try again</li>
                </ul>
              </div>
              <button
                onClick={() => setSubmitted(false)}
                className="mt-6 text-brand-600 hover:text-brand-700 font-semibold transition-colors duration-brand"
              >
                Try a different email
              </button>
            </div>
          )}
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="w-10 h-10 rounded-brand bg-white border border-slate-200 flex items-center justify-center mx-auto mb-2">
              <FiShield className="w-5 h-5 text-brand-600" />
            </div>
            <p className="text-xs text-slate-600 font-medium">Secure</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 rounded-brand bg-white border border-slate-200 flex items-center justify-center mx-auto mb-2">
              <FiZap className="w-5 h-5 text-brand-600" />
            </div>
            <p className="text-xs text-slate-600 font-medium">Instant</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 rounded-brand bg-white border border-slate-200 flex items-center justify-center mx-auto mb-2">
              <FiClock className="w-5 h-5 text-brand-600" />
            </div>
            <p className="text-xs text-slate-600 font-medium">No password</p>
          </div>
        </div>

        {/* Back Link */}
        <div className="mt-8 text-center">
          <Link
            href="/preview"
            className="inline-flex items-center gap-2 text-brand-600 hover:text-brand-700 font-semibold transition-colors duration-brand"
          >
            ← Back to Preview Hub
          </Link>
        </div>
      </div>
    </div>
  );
}
