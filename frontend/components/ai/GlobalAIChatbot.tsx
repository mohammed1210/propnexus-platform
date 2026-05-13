'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useCurrentProperty } from '@/components/ai/CurrentPropertyContext';

const AIChatbot = dynamic(() => import('@/components/ai/AIChatbot'), { ssr: false });

export default function GlobalAIChatbot() {
  const pathname = usePathname();
  const { property } = useCurrentProperty();
  const pageMode = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?listings(?:\/|$)/.test(pathname || '')
    ? 'listings'
    : 'generic';

  return <AIChatbot pageMode={pageMode} property={property ?? undefined} />;
}
