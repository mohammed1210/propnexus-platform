// /frontend/components/property_details/NotesFields.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

interface NotesFieldsProps {
  propertyId: string;
}

type Importance = 'Low' | 'Medium' | 'High';

type Snapshot = {
  title: string;
  customField: string;
  body: string;
  importance: Importance;
  tags: string[];
  pinned: boolean;
  ts: number; // epoch ms
};

const MAX_CHARS = 2000;
const QUICK_TAGS = ['#Refurb', '#Risks', '#Opportunities', '#FollowUp', '#Comps', '#Offer'];

// Small set of one-click templates
const TEMPLATES: Record<string, string> = {
  'Viewing checklist':
    `- [ ] Exterior photos\n- [ ] Roof / gutters\n- [ ] Damp / mould check\n- [ ] Electrics (EICR?)\n- [ ] Boiler age & service\n- [ ] Windows & glazing\n- [ ] Room measurements\n- [ ] Neighbours / noise`,
  'Risks & mitigations':
    `**Risks**\n- Planning: \n- Structural: \n- Damp: \n- Market/exit: \n\n**Mitigations**\n- \n- \n- `,
  'Offer assumptions':
    `**Assumptions**\n- Purchase: £\n- Works: £\n- Fees (legals/SDLT/etc): £\n- Contingency: %\n- Target rent: £ /m\n- Target yield on cost: %\n\n**Exit**\n- Strategy: \n- ARV: £\n- Target equity: £`,
};

// very light markdown → HTML (safe-ish: no links/images; bold/italics/code/strike, bullets, checkboxes)
function mdLite(src: string): string {
  let s = src
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // line breaks into <br>
  s = s.replace(/\r?\n/g, '<br/>');

  // bold **text**
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // italics *text*
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // strikethrough ~~text~~
  s = s.replace(/~~(.+?)~~/g, '<del>$1</del>');
  // inline code `code`
  s = s.replace(/`(.+?)`/g, '<code class="px-1 rounded bg-slate-100 dark:bg-neutral-800">$1</code>');

  // checkboxes - [ ] / - [x]
  s = s.replace(/- \[ \] /g, '• ☐ ');
  s = s.replace(/- \[x\] /gi, '• ☑︎ ');

  // basic bullets: lines starting with "- "
  s = s.replace(/(^|<br\/>)- /g, '$1• ');

  return s;
}

