'use client';

import * as React from 'react';

type Props = React.HTMLAttributes<HTMLElement> & {
  className?: string;
  as?: 'section' | 'div' | 'article';
};

export default function Section({ as = 'section', className = '', children, ...rest }: Props) {
  const Comp = as as any;
  const base =
    'rounded-xl border border-neutral-200 dark:border-neutral-800 ' +
    'bg-white dark:bg-neutral-900 p-4 md:p-5 shadow-sm';
  return (
    <Comp className={`${base} ${className}`} {...rest}>
      {children}
    </Comp>
  );
}