'use client';

import { ReactNode, useId, useState } from 'react';
import { FiChevronDown } from 'react-icons/fi';

interface CollapsibleCardProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
  className?: string;
}

export default function CollapsibleCard({
  title,
  subtitle,
  icon,
  headerRight,
  children,
  defaultExpanded = true,
  className = '',
}: CollapsibleCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const contentId = useId();

  return (
    <section className={`card p-0 overflow-hidden ${className}`} aria-label={title}>
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className={
          'w-full flex items-center gap-3 px-6 py-4 text-left ' +
          'hover:bg-black/5 dark:hover:bg-white/5 transition-colors ' +
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
        }
        aria-expanded={isExpanded}
        aria-controls={contentId}
      >
        {icon ? <span className="shrink-0">{icon}</span> : null}
        <span className="flex-1 min-w-0">
          <span className="block text-base sm:text-lg font-semibold text-slate-900 dark:text-white truncate">
            {title}
          </span>
          <span className="block text-xs text-slate-600 dark:text-slate-400">
            {subtitle ?? (isExpanded ? 'Click to collapse' : 'Click to expand')}
          </span>
        </span>

        {headerRight ? <span className="shrink-0 flex items-center gap-2">{headerRight}</span> : null}

        <span
          className={
            'shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-lg ' +
            'border border-slate-200/80 dark:border-slate-800/80 ' +
            'bg-white/60 dark:bg-slate-900/40 backdrop-blur-sm'
          }
          aria-hidden="true"
        >
          <FiChevronDown
            className={`h-5 w-5 text-slate-700 dark:text-slate-300 transition-transform ${
              isExpanded ? 'rotate-180' : 'rotate-0'
            }`}
          />
        </span>
      </button>

      <div
        id={contentId}
        hidden={!isExpanded}
        className="border-t border-slate-200/70 dark:border-slate-800/70 px-6 pb-6"
      >
        <div className="pt-5">{children}</div>
      </div>
    </section>
  );
}
