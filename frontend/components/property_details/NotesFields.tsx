'use client';

import React, { useEffect, useMemo, useState } from 'react';

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

function formatTime(d = new Date()) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function NotesFields({ propertyId }: Props) {
  // simple core fields
  const [title, setTitle] = useState('');
  const [importance, setImportance] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [pinned, setPinned] = useState(false);
  const [notes, setNotes] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const maxChars = 2000;

  // Load
  useEffect(() => {
    const get = (k: string) => localStorage.getItem(k) ?? '';
    setTitle(get(`title-${propertyId}`));
    setImportance((get(`importance-${propertyId}`) as any) || 'Medium');
    setPinned(get(`pinned-${propertyId}`) === '1');
    setNotes(get(`notes-${propertyId}`));
  }, [propertyId]);

  // Save (debounced-ish)
  useEffect(() => {
    const id = setTimeout(() => {
      localStorage.setItem(`title-${propertyId}`, title);
      localStorage.setItem(`importance-${propertyId}`, importance);
      localStorage.setItem(`pinned-${propertyId}`, pinned ? '1' : '0');
      localStorage.setItem(`notes-${propertyId}`, notes);
      setSaveMsg(`Saved ${formatTime()}`);
    }, 300);
    return () => clearTimeout(id);
  }, [title, importance, pinned, notes, propertyId]);

  const charCount = notes.length;

  // very light markdown-ish preview (bold/italic/strike, bullets, checkboxes)
  const previewHtml = useMemo(() => {
    let t = notes
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/~~(.*?)~~/g, '<s>$1</s>')
      .replace(/^- \[ \] (.*)$/gim, '<li><input type="checkbox" disabled /> $1</li>')
      .replace(/^- \[x\] (.*)$/gim, '<li><input type="checkbox" checked disabled /> $1</li>')
      .replace(/^- (.*)$/gim, '<li>$1</li>')
      .replace(/\n$/g, '<br/>');
    // wrap bullet lines into <ul>
    t = t.replace(/(<li>[\s\S]*?<\/li>)/gim, '<ul>$1</ul>');
    return t;
  }, [notes]);

  // actions
  const insert = (snippet: string) =>
    setNotes((prev) => (prev ? `${prev}\n\n${snippet}` : snippet));

  const handleCopy = async () => {
    await navigator.clipboard.writeText(
      [pinned ? '📌 Pinned' : '', `Title: ${title}`, `Importance: ${importance}`, '', notes]
        .filter(Boolean)
        .join('\n')
    );
    setSaveMsg('Copied to clipboard');
    setTimeout(() => setSaveMsg(`Saved ${formatTime()}`), 1200);
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
    <section className="section-box">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold">📝 Investor Notes</h3>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>{saveMsg}</span>
          <button
            className="underline"
            onClick={() => setShowAdvanced((s) => !s)}
            aria-expanded={showAdvanced}
          >
            {showAdvanced ? 'Hide advanced' : 'Advanced options'}
          </button>
        </div>
      </div>

      {/* Simple row: title, importance, pin */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g. Offer calc / Viewing)"
          className="w-full border rounded px-3 py-2 bg-gray-50 dark:bg-neutral-800"
        />
        <select
          value={importance}
          onChange={(e) => setImportance(e.target.value as any)}
          className="w-full border rounded px-3 py-2 bg-gray-50 dark:bg-neutral-800"
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
      <div className="mb-3">
        {QUICK_TAGS.map((t) => (
          <button
            key={t}
            type="button"
            className="text-xs bg-gray-200 dark:bg-neutral-700 px-2 py-1 rounded mr-2 mb-2 hover:bg-gray-300"
            onClick={() => setNotes((prev) => (prev ? `${prev} ${t}` : t))}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Notes + (optional) advanced helpers */}
      {showAdvanced && (
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            className="text-xs border px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-neutral-800"
            onClick={() => insert(VIEWING_TEMPLATE)}
          >
            Insert: Viewing checklist
          </button>
          <button
            className="text-xs border px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-neutral-800"
            onClick={() => insert(RISKS_TEMPLATE)}
          >
            Insert: Risks & mitigations
          </button>
          <button
            className="text-xs border px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-neutral-800"
            onClick={() => insert(OFFER_TEMPLATE)}
          >
            Insert: Offer assumptions
          </button>
          <label className="text-xs ml-auto flex items-center gap-2">
            <input
              type="checkbox"
              checked={showPreview}
              onChange={(e) => setShowPreview(e.target.checked)}
            />
            Preview
          </label>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <textarea
            value={notes}
            onChange={(e) => {
              if (e.target.value.length <= maxChars) setNotes(e.target.value);
            }}
            rows={showAdvanced && showPreview ? 10 : 6}
            className="w-full border rounded px-3 py-2 bg-gray-50 dark:bg-neutral-800"
            placeholder="Add your thoughts or deal analysis… (supports **bold**, *italics*, ~~strike~~, - bullets, - [ ] checkboxes)"
          />
          <div className="flex justify-between text-xs mt-1 text-gray-500">
            <span>
              {saveMsg || 'Autosave on'} {pinned && '• 📌 pinned'}
            </span>
            <span>
              {charCount}/{maxChars} chars
            </span>
          </div>
        </div>

        {showAdvanced && showPreview && (
          <div className="border rounded p-3 bg-gray-50 dark:bg-neutral-900 text-sm overflow-auto">
            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        )}
      </div>

      {/* Actions */}
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
    </section>
  );
}
