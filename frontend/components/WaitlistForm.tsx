'use client';

import { useState } from 'react';

type Props = {
  sourcePage?: string;
};

export default function WaitlistForm({ sourcePage }: Props) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setStatus('error');
      setMessage('Please enter your email.');
      return;
    }

    setStatus('loading');
    setMessage(null);

    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL;
      if (!base) throw new Error('NEXT_PUBLIC_BACKEND_URL is not set');

      const res = await fetch(`${base.replace(/\/$/, '')}/waitlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: trimmedEmail,
          name: name.trim() || null,
          source_page: sourcePage || 'unknown',
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Request failed (${res.status})`);
      }

      setStatus('success');
      setMessage('Thanks — you’re on the list.');
      setEmail('');
      setName('');
    } catch (err: any) {
      setStatus('error');
      setMessage(err?.message || 'Something went wrong.');
    }
  }

  const disabled = status === 'loading';

  return (
    <form onSubmit={submit} className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (optional)"
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          disabled={disabled}
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          disabled={disabled}
          required
        />
        <button
          type="submit"
          disabled={disabled}
          className="rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white px-4 py-2 text-sm font-semibold"
        >
          {status === 'loading' ? 'Joining…' : 'Get early access'}
        </button>
      </div>
      {message ? (
        <p
          className={`mt-3 text-sm ${
            status === 'success'
              ? 'text-emerald-700 dark:text-emerald-400'
              : status === 'error'
                ? 'text-red-700 dark:text-red-400'
                : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
