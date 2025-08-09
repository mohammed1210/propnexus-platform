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
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-lg font-semibold">📝 Investor Notes</h3>
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span>{saveStatus}</span>
        <button
          className="underline"
          onClick={() => setShowAdvanced((s) => !s)}
          aria-expanded={showAdvanced}
        >
          {showAdvanced ? 'Hide advanced' : 'Advanced options'}
        </button>
      </div>
    </div>

    {/* Top row */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
      <input
        value={customField}
        onChange={(e) => setCustomField(e.target.value)}
        placeholder="Title / custom field (e.g. Viewing, Offer calc)"
        className="w-full border rounded px-3 py-2 bg-gray-50 dark:bg-neutral-800"
      />
      <select
        className="w-full border rounded px-3 py-2 bg-gray-50 dark:bg-neutral-800"
        defaultValue="Medium"
        onChange={(e) => {}}
      >
        <option>Low</option>
        <option>Medium</option>
        <option>High</option>
      </select>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" onChange={() => {}} />
        Pin to top
      </label>
    </div>

    {/* Quick Tags */}
    <div className="mb-3 -mt-2">
      {['#Refurb', '#Risks', '#Offer', '#FollowUp', '#Comps'].map((tag) => (
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

    {/* Editor + optional preview */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div>
        <textarea
          value={notes}
          onChange={(e) => {
            if (e.target.value.length <= maxChars) setNotes(e.target.value);
          }}
          className="w-full border rounded px-3 py-3 bg-gray-50 dark:bg-neutral-800 leading-6 resize-vertical min-h-[260px] md:min-h-[320px]"
          placeholder="Add your thoughts or deal analysis… (supports **bold**, *italics*, - bullets, - [ ] checkboxes)"
          rows={12}
        />
        <div className="flex justify-between text-xs mt-1 text-gray-500">
          <span>{saveStatus}</span>
          <span>{notes.length}/{maxChars} chars</span>
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={handleCopy} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded">
            Copy
          </button>
          <button onClick={handleDownload} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded">
            Download
          </button>
          <button onClick={handleClear} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded">
            Clear
          </button>
        </div>
      </div>

      {/* Compact advanced helpers + preview live in the right column to avoid clutter */}
      {showAdvanced && (
        <div className="card-flat">
          <div className="flex items-center gap-2 mb-2">
            <button
              className="text-xs border px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-neutral-800"
              onClick={() => setNotes((p) => (p ? `${p}\n\n- [ ] Exterior photos` : `- [ ] Exterior photos`))}
            >
              Insert: Viewing checklist
            </button>
            <button
              className="text-xs border px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-neutral-800"
              onClick={() =>
                setNotes((p) =>
                  p
                    ? `${p}\n\n**Risks**\n- Planning:\n- Structural:\n- Damp:\n- Market/exit:\n\n**Mitigations**\n- \n- `
                    : `**Risks**\n- Planning:\n- Structural:\n- Damp:\n- Market/exit:\n\n**Mitigations**\n- \n- `
                )
              }
            >
              Insert: Risks & mitigations
            </button>
            <button
              className="text-xs border px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-neutral-800"
              onClick={() =>
                setNotes((p) =>
                  p
                    ? `${p}\n\n**Assumptions**\n- Purchase: £\n- Works: £\n- Fees: £\n- Contingency: %\n- Target rent: £/m\n\n**Exit**\n- Strategy:\n- ARV: £\n- Target equity: £`
                    : `**Assumptions**\n- Purchase: £\n- Works: £\n- Fees: £\n- Contingency: %\n- Target rent: £/m\n\n**Exit**\n- Strategy:\n- ARV: £\n- Target equity: £`
                )
              }
            >
              Insert: Offer assumptions
            </button>
          </div>

          {/* Live preview */}
          <div className="border rounded p-3 bg-gray-50 dark:bg-neutral-900 text-sm overflow-auto min-h-[200px]">
            <div
              dangerouslySetInnerHTML={{
                __html: notes
                  .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                  .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                  .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  .replace(/\*(.*?)\*/g, '<em>$1</em>')
                  .replace(/^- \[ \] (.*)$/gim, '<li><input type="checkbox" disabled /> $1</li>')
                  .replace(/^- \[x\] (.*)$/gim, '<li><input type="checkbox" checked disabled /> $1</li>')
                  .replace(/^- (.*)$/gim, '<li>$1</li>')
                  .replace(/(<li>[\s\S]*?<\/li>)/gim, '<ul>$1</ul>')
                  .replace(/\n$/g, '<br/>'),
              }}
            />
          </div>
        </div>
      )}
    </div>
  </section>
);
}
