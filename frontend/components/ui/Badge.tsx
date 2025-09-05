'use client';

import * as React from 'react';

type Variant = 'neutral' | 'success' | 'warning' | 'info';
type Props = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant;
};

export default function Badge({ variant = 'neutral', className = '', children, ...rest }: Props) {
  const styles: Record<Variant, string> = {
    neutral: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}