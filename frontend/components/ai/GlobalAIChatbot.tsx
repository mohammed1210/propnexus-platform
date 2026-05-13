'use client';

import dynamic from 'next/dynamic';

const AIChatbot = dynamic(() => import('@/components/ai/AIChatbot'), { ssr: false });

export default function GlobalAIChatbot() {
  return <AIChatbot />;
}
