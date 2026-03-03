import { type FC, type ReactNode } from 'react';

const icons: Record<string, ReactNode> = {
  rightmove: (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
      <path d="M12 2L2 13h3v9h6v-6h2v6h6v-9h3z" />
    </svg>
  ),
  zoopla: (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),
  onthemarket: (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
      <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" />
    </svg>
  ),
  floorplan: (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 stroke-current fill-none" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 4v7h11" />
    </svg>
  ),
  'agent-photo': (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 stroke-current fill-none" aria-hidden="true">
      <circle cx="12" cy="8" r="3" />
      <path d="M4 20c1-4 15-4 16 0" />
    </svg>
  ),
};

export const Badge: FC<{ id: string }> = ({ id }) => (
  <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
    {icons[id] ?? null}
    {id.replace(/-/g, ' ')}
  </span>
);
