'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useCurrentProperty } from '@/components/ai/CurrentPropertyContext';

const AIChatbot = dynamic(() => import('@/components/ai/AIChatbot'), { ssr: false });

export default function GlobalAIChatbot() {
  const pathname = usePathname();
  const { property } = useCurrentProperty();
  const isAnalysePage = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?analyse(?:\/|$)/.test(pathname || '');
  const pageMode = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?listings(?:\/|$)/.test(pathname || '')
    ? 'listings'
    : 'generic';

  if (isAnalysePage) return null;

  return <AIChatbot pageMode={pageMode} property={property ?? undefined} />;
}
