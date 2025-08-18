'use client';

import * as React from 'react';

type Props = React.HTMLAttributes<HTMLDivElement> & {
  align?: 'left' | 'right' | 'between';
};

/**
 * Consistent actions row used inside cards/sections.
 * Handles wrapping on small screens and spacing between buttons.
 */
export default function CardActions({
  align = 'left',
  className = '',
  children,
  ...rest
}: Props) {
  const justify =
    align === 'right' ? 'justify-end' : align === 'between' ? 'justify-between' : 'justify-start';
  return (
    <div
      className={`mt-2 flex flex-wrap ${justify} gap-2 sm:gap-3 items-center ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}