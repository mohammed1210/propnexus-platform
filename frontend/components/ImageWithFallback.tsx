'use client';

import Image, { ImageProps } from 'next/image';
import { useState } from 'react';

interface ImageWithFallbackProps extends Omit<ImageProps, 'src'> {
  src: string | null | undefined;
  fallbackSrc?: string;
  alt: string;
}

/**
 * ImageWithFallback - A Next.js Image wrapper that automatically falls back
 * to a placeholder image when the primary source fails to load.
 *
 * This component is drop-in compatible with Next.js Image and accepts all
 * standard Image props including className, layout, sizes, etc.
 *
 * @example
 * <ImageWithFallback
 *   src={property.imageUrl}
 *   alt="Property image"
 *   fill
 *   className="object-cover"
 * />
 */
export default function ImageWithFallback({
  src,
  fallbackSrc = '/images/fallback-property.png',
  alt,
  ...props
}: ImageWithFallbackProps) {
  const [imgSrc, setImgSrc] = useState(src || fallbackSrc);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    if (!hasError && imgSrc !== fallbackSrc) {
      setHasError(true);
      setImgSrc(fallbackSrc);
    }
  };

  return (
    <Image
      {...props}
      src={imgSrc}
      alt={alt}
      onError={handleError}
    />
  );
}
