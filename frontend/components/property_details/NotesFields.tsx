'use client';

import React, { useEffect, useState } from 'react';

type Props = { propertyId: string };

// -------- Quick helpers --------
const maxChars = 2000;

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function safeGet(key: string): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return '';
    // In case older versions stored JSON, try parse, otherwise return raw
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'string' ? parsed : raw;
    } catch {
      return raw;
    }
  } catch {
    return '';
  }
}

function safeSet(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    // store as plain string (no JSON) to avoid parse errors on retrieval
    localStorage.setItem(key, value);
  } catch {
    /* ignore quota or private mode errors */
  }
}

// -------- Snippet templates --------
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

// -------- Component --------
export default function NotesFields({ propertyId }: Props) {
  // core fields
  const [title, setTitle] = useState('');
  const [importance, setImportance] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [pinned, setPinned] = useState(false);
  const [notes, setNotes] = useState('');
  const [saveMsg, setSaveMsg] = useState('');        // “Saved 15:41”
  const [showTools, setShowTools] = useState(true);  // toggle tool row visibility

  // Load on mount
  useEffect(() => {
    setTitle(safeGet(`title-${propertyId}`));
    const imp = safeGet(`importance-${propertyId}`);
    setImportance((imp as 'Low' | 'Medium' | 'High') || 'Medium');
    setPinned(safeGet(`pinned-${propertyId}`) === '1');
    setNotes(safeGet(`notes-${propertyId}`));
    setSaveMsg(`Loaded ${nowTime()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  // Autosave (light debounce)
  useEffect(() => {
    const id = setTimeout(() => {
      safeSet(`title-${propertyId}`, title);
      safeSet(`importance-${propertyId}`, importance);
      safeSet(`pinned-${propertyId}`, pinned ? '1' : '0');
      safeSet(`notes-${propertyId}`, notes);
      setSaveMsg(`Saved ${nowTime()}`);
    }, 300);
    return () => clearTimeout(id);
  }, [title, importance, pinned, notes, propertyId]);

  // Actions
  const addTag = (tag: string) =>
    setNotes((prev) => (prev ? `${prev} ${tag}` : tag));

  const addSnippet = (snippet: string) =>
    setNotes((prev) => (prev ? `${prev}\n\n${snippet}` : snippet));

  const handleCopy = async () => {
    const blob = [
      pinned ? '📌 Pinned' : '',
      `Title: ${title}`,
      `Importance: ${importance}`,
      '',
      notes,
    ]
      .filter(Boolean)
      .join('\n');
    await navigator.clipboard.writeText(blob);
    setSaveMsg('Copied to clipboard');
    setTimeout(() => setSaveMsg(`Saved ${nowTime()}`), 1200);
  };

  const handleDownload = () => {
    const file = [
      `Title: ${title}`,
      `Importance: ${importance}`,
      `Pinned: ${pinned ? 'Yes' : 'No'}`,
      '',
      notes,
    ].join('\n');
    const b = new Blob([file], { type: 'text/plain' });
    const url = URL.createObjectURL(b);
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
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`title-${propertyId}`);
      localStorage.removeItem(`importance-${propertyId}`);
      localStorage.removeItem(`pinned-${propertyId}`);
      localStorage.removeItem(`notes-${propertyId}`);
    }
    setSaveMsg('Cleared');
  };

  // UI
  return (
    // No inner border/shadow here — the page provides the outer "section-box"
    <div className="w-full">
      {/* Header */}
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

      {/* Tools row */}
      {showTools && (
        <div className="space-y-2 mb-2">
          {/* Title / Importance / Pin */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title / custom field (e.g. Viewing, Offer calc)"
              className="w-[min(520px,100%)] rounded px-3 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700"
            />
            <select
              className="rounded px-3 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700"
              value={importance}
              onChange={(e) =>
                setImportance(e.target.value as 'Low' | 'Medium' | 'High')
              }
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
          <div className="flex flex-wrap gap-2">
            {['#Refurb', '#Risks', '#Offer', '#FollowUp', '#Comps'].map((tag) => (
              <button
                key={tag}
                type="button"
                className="text-xs bg-gray-200 dark:bg-neutral-700 px-2 py-1 rounded hover:bg-gray-300"
                onClick={() => addTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Editor (single column, wide, taller) */}
      <div className="grid grid-cols-1 gap-3">
        <div>
          <textarea
            value={notes}
            onChange={(e) => {
              const v = e.target.value;
              if (v.length <= maxChars) setNotes(v);
            }}
            className="w-full rounded px-3 py-3 bg-gray-50 dark:bg-neutral-800 leading-6 resize-vertical min-h-[340px] md:min-h-[380px] border border-gray-300 dark:border-neutral-700"
            placeholder="Add your thoughts or deal analysis…  (supports **bold**, *italics*, - bullets, - [ ] checkboxes)"
            rows={14}
          />
          <div className="flex justify-between text-xs mt-1 text-gray-500">
            <span>{notes.length}/{maxChars} chars</span>
            <span className="opacity-70">Autosaves locally</span>
          </div>

          {/* Actions */}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={handleCopy}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded"
            >
              Copy
            </button>
            <button
              onClick={handleDownload}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded"
            >
              Download
            </button>
            <button
              onClick={handleClear}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded"
            >
              Clear
            </button>
          </div>

          {/* Snippet buttons */}
          <div className="pt-2 flex flex-wrap gap-2">
            <button
              className="text-xs border px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-neutral-800"
              onClick={() => addSnippet(VIEWING_TEMPLATE)}
            >
              Insert: Viewing checklist
            </button>
            <button
              className="text-xs border px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-neutral-800"
              onClick={() => addSnippet(RISKS_TEMPLATE)}
            >
              Insert: Risks & mitigations
            </button>
            <button
              className="text-xs border px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-neutral-800"
              onClick={() => addSnippet(OFFER_TEMPLATE)}
            >
              Insert: Offer assumptions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
