'use client';

import Image from 'next/image';

interface GalleryImageProps {
  src: string;
  alt: string;
  title: string;
  description: string;
}

export function GalleryImage({ src, alt, title, description }: GalleryImageProps) {
  return (
    <div className="card p-0 overflow-hidden group">
      <div className="relative w-full aspect-[4/3] bg-slate-100 dark:bg-slate-800/80 p-3 sm:p-4">
        <Image
          src={src}
          alt={alt}
          fill
          style={{ objectFit: 'contain' }}
          className="transition-transform duration-300 group-hover:scale-[1.02] p-3 sm:p-4"
          loading="lazy"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/placeholder.jpg';
          }}
        />
      </div>
      <div className="p-6 space-y-2">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
          {title}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {description}
        </p>
      </div>
    </div>
  );
}
