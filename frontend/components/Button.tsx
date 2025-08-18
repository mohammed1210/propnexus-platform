'use client';

import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
};

const base =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed';

const byVariant: Record<Variant, string> = {
  primary:
    'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-600 dark:focus:ring-offset-neutral-900',
  secondary:
    'border border-neutral-300 text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800 focus:ring-neutral-400 dark:focus:ring-neutral-600',
  ghost:
    'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800 focus:ring-neutral-400 dark:focus:ring-neutral-600',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus:ring-red-600 dark:focus:ring-offset-neutral-900',
};

const bySize: Record<Size, string> = {
  sm: 'text-sm px-3 py-1.5',
  md: 'text-sm px-3.5 py-2',
  lg: 'text-base px-4 py-2.5',
};

export default function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  leadingIcon,
  trailingIcon,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={[
        base,
        byVariant[variant],
        bySize[size],
        'focus:ring-offset-1',
        className,
      ].join(' ')}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <>
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
          <span>Working…</span>
        </>
      ) : (
        <>
          {leadingIcon ? <span aria-hidden>{leadingIcon}</span> : null}
          <span>{children}</span>
          {trailingIcon ? <span aria-hidden>{trailingIcon}</span> : null}
        </>
      )}
    </button>
  );
}
