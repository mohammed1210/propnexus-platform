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
    <section
      className={`overflow-hidden rounded-[1.35rem] border border-brand-200/70 bg-white shadow-sm dark:border-brand-900/60 dark:bg-slate-950 ${className}`}
      aria-label={title}
    >
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className={
          'relative w-full overflow-hidden bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 px-4 py-3 text-left text-white md:px-5 md:py-3.5 ' +
          'transition-all hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 dark:from-brand-950 dark:via-brand-900 dark:to-brand-800'
        }
        aria-expanded={isExpanded}
        aria-controls={contentId}
      >
        <span className="pointer-events-none absolute -right-12 -top-16 h-36 w-36 rounded-full bg-white/15 blur-3xl" aria-hidden="true" />
        <span className="pointer-events-none absolute -bottom-16 left-10 h-36 w-36 rounded-full bg-emerald-300/15 blur-3xl" aria-hidden="true" />

        <span className="relative flex w-full items-center gap-3">
          {icon ? (
            <span className="shrink-0 rounded-xl border border-white/10 bg-white/10 p-0.5 shadow-sm backdrop-blur">
              {icon}
            </span>
          ) : null}

          <span className="min-w-0 flex-1">
            <span className="mb-1 inline-flex rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white/80 backdrop-blur">
              Investor section
            </span>
            <span className="block truncate text-lg font-black leading-tight tracking-tight text-white sm:text-xl">
              {title}
            </span>
            <span className="mt-0.5 block text-xs font-medium leading-4 text-white/80">
              {subtitle ?? 'Investor due diligence workspace'}
            </span>
          </span>

          {headerRight ? (
            <span className="hidden shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/10 px-2.5 py-1.5 backdrop-blur sm:flex">
              {headerRight}
            </span>
          ) : null}

          <span
            className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white shadow-sm backdrop-blur transition-transform"
            aria-hidden="true"
          >
            <FiChevronDown
              className={`h-4 w-4 transition-transform ${
                isExpanded ? 'rotate-180' : 'rotate-0'
              }`}
            />
          </span>
        </span>
      </button>

      <div
        id={contentId}
        hidden={!isExpanded}
        className="border-t border-brand-100 bg-white px-4 pb-5 dark:border-brand-900/50 dark:bg-slate-950 md:px-6 md:pb-6"
      >
        <div className="pt-5">{children}</div>
      </div>
    </section>
  );
}
