'use client';
import { useState } from 'react';

export default function Integrations() {
  const [url, setUrl] = useState('');
  return (
    <div className="space-y-3 rounded-md border p-4">
      <h3 className="text-sm font-semibold">CRM / Zapier Webhook</h3>
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        When enabled, saved deals will POST to this URL (JSON body).
      </p>
      <div className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://hooks.zapier.com/..."
          className="w-full rounded-md border px-3 py-2"
        />
        <button className="rounded-md border px-3 py-2 text-sm">Save</button>
      </div>
    </div>
  );
}
