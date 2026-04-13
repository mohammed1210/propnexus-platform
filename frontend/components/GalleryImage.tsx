'use client';

import Image from 'next/image';

interface GalleryImageProps {
  index?: number;
  layout?: 'default' | 'reverse';
  src: string;
  alt: string;
  title: string;
  description: string;
  eyebrow?: string;
}

export function GalleryImage({
  index,
  layout = 'default',
  src,
  alt,
  title,
  description,
  eyebrow = 'Product Walkthrough',
}: GalleryImageProps) {
  const imageOrderClass = layout === 'reverse' ? 'lg:order-2' : 'lg:order-1';
  const contentOrderClass = layout === 'reverse' ? 'lg:order-1' : 'lg:order-2';
  const imageBorderClass = layout === 'reverse' ? 'lg:border-l' : 'lg:border-r';

  return (
    <article className="card overflow-hidden border-slate-200/80 bg-white/95 group dark:border-slate-800/80 dark:bg-slate-950/70">
      <div className="grid lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.85fr)]">
        <div className={`${imageOrderClass} ${imageBorderClass} border-b border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_18rem),linear-gradient(180deg,rgba(15,23,42,0.04),rgba(15,23,42,0.02))] p-4 dark:border-slate-800/80 dark:bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.14),transparent_18rem),linear-gradient(180deg,rgba(15,23,42,0.7),rgba(15,23,42,0.45))] lg:border-b-0`}>
          <div className="relative overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-slate-950 shadow-[0_24px_80px_rgba(15,23,42,0.18)] dark:border-white/10">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between border-b border-white/10 bg-slate-950/80 px-4 py-3 backdrop-blur">
              <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200">
                Real Product View
              </span>
              <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-300">
                Live capture
              </span>
            </div>
            <div className="relative aspect-[16/10] w-full bg-slate-950">
              <Image
                src={src}
                alt={alt}
                fill
                sizes="(max-width: 1023px) 100vw, 60vw"
                className="object-contain object-top transition-transform duration-300 group-hover:scale-[1.015]"
                loading="lazy"
              />
            </div>
          </div>
        </div>
        <div className={`${contentOrderClass} flex flex-col justify-center gap-5 p-6 sm:p-8 lg:p-10`}>
          <div className="space-y-3">
            <div className="inline-flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                {String(index ?? 0).padStart(2, '0')}
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                {eyebrow}
              </span>
            </div>
            <h3 className="text-2xl font-semibold text-slate-900 dark:text-white sm:text-3xl">
              {title}
            </h3>
            <p className="text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">
              {description}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-5 py-4 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
            These are direct captures from the live interface, shown larger here so the scoring, calculators, and local intelligence are readable at a glance.
          </div>
        </div>
      </div>
    </article>
  );
}
