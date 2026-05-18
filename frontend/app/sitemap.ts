import { MetadataRoute } from 'next';
import { FF } from '@/lib/flags';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://propnexus-platform.vercel.app';
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/listings`, changeFrequency: 'daily', priority: 0.8 },
    ...(FF.OFF_MARKET ? [{ url: `${base}/off-market`, changeFrequency: 'weekly' as const, priority: 0.7 }] : []),
    { url: `${base}/analytics`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/pricing`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/terms`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/disclaimer`, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
