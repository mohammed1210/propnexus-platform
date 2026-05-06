'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  imageUrls: string[];
  fallbackImageUrl?: string;
  placeholderSrc?: string;
  title?: string;
};

function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const t = (u || '').trim();
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export default function ImageGallery({
  imageUrls,
  fallbackImageUrl,
  placeholderSrc = '/placeholder.jpg',
  title,
}: Props) {
  const carouselImages = useMemo(() => {
    const list = [...(Array.isArray(imageUrls) ? imageUrls : []), ...(fallbackImageUrl ? [fallbackImageUrl] : [])];
    return dedupeUrls(list);
  }, [imageUrls, fallbackImageUrl]);

  const hasAnyPhoto = carouselImages.length > 0;
  const displayImages = useMemo(
    () => (carouselImages.length > 0 ? carouselImages : [placeholderSrc]),
    [carouselImages, placeholderSrc],
  );

  const [mainImage, setMainImage] = useState<string>(displayImages[0] || placeholderSrc);

  useEffect(() => {
    const first = displayImages[0] || placeholderSrc;
    setMainImage((prev) => (displayImages.includes(prev) ? prev : first));
  }, [displayImages, placeholderSrc]);

  const currentIndex = useMemo(() => {
    const idx = displayImages.findIndex((u) => u === mainImage);
    return idx >= 0 ? idx : 0;
  }, [displayImages, mainImage]);

  const canNavigate = hasAnyPhoto && displayImages.length > 1;

  const goPrev = () => {
    if (!canNavigate) return;
    const len = displayImages.length;
    const next = (currentIndex - 1 + len) % len;
    setMainImage(displayImages[next] ?? displayImages[0] ?? placeholderSrc);
  };

  const goNext = () => {
    if (!canNavigate) return;
    const len = displayImages.length;
    const next = (currentIndex + 1) % len;
    setMainImage(displayImages[next] ?? displayImages[0] ?? placeholderSrc);
  };

  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeHandledRef = useRef(false);

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!canNavigate) return;
    // Only react to primary pointer.
    if (e.isPrimary === false) return;
    swipeHandledRef.current = false;
    swipeStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!canNavigate) return;
    const start = swipeStartRef.current;
    if (!start || swipeHandledRef.current) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

    // Prefer horizontal intent; keep scroll working.
    if (Math.abs(dx) < 40) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.3) return;

    swipeHandledRef.current = true;
    swipeStartRef.current = null;

    if (dx > 0) goPrev();
    else goNext();
  };

  const onPointerUp: React.PointerEventHandler<HTMLDivElement> = () => {
    swipeStartRef.current = null;
    swipeHandledRef.current = false;
  };

  return (
    <>
      <div
        className="aspect-[2/1] bg-slate-100 dark:bg-slate-900 relative"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <Image
          src={mainImage}
          alt={title ? String(title) : 'Property image'}
          fill
          sizes="100vw"
          className="object-cover"
          unoptimized
          onError={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            if (img.src.endsWith(placeholderSrc)) return;
            img.src = placeholderSrc;
            setMainImage(placeholderSrc);
          }}
        />

        {canNavigate ? (
          <>
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/90 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-200/70 dark:border-slate-800/70 flex items-center justify-center hover:bg-white transition-colors"
              aria-label="Previous image"
            >
              <span className="text-xl leading-none">‹</span>
            </button>
            <button
              type="button"
              onClick={goNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/90 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-200/70 dark:border-slate-800/70 flex items-center justify-center hover:bg-white transition-colors"
              aria-label="Next image"
            >
              <span className="text-xl leading-none">›</span>
            </button>
          </>
        ) : null}

        {!hasAnyPhoto ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="px-3 py-1.5 rounded-lg bg-white/90 dark:bg-slate-900/80 backdrop-blur-sm text-sm font-semibold text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-slate-800/70">
              No photos available
            </div>
          </div>
        ) : null}

        {hasAnyPhoto ? (
          <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-lg bg-white/90 backdrop-blur-sm text-sm font-semibold text-slate-900">
            {currentIndex + 1} / {displayImages.length}
          </div>
        ) : null}

        {canNavigate && displayImages.length <= 8 ? (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/70 dark:border-slate-800/70">
            {displayImages.map((u, idx) => {
              const active = idx === currentIndex;
              return (
                <button
                  key={`${u}-${idx}`}
                  type="button"
                  onClick={() => setMainImage(u)}
                  className={
                    active
                      ? 'h-2.5 w-2.5 rounded-full bg-brand-500'
                      : 'h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-600 hover:bg-slate-400'
                  }
                  aria-label={`Go to image ${idx + 1}`}
                  aria-current={active ? 'true' : undefined}
                />
              );
            })}
          </div>
        ) : null}
      </div>

      {hasAnyPhoto && displayImages.length > 1 ? (
        <div className="p-3 border-t border-slate-200 dark:border-slate-800">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {displayImages.map((u, idx) => {
              const selected = u === mainImage;
              return (
                <button
                  key={`${u}-${idx}`}
                  type="button"
                  onClick={() => setMainImage(u)}
                  className={`shrink-0 rounded-lg overflow-hidden border transition-colors ${
                    selected
                      ? 'border-brand-500 ring-2 ring-brand-500/30'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                  aria-label={`View image ${idx + 1}`}
                >
                  <Image
                    src={u}
                    alt={`Thumbnail ${idx + 1}`}
                    width={80}
                    height={64}
                    className="w-20 h-16 object-cover"
                    unoptimized
                    onError={(e) => {
                      const img = e.currentTarget as HTMLImageElement;
                      if (img.src.endsWith(placeholderSrc)) return;
                      img.src = placeholderSrc;
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </>
  );
}
