'use client';

import React, { useEffect, useMemo, useState } from 'react';

type Props = { propertyId: string };

const QUICK_TAGS = ['#Refurb', '#Risks', '#Offer', '#FollowUp', '#Comps'] as const;
const MAX_CHARS = 2000;

// Templates
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

function formatTime(d = new Date()) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function NotesFields({ propertyId }: Props) {
  // Core fields
  const [title, setTitle] = useState('');
  const [importance, setImportance] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [pinned, setPinned] = useState(false);
  const [notes, setNotes] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Load from localStorage
  useEffect(() => {
    const get = (k: string) => localStorage.getItem(k) ?? '';
    setTitle(get(`title-${propertyId}`));
    const imp = get(`importance-${propertyId}`) as 'Low' | 'Medium' | 'High';
    setImportance(imp || 'Medium');
    setPinned(get(`pinned-${propertyId}`) === '1');
    setNotes(get(`notes-${propertyId}`));
  }, [propertyId]);

  // Save with light debounce
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

  // Preview renderer (very light markdown-ish)
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
    t = t.replace(/(<li>[\s\S]*?<\/li>)/gim, '<ul>$1</ul>');
    return t;
  }, [notes]);

  // Helpers
  const insert = (snippet: string) =>
    setNotes((prev) => (prev ? `${prev}\n\n${snippet}` : snippet));

  const handleCopy = async () => {
    await navigator.clipboard.writeText(
      [
        pinned ? '📌 Pinned' : '',
        title ? `Title: ${title}` : '',
        `Importance: ${importance}`,
        '',
        notes,
      ]
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
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">📝 Investor Notes</h3>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>{saveMsg}</span>
          <button
            className="underline"
            onClick={() => setShowAdvanced((s) => !s)}
            aria-expanded={showAdvanced}
          >
            {showAdvanced ? 'Hide tools' : 'Show tools'}
          </button>
        </div>
      </div>

      {/* Top row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title / custom field (e.g. Viewing, Offer calc)"
          className="w-full border rounded px-3 py-2 bg-gray-50 dark:bg-neutral-800"
        />
        <select
          className="w-full border rounded px-3 py-2 bg-gray-50 dark:bg-neutral-800"
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

      {/* Quick Tags */}
      <div className="mb-3 -mt-2">
        {QUICK_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            className="text-xs bg-gray-200 dark:bg-neutral-700 px-2 py-1 rounded mr-2 mb-2 hover:bg-gray-300"
            onClick={() => setNotes((prev) => (prev ? `${prev} ${tag}` : tag))}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Editor + optional tools/preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Editor */}
        <div>
          <textarea
            value={notes}
            onChange={(e) => {
              if (e.target.value.length <= MAX_CHARS) setNotes(e.target.value);
            }}
            className="w-full border rounded px-3 py-3 bg-gray-50 dark:bg-neutral-800 leading-6 resize-vertical min-h-[280px] md:min-h-[340px]"
            placeholder="Add your thoughts or deal analysis… (supports **bold**, *italics*, - bullets, - [ ] checkboxes)"
            rows={12}
            aria-label="Investor notes"
          />
          <div className="flex justify-between text-xs mt-1 text-gray-500">
            <span>{notes.length}/{MAX_CHARS} chars</span>
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
        </div>

        {/* Tools + Live preview */}
        {showAdvanced && (
          <div className="card-flat">
            <div className="flex flex-wrap items-center gap-2 mb-3">
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
            </div>

            <div className="border rounded p-3 bg-gray-50 dark:bg-neutral-900 text-sm overflow-auto min-h-[220px]">
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
