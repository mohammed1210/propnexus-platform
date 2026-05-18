import type { ReactNode } from 'react';

type LegalNoticeProps = {
  title?: string;
  children?: ReactNode;
  variant?: 'subtle' | 'warning' | 'compact';
  className?: string;
};

const variantClasses: Record<NonNullable<LegalNoticeProps['variant']>, string> = {
  subtle:
    'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300',
  warning:
    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100',
  compact:
    'border-slate-200 bg-white/70 text-slate-600 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-300',
};

export default function LegalNotice({
  title,
  children,
  variant = 'subtle',
  className = '',
}: LegalNoticeProps) {
  if (!title && !children) return null;

  const compact = variant === 'compact';

  return (
    <aside
      className={`rounded-xl border ${compact ? 'px-3 py-2 text-xs' : 'p-4 text-sm'} ${variantClasses[variant]} ${className}`}
      aria-label={title || 'Important information'}
    >
      {title ? (
        <div className={`${compact ? 'text-[11px]' : 'text-xs'} font-semibold uppercase tracking-[0.14em]`}>
          {title}
        </div>
      ) : null}
      {children ? <div className={title ? 'mt-1 leading-relaxed' : 'leading-relaxed'}>{children}</div> : null}
    </aside>
  );
}
