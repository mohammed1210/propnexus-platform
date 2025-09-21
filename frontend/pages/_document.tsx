import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="theme-color" content="#2563eb" />
        <meta name="color-scheme" content="light dark" />
        <meta name="description" content="PropNexus — find, analyse, and compare UK property deals." />
        <link rel="icon" href="/favicon.ico" />
        {/* OG basics */}
        <meta property="og:site_name" content="PropNexus" />
        <meta property="og:type" content="website" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
