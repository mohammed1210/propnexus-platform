'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function MagicLoginPage() {
  const supabase = createClientComponentClient();
  const [email, setEmail] = useState('');

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
    });
    if (error) alert(error.message);
    else alert('Check your inbox for a magic link');
  }

  return (
    <main className="max-w-md mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold mb-4">Magic Link Login</h1>
      <form onSubmit={sendLink} className="space-y-3">
        <input
          type="email"
          required
          placeholder="you@example.com"
          className="w-full border rounded px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="px-4 py-2 rounded bg-black text-white">Send Link</button>
      </form>
    </main>
  );
}
