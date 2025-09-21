'use client';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ToastKind = 'success' | 'error' | 'info';
type Toast = { id: number; kind: ToastKind; message: string; duration?: number };

const ToastCtx = createContext<{
  push: (message: string, kind?: ToastKind, durationMs?: number) => void;
} | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx.push;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const push = useCallback((message: string, kind: ToastKind = 'info', durationMs = 2800) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, kind, message, duration: durationMs }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, durationMs);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      {/* presenter */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[1000] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            className={[
              'pointer-events-auto w-full max-w-sm rounded-xl border px-4 py-3 shadow-md backdrop-blur',
              'bg-white/90 dark:bg-zinc-900/90',
              'border-zinc-200 dark:border-zinc-800',
              t.kind === 'success' ? 'ring-1 ring-emerald-400/30' :
              t.kind === 'error'   ? 'ring-1 ring-rose-400/30'    :
                                     'ring-1 ring-indigo-400/25',
            ].join(' ')}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <span className={[
                'mt-0.5 inline-flex h-2.5 w-2.5 shrink-0 rounded-full',
                t.kind === 'success' ? 'bg-emerald-500' :
                t.kind === 'error'   ? 'bg-rose-500'    :
                                       'bg-indigo-500',
              ].join(' ')} />
              <p className="text-sm">{t.message}</p>
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
