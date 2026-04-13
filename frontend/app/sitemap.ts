import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://propnexus-platform.vercel.app';
  const routes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/listings`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/saved`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${base}/saved-deals`, changeFrequency: 'daily', priority: 0.2 },
    ...(process.env.NEXT_PUBLIC_FEATURE_OFF_MARKET === 'true'
      ? [{ url: `${base}/off-market`, changeFrequency: 'weekly' as const, priority: 0.7 }]
      : []),
    { url: `${base}/analytics`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/pricing`, changeFrequency: 'monthly', priority: 0.5 },
  ];

  return routes;
}
