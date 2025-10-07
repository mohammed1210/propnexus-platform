'use client';
import { useState } from 'react';

export default function CopyJsonButton({ payload }: { payload: any }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <button onClick={onCopy} className="rounded-md border px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
      {copied ? 'Copied!' : 'Copy JSON'}
    </button>
  );
}
