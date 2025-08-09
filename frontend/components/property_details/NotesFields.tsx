import { useEffect, useState } from 'react';

interface Props {
  propertyId: string;
}

export default function NotesFields({ propertyId }: Props) {
  const [notes, setNotes] = useState('');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [pin, setPin] = useState(false);
  const [showTools, setShowTools] = useState(false); // default hidden
  const [saveMsg, setSaveMsg] = useState('');
  const maxChars = 2000;

  useEffect(() => {
    const saved = localStorage.getItem(`notes-${propertyId}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      setNotes(parsed.notes || '');
      setTitle(parsed.title || '');
      setPriority(parsed.priority || 'Medium');
      setPin(parsed.pin || false);
    }
  }, [propertyId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(
        `notes-${propertyId}`,
        JSON.stringify({ notes, title, priority, pin })
      );
      setSaveMsg('Saved ' + new Date().toLocaleTimeString());
    }, 400);

    return () => clearTimeout(timer);
  }, [notes, title, priority, pin, propertyId]);

  const handleClear = () => {
    localStorage.removeItem(`notes-${propertyId}`);
    setNotes('');
    setTitle('');
    setPriority('Medium');
    setPin(false);
    setSaveMsg('Cleared');
  };

  const insertTemplate = (template: string) => {
    setNotes((prev) => prev + template);
  };

  return (
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

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title / custom field"
          className="w-full rounded px-3 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="w-full rounded px-3 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700"
        >
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={pin}
            onChange={(e) => setPin(e.target.checked)}
          />
          Pin to top
        </label>
      </div>

      {/* Tag buttons */}
      <div className="flex flex-wrap gap-2 mb-2">
        {['#Refurb', '#Risks', '#Offer', '#FollowUp', '#Comps'].map((tag) => (
          <button
            key={tag}
            className="px-2 py-1 bg-gray-200 dark:bg-neutral-700 rounded text-sm"
            onClick={() => setNotes((prev) => `${prev}${tag} `)}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Tools row */}
      {showTools && (
        <div className="flex flex-wrap gap-2 mb-2">
          <button
            className="px-2 py-1 bg-gray-200 dark:bg-neutral-700 rounded text-xs"
            onClick={() =>
              insertTemplate(
                '- [ ] Exterior photos\n- [ ] Roof / gutters\n- [ ] Damp / mould check\n'
              )
            }
          >
            Insert: Viewing checklist
          </button>
          <button
            className="px-2 py-1 bg-gray-200 dark:bg-neutral-700 rounded text-xs"
            onClick={() => insertTemplate('- Risk: \n- Mitigation: \n')}
          >
            Insert: Risks & mitigations
          </button>
          <button
            className="px-2 py-1 bg-gray-200 dark:bg-neutral-700 rounded text-xs"
            onClick={() => insertTemplate('- Offer assumption: \n')}
          >
            Insert: Offer assumptions
          </button>
        </div>
      )}

      {/* Textarea */}
      <textarea
        value={notes}
        onChange={(e) =>
          e.target.value.length <= maxChars && setNotes(e.target.value)
        }
        className="w-full rounded px-3 py-3 bg-gray-50 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 leading-6 min-h-[320px] md:min-h-[360px] font-[system-ui]"
        placeholder="Add your thoughts or deal analysis… (supports **bold**, *italics*, - bullets, - [ ] checkboxes)"
        rows={14}
      />

      {/* Save/Clear row */}
      <div className="flex justify-between text-xs mt-1 text-gray-500">
        <span>Autosaves locally</span>
        <span>
          {notes.length}/{maxChars} chars
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mt-2">
        <button
          onClick={() => {
            navigator.clipboard.writeText(notes);
            setSaveMsg('Copied!');
          }}
          className="px-3 py-1 bg-gray-200 dark:bg-neutral-700 rounded text-xs"
        >
          Copy
        </button>
        <button
          onClick={() => {
            const blob = new Blob([notes], { type: 'text/plain' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'notes.txt';
            link.click();
          }}
          className="px-3 py-1 bg-gray-200 dark:bg-neutral-700 rounded text-xs"
        >
          Download
        </button>
        <button
          onClick={handleClear}
          className="px-3 py-1 bg-gray-200 dark:bg-neutral-700 rounded text-xs"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
