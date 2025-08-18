'use client';
import React from 'react';

type Props = React.HTMLAttributes<HTMLDivElement> & {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  dense?: boolean;     // tighter padding when true
};

export default function Section({ title, subtitle, dense, className = '', children, ...rest }: Props) {
  return (
    <section
      className={[
        'rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm',
        dense ? 'p-4' : 'p-5',
        className,
      ].join(' ')}
      {...rest}
    >
      {(title || subtitle) && (
        <header className="mb-3">
          {title && <h3 className="text-lg font-semibold">{title}</h3>}
          {subtitle && <p className="text-sm text-neutral-500 mt-0.5">{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  );
}
