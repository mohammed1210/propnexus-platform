'use client';

import React, { forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  /** Make the button span the full width of its container (optional) */
  block?: boolean;
};

const base =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors ' +
  'focus:outline-none focus:ring-2 focus:ring-offset-1 ' +
  'disabled:opacity-60 disabled:cursor-not-allowed ' +
  'dark:focus:ring-offset-neutral-900';

const byVariant: Record<Variant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-600',
  secondary:
    'border border-neutral-300 text-neutral-800 hover:bg-neutral-50 ' +
    'dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800 ' +
    'focus:ring-neutral-400 dark:focus:ring-neutral-600',
  ghost:
    'text-neutral-700 hover:bg-neutral-100 ' +
    'dark:text-neutral-200 dark:hover:bg-neutral-800 ' +
    'focus:ring-neutral-400 dark:focus:ring-neutral-600',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-600',
};

const bySize: Record<Size, string> = {
  sm: 'text-sm px-3 py-1.5',
  md: 'text-sm px-3.5 py-2',
  lg: 'text-base px-4 py-2.5',
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    leadingIcon,
    trailingIcon,
    className = '',
    children,
    block = false,
    type, // we’ll default it below
    disabled,
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cx(base, byVariant[variant], bySize[size], block && 'w-full', className)}
      aria-busy={loading || undefined}
      aria-disabled={isDisabled || undefined}
      disabled={isDisabled}
      {...rest}
    >
      {loading ? (
        <>
          <span
            aria-hidden
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
          />
          <span className="sr-only">Working…</span>
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
});

export default Button;
