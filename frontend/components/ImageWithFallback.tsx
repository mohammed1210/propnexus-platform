'use client';

import Image from 'next/image';
import { useState } from 'react';

type Props = {
  src: string;
  alt?: string;
  fallbackSrc?: string;
  width?: number;
  height?: number;
  className?: string;
};

export default function ImageWithFallback({
  src,
  alt = '',
  fallbackSrc = '/placeholder.png',
  width = 600,
  height = 400,
  className,
}: Props) {
  const [error, setError] = useState(false);

  return (
    <Image
      src={error ? fallbackSrc : src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      onError={() => setError(true)}
    />
  );
}
