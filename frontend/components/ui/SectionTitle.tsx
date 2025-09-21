'use client';

import * as React from 'react';

type Props = {
  icon?: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  /** Optional id so a parent Section can reference it via aria-labelledby */
  id?: string;
};

export default function SectionTitle({ icon, aside, className = '', children, id }: Props) {
  return (
    <div className={`mb-3 flex items-center justify-between ${className}`}>
      <h3 id={id} className="text-lg font-semibold flex items-center gap-2 tracking-tight">
        {icon ? <span aria-hidden>{icon}</span> : null}
        <span>{children}</span>
      </h3>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  );
}
