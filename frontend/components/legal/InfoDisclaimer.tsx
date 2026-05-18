type InfoDisclaimerProps = {
  label?: string;
  children: React.ReactNode;
  className?: string;
};

export default function InfoDisclaimer({
  label = 'Important information',
  children,
  className = '',
}: InfoDisclaimerProps) {
  return (
    <p
      className={`inline-flex max-w-full items-start gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300 ${className}`}
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true" className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current text-[10px] font-bold">
        i
      </span>
      <span>{children}</span>
    </p>
  );
}
