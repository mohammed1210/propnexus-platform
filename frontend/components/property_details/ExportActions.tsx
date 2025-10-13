'use client';

type Props = {
  onSave?: () => void;
  onPdf?: () => void;
  onCrm?: () => void;
  loading?: boolean;
};

export default function ExportActions({ onSave, onPdf, onCrm, loading = false }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onSave}
        disabled={loading}
        className="pnx-btn pnx-btn-primary"
        aria-busy={loading || undefined}
      >
        Save
      </button>

      <button
        type="button"
        onClick={onPdf}
        disabled={loading}
        className="pnx-btn pnx-btn-outline"
        aria-busy={loading || undefined}
      >
        Export PDF
      </button>

      <button
        type="button"
        onClick={onCrm}
        disabled={loading}
        className="pnx-btn pnx-btn-outline"
        aria-busy={loading || undefined}
      >
        Send to CRM
      </button>
    </div>
  );
}