export default function NotesFields({ propertyId }: NotesFieldsProps) {
  // form state
  const [title, setTitle] = useState('');
  const [customField, setCustomField] = useState('');
  const [body, setBody] = useState('');
  const [importance, setImportance] = useState<Importance>('Medium');
  const [tags, setTags] = useState<string[]>([]);
  const [pinned, setPinned] = useState(false);

  // UX state
  const [saveStatus, setSaveStatus] = useState('');
  const [showPreview, setShowPreview] = useState(true);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const saveTimer = useRef<number | null>(null);

  // Keys
  const K = useMemo(() => ({
    title: `notes-title-${propertyId}`,
    field: `notes-custom-${propertyId}`,
    body:  `notes-body-${propertyId}`,
    importance: `notes-importance-${propertyId}`,
    tags: `notes-tags-${propertyId}`,
    pinned: `notes-pinned-${propertyId}`,
    history: `notes-history-${propertyId}`,
  }), [propertyId]);

  // Load
  useEffect(() => {
    setTitle(localStorage.getItem(K.title) ?? '');
    setCustomField(localStorage.getItem(K.field) ?? '');
    setBody(localStorage.getItem(K.body) ?? '');
    setImportance((localStorage.getItem(K.importance) as Importance) ?? 'Medium');
    try {
      setTags(JSON.parse(localStorage.getItem(K.tags) ?? '[]'));
    } catch { setTags([]); }

    setPinned(localStorage.getItem(K.pinned) === 'true');
    try {
      const hist = JSON.parse(localStorage.getItem(K.history) ?? '[]');
      if (Array.isArray(hist)) setHistory(hist);
    } catch {/* ignore */}
  }, [K]);

  // Save (debounced for typing)
  useEffect(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    setSaveStatus('Saving…');
    saveTimer.current = window.setTimeout(() => {
      localStorage.setItem(K.title, title);
      localStorage.setItem(K.field, customField);
      localStorage.setItem(K.body, body);
      localStorage.setItem(K.importance, importance);
      localStorage.setItem(K.tags, JSON.stringify(tags));
      localStorage.setItem(K.pinned, String(pinned));
      setSaveStatus(`Saved ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      // push to history (max 5)
      const snap: Snapshot = { title, customField, body, importance, tags, pinned, ts: Date.now() };
      setHistory((prev) => {
        const next = [snap, ...prev].slice(0, 5);
        localStorage.setItem(K.history, JSON.stringify(next));
        return next;
      });
    }, 350) as unknown as number;

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [title, customField, body, importance, tags, pinned, K]);

  // Handlers
  const addTag = (t: string) => setTags((prev) => prev.includes(t) ? prev : [...prev, t]);
  const removeTag = (t: string) => setTags((prev) => prev.filter(x => x !== t));

  const handleCopy = () => {
    const txt =
`[${importance}] ${title || 'Untitled note'} ${tags.length ? `(${tags.join(' ')})` : ''}

Custom: ${customField || '-'}
${'-'.repeat(24)}
${body}`;
    navigator.clipboard.writeText(txt);
    setSaveStatus('Copied to clipboard');
  };

  const handleDownload = () => {
    const contents =
`Title: ${title || 'Untitled'}
Importance: ${importance}
Tags: ${tags.join(' ')}
Pinned: ${pinned}
Custom Field: ${customField}

Notes:
${body}
`;
    const blob = new Blob([contents], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `notes-${propertyId}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleClear = () => {
    if (!confirm('Clear all notes for this property?')) return;
    setTitle('');
    setCustomField('');
    setBody('');
    setTags([]);
    setImportance('Medium');
    setPinned(false);
    setHistory([]);
    Object.values(K).forEach((key) => localStorage.removeItem(key));
    setSaveStatus('Cleared');
  };

  const handleUndo = () => {
    if (history.length < 2) return; // current + at least one previous
    const [, prev] = history; // the previous snapshot
    setTitle(prev.title);
    setCustomField(prev.customField);
    setBody(prev.body);
    setImportance(prev.importance);
    setTags(prev.tags);
    setPinned(prev.pinned);
    setHistory(history.slice(1));
    setSaveStatus('Reverted last change');
  };

  const insertTemplate = (name: string) => {
    const tpl = TEMPLATES[name];
    if (!tpl) return;
    setBody((b) => (b ? `${b}\n\n${tpl}` : tpl));
  };

  // styling helpers
  const importanceChip = {
    Low:    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    Medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    High:   'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
  }[importance];

  return (
    <section
      className={`shadow-md rounded-md p-5 mt-6 bg-white dark:bg-neutral-900 ${pinned ? 'md:sticky md:top-4 ring-2 ring-blue-300' : ''}`}
      aria-label="Investor notes"
    >
      <header className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-lg font-semibold">📝 Investor Notes</h3>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded ${importanceChip}`}>{importance}</span>
          <label className="text-xs flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
            Pin
          </label>
        </div>
      </header>

      {/* Title + Importance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="e.g. Offer calc / Viewing prep"
            className="w-full border rounded px-3 py-2 bg-gray-50 dark:bg-neutral-800"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Importance</label>
          <select
            className="w-full border rounded px-3 py-2 bg-gray-50 dark:bg-neutral-800"
            value={importance}
            onChange={(e) => setImportance(e.target.value as Importance)}
          >
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </div>
      </div>

      {/* Custom field */}
      <div className="mb-3">
        <label className="block text-sm font-medium">Custom Field</label>
        <input
          type="text"
          value={customField}
          onChange={(e) => setCustomField(e.target.value)}
          className="w-full border rounded px-3 py-2 bg-gray-50 dark:bg-neutral-800"
          placeholder="e.g. Potential refurb cost, contact, etc."
        />
      </div>

      {/* Tags */}
      <div className="mb-2 flex flex-wrap gap-2">
        {QUICK_TAGS.map((t) => (
          <button
            key={t}
            type="button"
            className="text-xs bg-gray-200 dark:bg-neutral-700 px-2 py-1 rounded hover:bg-gray-300"
            onClick={() => addTag(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {tags.map((t) => (
            <span key={t} className="text-xs bg-gray-100 dark:bg-neutral-800 border px-2 py-1 rounded">
              {t}{' '}
              <button className="ml-1" onClick={() => removeTag(t)} aria-label={`Remove ${t}`}>×</button>
            </span>
          ))}
        </div>
      )}

      {/* Templates */}
      <div className="mb-3 flex flex-wrap gap-2">
        {Object.keys(TEMPLATES).map((name) => (
          <button
            key={name}
            className="text-xs border px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-neutral-800"
            onClick={() => insertTemplate(name)}
            type="button"
          >
            Insert: {name}
          </button>
        ))}
        <button
          className="text-xs border px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-neutral-800"
          onClick={() => setBody((b) => (b ? `${b}\n- [ ] ` : '- [ ] '))}
          type="button"
        >
          Add checklist item
        </button>
      </div>

      {/* Notes + Preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Notes (supports **bold**, *italics*, ~~strike~~, `code`, bullets, and checkboxes)</label>
          <textarea
            value={body}
            onChange={(e) => {
              const v = e.target.value;
              if (v.length <= MAX_CHARS) setBody(v);
            }}
            rows={8}
            className="w-full border rounded px-3 py-2 bg-gray-50 dark:bg-neutral-800"
            placeholder="Add your thoughts or deal analysis..."
          />
          <div className="flex justify-between text-xs mt-1 text-gray-500">
            <span>{saveStatus}</span>
            <span>{body.length}/{MAX_CHARS} chars</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Preview</label>
            <label className="text-xs flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={showPreview} onChange={(e) => setShowPreview(e.target.checked)} />
              Show
            </label>
          </div>
          <div
            className="mt-2 border rounded px-3 py-2 text-sm min-h-[2.5rem] bg-white dark:bg-neutral-900"
            style={{ display: showPreview ? 'block' : 'none' }}
            dangerouslySetInnerHTML={{ __html: mdLite(body || '_No content yet_') }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={handleCopy} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded">
          Copy
        </button>
        <button onClick={handleDownload} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded">
          Download
        </button>
        <button onClick={handleUndo} disabled={history.length < 2}
          className={`px-3 py-1 rounded ${history.length < 2 ? 'bg-gray-300 text-gray-600' : 'bg-amber-600 hover:bg-amber-700 text-white'}`}>
          Undo
        </button>
        <button onClick={handleClear} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded">
          Clear
        </button>
      </div>
    </section>
  );
}
