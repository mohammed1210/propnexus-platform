// frontend/components/ui/UiOverlaysClient.tsx
'use client';

import { useEffect } from 'react';

export default function UiOverlaysClient() {
  useEffect(() => {
    const body = document.body;
    let locks = 0;
    const lock = () => {
      if (!locks++) body.style.overflow = 'hidden';
    };
    const unlock = () => {
      if (locks && !--locks) body.style.overflow = '';
    };

    const openSel = (sel: string | null) => {
      if (!sel) return;
      const el = document.querySelector<HTMLElement>(sel);
      if (!el) return;
      el.dataset.open = 'true';
      lock();
      el.querySelector<HTMLElement>(
        'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
      )?.focus();
    };
    const closeEl = (el: Element | null) => {
      if (!el) return;
      (el as HTMLElement).dataset.open = 'false';
      unlock();
    };

    const click = (e: MouseEvent) => {
      const t = e.target as Element;
      if (t.matches('[data-modal-open]')) {
        e.preventDefault();
        openSel(t.getAttribute('data-modal-open'));
      }
      if (t.matches('[data-modal-close]')) {
        e.preventDefault();
        closeEl(t.closest('.pnx-modal'));
      }
      if (t.matches('[data-panel-open]')) {
        e.preventDefault();
        openSel(t.getAttribute('data-panel-open'));
        openSel(t.getAttribute('data-panel-overlay'));
      }
      if (t.matches('[data-panel-close]')) {
        e.preventDefault();
        closeEl(t.closest('.pnx-panel'));
        closeEl(document.querySelector('.pnx-panel-overlay[data-open="true"]'));
      }
      // backdrop click closes modal
      const modal = t.closest('.pnx-modal');
      const surface = t.closest('.pnx-modal__surface');
      if (modal && !surface) closeEl(modal);
    };

    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      document
        .querySelectorAll(
          '.pnx-modal[data-open="true"], .pnx-panel[data-open="true"], .pnx-panel-overlay[data-open="true"]',
        )
        .forEach(closeEl);
    };

    document.addEventListener('click', click);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('click', click);
      document.removeEventListener('keydown', key);
    };
  }, []);

  return null;
}
