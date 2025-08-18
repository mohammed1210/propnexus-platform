'use client';

import * as React from 'react';

type Props = {
  icon?: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

/**
 * Consistent section header row with optional left icon and right-side content.
 */
export default function SectionTitle({ icon, aside, className = '', children }: Props) {
  return (
    <div className={`mb-3 flex items-center justify-between ${className}`}>
      <h3 className="text-lg font-semibold flex items-center gap-2 tracking-tight">
        {icon ? <span>{icon}</span> : null}
        <span>{children}</span>
      </h3>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  );
}