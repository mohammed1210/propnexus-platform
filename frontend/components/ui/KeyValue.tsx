'use client';

import * as React from 'react';

type Props = {
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
};

/**
 * Two-column label/value row for summaries.
 */
export default function KeyValue({ label, value, className = '' }: Props) {
  return (
    <div className={`grid grid-cols-12 items-baseline gap-3 ${className}`}>
      <div className="col-span-5 text-slate-500">{label}</div>
      <div className="col-span-7 font-medium">{value}</div>
    </div>
  );
}