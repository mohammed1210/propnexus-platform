'use client';

import * as React from 'react';

type Props = React.HTMLAttributes<HTMLElement> & {
  className?: string;
  as?: 'section' | 'div' | 'article';
};

export default function Section({ as = 'section', className = '', children, ...rest }: Props) {
  const Comp = as as any;
  const base =
    'rounded-xl border border-zinc-200 dark:border-zinc-700 ' +
    'bg-white dark:bg-zinc-900 p-4 md:p-5 shadow-sm transition-colors duration-200';
  return (
    <Comp className={`${base} ${className}`} {...rest}>
      {children}
    </Comp>
  );
}
