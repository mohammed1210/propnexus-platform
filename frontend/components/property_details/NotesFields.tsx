'use client';

import React, { useEffect, useState } from 'react';

type Props = { propertyId: string };

// Quick tags shown above the editor
const QUICK_TAGS = ['#Refurb', '#Risks', '#Offer', '#FollowUp', '#Comps'] as const;

// Snippet templates
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

const fmtTime = (d = new Date()) =>
  d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function NotesFields({ propertyId }: Props) {
  // Core state
  const [customField, setCustomField] = useState(''); // title/custom field
  const [importance, setImportance] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [pinned, setPinned] = useState(false);
  const [notes, setNotes] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [showTools, setShowTools] = useState(true);

  const maxChars = 2000;

  // Load from localStorage on mount / id change
  useEffect(() => {
    const get = (k: string) => localStorage.getItem(k) ?? '';
    setCustomField(get(`title-${propertyId}`));
    setImportance(((get(`importance-${propertyId}`) as 'Low' | 'Medium' | 'High') || 'Medium'));
    setPinned(get(`pinned-${propertyId}`) === '1');
    setNotes(get(`notes-${propertyId}`));
    setSaveMsg(`Loaded ${fmtTime()}`);
  }, [propertyId]);

  // Debounced autosave
  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem(`title-${propertyId}`, customField);
      localStorage.setItem(`importance-${propertyId}`, importance);
      localStorage.setItem(`pinned-${propertyId}`, pinned ? '1' : '0');
      localStorage.setItem(`notes-${propertyId}`, notes);
      setSaveMsg(`Saved ${fmtTime()}`);
    }, 300);
    return () => clearTimeout(t);
  }, [customField, importance, pinned, notes, propertyId]);

  // Helpers
  const addSnippet = (snippet: string) =>
    setNotes(prev => (prev ? `${prev}\n\n${snippet}` : snippet));

  const handleCopy = async () => {
    await navigator.clipboard.writeText(
      [
        pinned ? '📌 Pinned' : '',
        `Title: ${customField}`,
        `Importance: ${importance}`,
        '',
        notes,
      ]
        .filter(Boolean)
        .join('\n')
    );
    setSaveMsg('Copied to clipboard');
    setTimeout(() => setSaveMsg(`Saved ${fmtTime()}`), 1200);
  };

  const handleDownload = () => {
    const blob = new Blob(
      [
        `Title: ${customField}\nImportance: ${importance}\nPinned: ${
          pinned ? 'Yes' : 'No'
        }\n\n${notes}`,
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
    setCustomField('');
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
    <section className="section-box">
      {/* Header + tools toggle */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">📝 Investor Notes</h3>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>{saveMsg}</span>
          <button
            className="underline"
            onClick={() => setShowTools(s => !s)}
            aria-expanded={showTools}
          >
            {showTools ? 'Hide tools' : 'Show tools'}
          </button>
        </div>
      </div>

      {/* Top controls */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr,160px,110px] gap-3 mb-3">
        <input
          value={customField}
          onChange={(e) => setCustomField(e.target.value)}
          placeholder="Title / custom field (e.g. Viewing, Offer calc)"
          className="w-full rounded px-3 py-2 bg-gray-50 dark:bg-neutral-800 border"
        />
        <select
          className="w-full rounded px-3 py-2 bg-gray-50 dark:bg-neutral-800 border"
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
        <div className="mb-2 -mt-1">
          {QUICK_TAGS.map(tag => (
            <button
              key={tag}
              type="button"
              className="text-xs bg-gray-200 dark:bg-neutral-700 px-2 py-1 rounded mr-2 mb-2 hover:bg-gray-300"
              onClick={() => setNotes(prev => (prev ? `${prev} ${tag}` : tag))}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Editor & actions (no inner card borders) */}
      <div className="grid grid-cols-1 gap-3">
        <div>
          <textarea
            value={notes}
            onChange={(e) => {
              if (e.target.value.length <= maxChars) setNotes(e.target.value);
            }}
            className="w-full rounded px-3 py-3 bg-gray-50 dark:bg-neutral-800 border leading-6 resize-vertical min-h-[260px] md:min-h-[320px]"
            placeholder="Add your thoughts or deal analysis…  (supports **bold**, *italics*, - bullets, - [ ] checkboxes)"
            rows={14}
          />
          <div className="flex justify-between text-xs mt-1 text-gray-500">
            <span>{notes.length}/{maxChars} chars</span>
            <span className="opacity-70">Autosaves locally</span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
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
        </div>

        {/* Snippet buttons (optional) */}
        {showTools && (
          <div className="pt-2">
            <div className="flex flex-wrap gap-2">
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
        )}
      </div>
    </section>
  );
}
