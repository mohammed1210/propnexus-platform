'use client';

export default function ExportActions({
  onSave,
  onPdf,
  onCrm,
  className = '',
}: {
  onSave?: () => void;
  onPdf?: () => void;
  onCrm?: () => void;
  className?: string;
}) {
  const btn = 'w-full py-2 px-4 rounded font-medium text-white transition-colors';

  return (
    <div className={`grid gap-2 ${className}`}>
      <button onClick={onSave} className={`${btn} bg-green-600 hover:bg-green-700`}>
        💾 Save Deal
      </button>
      <button onClick={onPdf} className={`${btn} bg-blue-600 hover:bg-blue-700`}>
        📄 Download Deal Pack
      </button>
      <button onClick={onCrm} className={`${btn} bg-amber-500 hover:bg-amber-600`}>
        🔗 Export to CRM
      </button>
    </div>
  );
}
