'use client';

import React, { useEffect, useState } from 'react';

type Props = { propertyId: string };

const QUICK_TAGS = ['#Refurb', '#Risks', '#Offer', '#FollowUp', '#Comps'];

const VIEWING_TEMPLATE = `- [ ] Exterior photos
- [ ] Roof / gutters
- [ ] Damp / mould check
- [ ] Electrics (EICR?)
- [ ] Boiler age & service
- [ ] Windows & glazing
- [ ] Room measurements
- [ ] Neighbours / noise`;

const RISKS_TEMPLATE = `**Risks**
- Planning:
- Structural:
- Damp:
- Market/exit:

**Mitigations**
- 
- 
- `;

const OFFER_TEMPLATE = `**Assumptions**
- Purchase: £
- Works: £
- Fees (legals/SDLT/etc): £
- Contingency: %
- Target rent: £/m
- Target yield on cost: %

**Exit**
- Strategy:
- ARV: £
- Target equity: £`;

const timeNow = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function NotesFields({ propertyId }: Props) {
  const [title, setTitle] = useState('');
  const [importance, setImportance] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [pinned, setPinned] = useState(false);
  const [notes, setNotes] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [showTools, setShowTools] = useState(true);
  const maxChars = 2000;

  // Load
  useEffect(() => {
    const get = (k: string) => localStorage.getItem(k) ?? '';
    setTitle(get(`title-${propertyId}`));
    setImportance(((get(`importance-${propertyId}`) as any) || 'Medium') as 'Low' | 'Medium' | 'High');
    setPinned(get(`pinned-${propertyId}`) === '1');
    setNotes(get(`notes-${propertyId}`));
  }, [propertyId]);

  // Save (debounced)
  useEffect(() => {
    const id = setTimeout(() => {
      localStorage.setItem(`title-${propertyId}`, title);
      localStorage.setItem(`importance-${propertyId}`, importance);
      localStorage.setItem(`pinned-${propertyId}`, pinned ? '1' : '0');
      localStorage.setItem(`notes-${propertyId}`, notes);
      setSaveMsg(`Saved ${timeNow()}`);
    }, 300);
    return () => clearTimeout(id);
  }, [title, importance, pinned, notes, propertyId]);

  const addSnippet = (snippet: string) =>
    setNotes((prev) => (prev ? `${prev}\n\n${snippet}` : snippet));

  const handleCopy = async () => {
    await navigator.clipboard.writeText(
      [
        pinned ? '📌 Pinned' : '',
        `Title: ${title}`,
        `Importance: ${importance}`,
        '',
        notes,
      ]
        .filter(Boolean)
        .join('\n')
    );
    setSaveMsg('Copied to clipboard');
    setTimeout(() => setSaveMsg(`Saved ${timeNow()}`), 1200);
  };

  const handleDownload = () => {
    const blob = new Blob(
      [
        `Title: ${title}\nImportance: ${importance}\nPinned: ${pinned ? 'Yes' : 'No'}\n\n${notes}`,
      ],
      { type: 'text/plain' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notes-${propertyId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    if (!confirm('Clear all notes for this property?')) return;
    setTitle('');
    setImportance('Medium');
    setPinned(false);
    setNotes('');
    localStorage.removeItem(`title-${propertyId}`);
    localStorage.removeItem(`importance-${propertyId}`);
    localStorage.removeItem(`pinned-${propertyId}`);
    localStorage.removeItem(`notes-${propertyId}`);
    setSaveMsg('Cleared');
  };

  return (
    <div className="w-full">
      {/* Header (keep light; the outer card comes from the page) */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold">📝 Investor Notes</h3>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>{saveMsg}</span>
          <button
            className="underline"
            onClick={() => setShowTools((s) => !s)}
            aria-expanded={showTools}
          >
            {showTools ? 'Hide tools' : 'Show tools'}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title / custom field"
          className="w-full rounded px-3 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700"
        />
        <select
          className="w-full rounded px-3 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700"
          value={importance}
          onChange={(e) => setImportance(e.target.value as 'Low' | 'Medium' | 'High')}
        >
          <option>Low</option>
          <option>Medium</option>
          <option>High</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={pinned}
            onChange={(e) => setPinned(e.target.checked)}
          />
          Pin to top
        </label>
      </div>

      {/* Quick tags */}
      {showTools && (
        <div className="flex flex-wrap gap-2 mb-2">
          {QUICK_TAGS.map((t) => (
            <button
              key={t}
              className="px-2 py-1 bg-gray-100 dark:bg-neutral-700 rounded text-xs"
              onClick={() => addSnippet(t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Notes area – full width */}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={12}
        maxLength={maxChars}
        className="w-full rounded px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 font-mono text-sm min-h-[280px]"
        placeholder="Add your thoughts or deal analysis…  (supports **bold**, *italics*, - bullets, - [ ] checkboxes)"
      />

      <div className="text-xs text-right text-slate-500 mt-1">
        {notes.length}/{maxChars} chars — Autosaves locally
      </div>

      {/* Actions */}
      {showTools && (
        <div className="flex flex-wrap gap-2 mt-2">
          <button onClick={handleCopy} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded">Copy</button>
          <button onClick={handleDownload} className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded">Download</button>
          <button onClick={handleClear} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded">Clear</button>

          <button onClick={() => addSnippet(VIEWING_TEMPLATE)} className="px-3 py-1 bg-gray-100 dark:bg-neutral-800 border rounded text-sm">
            Insert: Viewing checklist
          </button>
          <button onClick={() => addSnippet(RISKS_TEMPLATE)} className="px-3 py-1 bg-gray-100 dark:bg-neutral-800 border rounded text-sm">
            Insert: Risks & mitigations
          </button>
          <button onClick={() => addSnippet(OFFER_TEMPLATE)} className="px-3 py-1 bg-gray-100 dark:bg-neutral-800 border rounded text-sm">
            Insert: Offer assumptions
          </button>
        </div>
      )}
    </div>
  );
}
