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
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all duration-200 ' +
  'focus:outline-none focus:ring-2 focus:ring-offset-1 ' +
  'disabled:opacity-60 disabled:cursor-not-allowed ' +
  'dark:focus:ring-offset-zinc-900';

const byVariant: Record<Variant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-600 dark:bg-blue-500 dark:hover:bg-blue-600',
  secondary:
    'border border-zinc-300 text-zinc-800 hover:bg-zinc-50 ' +
    'dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800 ' +
    'focus:ring-zinc-400 dark:focus:ring-zinc-600',
  ghost:
    'text-zinc-700 hover:bg-zinc-100 ' +
    'dark:text-zinc-200 dark:hover:bg-zinc-800 ' +
    'focus:ring-zinc-400 dark:focus:ring-zinc-600',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-600 dark:bg-red-500 dark:hover:bg-red-600',
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
