import chromium from '@sparticuz/chromium';
import { chromium as playwrightChromium, type Page } from 'playwright-core';

type RenderPdfOptions = {
  headers?: Record<string, string>;
};

const waitForAssets = async (page: Page) => {
  await page.waitForSelector('[data-deal-pack-root]', { state: 'visible', timeout: 20_000 });
  await page.evaluate(async () => {
    const fontSet = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fontSet?.ready) {
      await fontSet.ready;
    }

    await Promise.all(
      Array.from(document.images)
        .filter((image) => !image.complete)
        .map(
          (image) =>
            new Promise<void>((resolve) => {
              image.addEventListener('load', () => resolve(), { once: true });
              image.addEventListener('error', () => resolve(), { once: true });
            }),
        ),
    );
  });
};

export async function renderDealPackPdfFromUrl(url: string, options: RenderPdfOptions = {}): Promise<Uint8Array> {
  // Allow local/dev environments to provide a native Chrome path while Vercel/serverless uses Sparticuz Chromium.
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (await chromium.executablePath());
  const browser = await playwrightChromium.launch({
    args: chromium.args,
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 2048 },
    });
    const targetUrl = new URL(url);
    const authorisedHeaders = options.headers && Object.keys(options.headers).length > 0 ? options.headers : undefined;

    if (authorisedHeaders) {
      await page.route('**/*', async (route) => {
        const request = route.request();
        const requestUrl = new URL(request.url());

        const isAuthorisedDocumentRequest =
          request.isNavigationRequest()
          && request.resourceType() === 'document'
          && requestUrl.origin === targetUrl.origin
          && requestUrl.pathname === targetUrl.pathname;

        if (isAuthorisedDocumentRequest) {
          await route.continue({
            headers: {
              ...request.headers(),
              ...authorisedHeaders,
            },
          });
          return;
        }

        await route.continue();
      });
    }

    await page.emulateMedia({ media: 'print' });

    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
    if (!response || !response.ok()) {
      throw new Error(`Deal pack template request failed (${response?.status() ?? 'no_response'})`);
    }

    await waitForAssets(page);

    return await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '12mm',
        right: '12mm',
        bottom: '12mm',
        left: '12mm',
      },
    });
  } finally {
    await browser.close();
  }
}
