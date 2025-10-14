'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Size = 'Small' | 'Medium' | 'High';

interface NotesFieldsProps {
  propertyId: string;
  className?: string;
}

type StoredNotes = {
  title: string;
  size: Size;
  pinned: boolean;
  text: string;
  tags: string[];
  savedAt: number; // epoch ms
};

const TAGS = ['#Refurb', '#Risks', '#Offer', '#FollowUp', '#Comps'];

const VIEWING_CHECKLIST = `#Refurb #Risks
- [ ] Exterior photos
- [ ] Roof / gutters
- [ ] Damp / mould check
- [ ] Electrics (EICR?)
- [ ] Boiler age & service
- [ ] Windows & glazing
- [ ] Room measurements
`;

const RISKS_AND_MITS = `#Risks
- [ ] Valuation risk — add 5% buffer
- [ ] Refurb overrun — add 10–15% contingency
- [ ] Void period — assume 1 month
- [ ] Down valuation — line up 2nd lender
- [ ] Exit risk — confirm 2+ viable exit strategies
`;

const OFFER_ASSUMPTIONS = `#Offer
- Purchase price: £
- Refurb budget: £
- GDV: £
- Target yield: %
- Target ROI: %
- Exit strategies: (Let / Refi / Flip)
`;

function fmtSavedTime(ts?: number) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function NotesFields({ propertyId, className }: NotesFieldsProps) {
  const storageKey = useMemo(() => `propnexus:notes:${propertyId}`, [propertyId]);

  const [title, setTitle] = useState('');
  const [size, setSize] = useState<Size>('Medium');
  const [pinned, setPinned] = useState(false);
  const [text, setText] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [savedAt, setSavedAt] = useState<number | undefined>();
  const [showTools, setShowTools] = useState(true);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MAX = 2000;

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredNotes;
        setTitle(parsed.title ?? '');
        setSize(parsed.size ?? 'Medium');
        setPinned(Boolean(parsed.pinned));
        setText(parsed.text ?? '');
        setTags(Array.isArray(parsed.tags) ? parsed.tags : []);
        setSavedAt(parsed.savedAt);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Debounced autosave
  useEffect(() => {
    const payload: StoredNotes = {
      title,
      size,
      pinned,
      text,
      tags,
      savedAt: Date.now(),
    };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify(payload));
      setSavedAt(payload.savedAt);
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [title, size, pinned, text, tags, storageKey]);

  const insertText = (snippet: string) => {
    setText((t) => {
      const joiner = t && !t.endsWith('\n') ? '\n' : '';
      return `${t}${joiner}${snippet}`;
    });
  };

  const onCopy = async () => {
    const composed = buildExport(title, size, pinned, tags, text);
    try {
      await navigator.clipboard.writeText(composed);
    } catch {}
  };

  const onDownload = () => {
    const composed = buildExport(title, size, pinned, tags, text);
    const blob = new Blob([composed], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `propnexus-notes-${propertyId}-${stamp}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const onClear = () => {
    if (!window.confirm('Clear notes? This only clears your local copy.')) return;
    setTitle('');
    setSize('Medium');
    setPinned(false);
    setText('');
    setTags([]);
    setSavedAt(undefined);
    localStorage.removeItem(storageKey);
  };

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
    setText((t) => (t.includes(tag) ? t : (t ? `${t} ` : '') + tag));
  };

  const used = text.length;

  return (
    <div
      className={[
        'w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm',
        pinned ? 'ring-1 ring-blue-500' : '',
        className ?? '',
      ].join(' ')}
      data-pinned={pinned}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">📝 Investor Notes</span>
          <span className="text-xs text-neutral-500">
            {savedAt ? `Saved ${fmtSavedTime(savedAt)}` : 'Autosaves locally'}
          </span>
        </div>

        <button
          type="button"
          className="text-xs underline text-neutral-600 dark:text-neutral-300 hover:opacity-80"
          onClick={() => setShowTools((s) => !s)}
          aria-expanded={showTools}
        >
          {showTools ? 'Hide tools' : 'Show tools'}
        </button>
      </div>

      {showTools && (
        <>
          <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
            <label className="sr-only" htmlFor="notes-title">
              Title
            </label>
            <input
              id="notes-title"
              className="min-w-[220px] flex-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none"
              placeholder="Title / custom field (e.g. Viewing notes)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <label className="sr-only" htmlFor="notes-priority">
              Priority
            </label>
            <select
              id="notes-priority"
              className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-2 text-sm"
              value={size}
              onChange={(e) => setSize(e.target.value as Size)}
              aria-label="Priority"
            >
              <option>Small</option>
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

          <div className="flex flex-wrap gap-2 px-4 pt-3">
            {TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={[
                  'rounded-full border px-3 py-1 text-xs',
                  tags.includes(tag)
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200',
                ].join(' ')}
                aria-pressed={tags.includes(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="px-4 pt-3">
        <div className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900">
          <label className="sr-only" htmlFor="notes-text">
            Notes
          </label>
          <textarea
            id="notes-text"
            className="h-40 w-full resize-y rounded-lg bg-transparent px-3 py-2 text-sm leading-5 outline-none"
            placeholder="Add your thoughts or deal analysis… (supports **bold**, *italics*, - bullets, - [ ] checkboxes)"
            maxLength={MAX}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="text-xs text-neutral-500">
          {used}/{MAX} chars
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={onCopy}
            type="button"
            className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            Copy
          </button>
          <button
            onClick={onDownload}
            type="button"
            className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            Download
          </button>
          <button
            onClick={onClear}
            type="button"
            className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-neutral-200 dark:border-neutral-800 px-4 py-3">
        <button
          onClick={() => insertText(VIEWING_CHECKLIST)}
          className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800"
        >
          Insert: Viewing checklist
        </button>
        <button
          onClick={() => insertText(RISKS_AND_MITS)}
          className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800"
        >
          Insert: Risks & mitigations
        </button>
        <button
          onClick={() => insertText(OFFER_ASSUMPTIONS)}
          className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800"
        >
          Insert: Offer assumptions
        </button>
      </div>
    </div>
  );
}

function buildExport(title: string, size: Size, pinned: boolean, tags: string[], text: string) {
  const header = `Investor Notes
Title: ${title || '-'}
Priority: ${size}
Pinned: ${pinned ? 'Yes' : 'No'}
Tags: ${tags.join(' ') || '-'}
-----------------------------
`;
  return `${header}\n${text}\n`;
}
