import Image, { ImageProps } from 'next/image';

type Props = Omit<ImageProps, 'alt'> & { alt: string };

export default function ImageWithFallback({ alt, ...rest }: Props) {
  // In v2 we could add onError fallback logic; for PO2 we just enforce alt text.
  return <Image alt={alt} {...rest} />;
}
