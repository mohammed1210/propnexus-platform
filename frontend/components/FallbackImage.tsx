import Image, { ImageProps } from 'next/image';
import { useState } from 'react';

type Props = Omit<ImageProps, 'src' | 'alt'> & {
  src?: string | null;
  alt: string;
};

export default function FallbackImage({ src, alt, ...rest }: Props) {
  const [err, setErr] = useState(false);
  const finalSrc = !err && src ? src : '/placeholder.jpg';
  return <Image src={finalSrc} alt={alt} onError={() => setErr(true)} {...rest} />;
}
