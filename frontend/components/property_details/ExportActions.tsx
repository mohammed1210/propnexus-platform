"use client";

export default function ExportActions({
  onSave,
  onPdf,
  onCrm,
  className = "",
}: {
  onSave?: () => void;
  onPdf?: () => void;
  onCrm?: () => void;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-1 gap-3 ${className}`}>
      <button onClick={onSave} className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded">💾 Save Deal</button>
      <button onClick={onPdf} className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded">📄 Download Deal Pack (v2)</button>
      <button onClick={onCrm} className="bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-4 rounded">🔗 Export to CRM</button>
    </div>
  );
}
