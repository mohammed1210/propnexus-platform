import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://propnexus-platform.vercel.app';
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/admin/',
        '/account/',
        '/saved/',
        '/saved-deals/',
        '/preview/',
        '/demo/',
        '/auth/',
        '/magic-login/',
        '/sign-in',
        '/sign-up',
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
