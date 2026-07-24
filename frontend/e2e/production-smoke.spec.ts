import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const publicPropertyId = '57d1a817-17fa-461a-bde5-3bad8843e349';
const sourceUrl = 'https://example.com/manual-smoke-test';
const listingText = [
  'Guide price £250,000',
  'Estimated rent £1,400 pcm',
  '2 bedroom flat',
  '1 bathroom',
  'UB7 7AA',
  'A two bedroom flat close to transport links. Leasehold property with modern kitchen and allocated parking.',
].join('\n');

const screenshotDir = path.resolve(process.cwd(), '../docs/screenshots');

type PlanKey = 'free' | 'starter' | 'pro';
type BackendPlan = 'free' | 'pro' | 'investor';

type Credentials = {
  email: string;
  password: string;
};

const expectedBackendPlan: Record<PlanKey, BackendPlan> = {
  free: 'free',
  starter: 'pro',
  pro: 'investor',
};

const credentialEnvNames: Record<PlanKey, string> = {
  free: 'E2E_FREE_EMAIL/E2E_FREE_PASSWORD',
  starter: 'E2E_STARTER_EMAIL/E2E_STARTER_PASSWORD',
  pro: 'E2E_PRO_EMAIL/E2E_PRO_PASSWORD',
};

function getCredentials(plan: PlanKey): Credentials | null {
  const prefix = plan === 'starter' ? 'E2E_STARTER' : plan === 'pro' ? 'E2E_PRO' : 'E2E_FREE';
  const email = (process.env[`${prefix}_EMAIL`] ?? '').trim();
  const password = (process.env[`${prefix}_PASSWORD`] ?? '').trim();
  return email && password ? { email, password } : null;
}

function skipIfMissingCredentials(plan: PlanKey): Credentials {
  const credentials = getCredentials(plan);
  test.skip(!credentials, `Authenticated smoke skipped: missing ${credentialEnvNames[plan]} secrets.`);
  return credentials!;
}

async function captureScreenshot(page: Page, name: string) {
  await mkdir(screenshotDir, { recursive: true });
  await page.screenshot({
    path: path.join(screenshotDir, name),
    fullPage: true,
  });
}

async function signIn(page: Page, credentials: Credentials, redirectPath = '/analyse') {
  await page.goto(`/sign-in?redirect_url=${encodeURIComponent(redirectPath)}`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel(/email address or username/i).fill(credentials.email);
  await page.getByPlaceholder(/enter your password/i).fill(credentials.password);
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 30_000 });
}

async function confirmAuthenticatedPlan(page: Page, expectedPlan: BackendPlan) {
  const response = await page.context().request.get('/api/users/plan', {
    headers: { accept: 'application/json' },
  });
  expect(response.status()).toBe(200);
  const payload = (await response.json()) as { plan?: unknown };
  expect(payload.plan).toBe(expectedPlan);
}

async function signInAndConfirmPlan(page: Page, plan: PlanKey, redirectPath = '/analyse') {
  const credentials = skipIfMissingCredentials(plan);
  await signIn(page, credentials, redirectPath);
  await confirmAuthenticatedPlan(page, expectedBackendPlan[plan]);
}

async function fillAnalyseForm(page: Page) {
  const sourceRequests: string[] = [];
  page.on('request', (req) => {
    if (req.url().startsWith(sourceUrl)) {
      sourceRequests.push(req.url());
    }
  });

  const analyseResponse = await page.goto('/analyse', { waitUntil: 'domcontentloaded' });
  expect(analyseResponse?.ok()).toBeTruthy();

  await expect(page.getByRole('heading', { name: /analyse any uk property deal before you offer/i })).toBeVisible();
  await expect(page.getByText(/listing urls are treated as user-provided references only/i).first()).toBeVisible();
  await expect(page.getByText(/does not scrape or copy third-party listing pages in this flow/i)).toBeVisible();
  await expect(page.getByLabel(/open ai assistant/i)).toHaveCount(0);
  await expect(page.getByLabel(/ai assistant requires upgrade/i)).toHaveCount(0);

  await page.getByLabel(/listing\/source url optional/i).fill(sourceUrl);
  await page.getByLabel(/asking price/i).fill('300000');
  await page.getByLabel(/quick import text optional/i).fill(listingText);
  await page.getByRole('button', { name: /extract details/i }).click();

  await expect(page.getByText(/details extracted\. please review before analysing\./i)).toBeVisible();
  await expect(page.getByLabel(/asking price/i)).toHaveValue('300000');
  await expect(page.getByLabel(/estimated monthly rent/i)).toHaveValue('1400');
  await expect(page.getByLabel(/bedrooms/i)).toHaveValue('2');
  await expect(page.getByLabel(/bathrooms/i)).toHaveValue('1');
  await expect(page.getByLabel(/postcode/i)).toHaveValue('UB7 7AA');
  await expect(page.getByLabel(/property type/i)).toHaveValue('Flat');

  await page.getByLabel(/asking price/i).fill('');
  await page.getByRole('button', { name: /extract details/i }).click();
  await expect(page.getByLabel(/asking price/i)).toHaveValue('250000');
  expect(sourceRequests).toEqual([]);
}

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test.describe('production smoke anonymous', () => {
  test('analyse, free public Deal Pack/PDF, and pricing checks', async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 1600 });
    await fillAnalyseForm(page);
    await captureScreenshot(page, 'production-smoke-analyse-desktop.png');

    await page.getByRole('button', { name: /generate deal pack/i }).click();
    const redirectedToProperty = await page
      .waitForURL(/\/property\/[^/?#]+(?:\?.*)?$/, { timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (!redirectedToProperty) {
      await expect(page.getByText(/you must be signed in to create a deal\./i)).toBeVisible();
    }

    const propertyResponse = await request.get(`/api/properties/${publicPropertyId}`);
    expect(propertyResponse.status()).toBe(200);
    const propertyPayload = (await propertyResponse.json()) as { id?: string };
    expect(propertyPayload.id).toBe(publicPropertyId);

    await page.goto(`/property/${publicPropertyId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /quick actions/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /save this deal/i }).first()).toBeVisible();
    await captureScreenshot(page, 'production-smoke-property-desktop.png');

    const dealPackResponse = await page.goto(`/property/${publicPropertyId}/deal-pack`, { waitUntil: 'domcontentloaded' });
    expect.soft(dealPackResponse?.ok()).toBeTruthy();
    await expect.soft(page.getByText(/deal pack preview/i)).toBeVisible();
    await expect.soft(page.locator('[data-deal-pack-root]')).toHaveCount(0);
    await expect.soft(page.getByRole('button', { name: /unlock investor pro/i })).toBeVisible();
    await captureScreenshot(page, 'production-smoke-deal-pack-preview.png');

    const pdfResponse = await request.get(`/api/property-pdf/${publicPropertyId}`);
    expect.soft(pdfResponse.status()).toBe(403);
    expect.soft(pdfResponse.headers()['content-type'] || '').toContain('application/json');
    const pdfJson = (await pdfResponse.json().catch(() => null)) as { error?: string; required_plan?: string; requiredPlan?: string } | null;
    expect.soft(pdfJson?.error).toBe('upgrade_required');
    expect.soft(pdfJson?.required_plan ?? pdfJson?.requiredPlan).toMatch(/investor/i);

    const pricingResponse = await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    expect(pricingResponse?.ok()).toBeTruthy();
    await expect(page.getByRole('heading', { name: 'Free' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Investor Starter' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Investor Pro' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sourcer Pro' })).toBeVisible();
    await expect(page.getByText('£0').first()).toBeVisible();
    await expect(page.getByText('£9').first()).toBeVisible();
    await expect(page.getByText('£19').first()).toBeVisible();
    await expect(page.getByText('£39').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /coming soon/i })).toBeVisible();
    await captureScreenshot(page, 'production-smoke-pricing.png');
  });

  test('mobile analyse layout keeps the intake unobstructed', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const response = await page.goto('/analyse', { waitUntil: 'domcontentloaded' });
    expect(response?.ok()).toBeTruthy();

    const quickImport = page.getByLabel(/quick import text optional/i);
    const notes = page.getByLabel(/notes\/description/i);
    const submit = page.getByRole('button', { name: /generate deal pack/i });

    await expect(quickImport).toBeVisible();
    await expect(notes).toBeVisible();
    await expect(submit).toBeVisible();
    await expect(page.getByLabel(/open ai assistant/i)).toHaveCount(0);
    await expect(page.getByLabel(/ai assistant requires upgrade/i)).toHaveCount(0);

    await captureScreenshot(page, 'production-smoke-analyse-mobile.png');
  });
});

test.describe('production smoke authenticated', () => {
  test('free account can submit analyse flow but remains locked out of Deal Pack and PDF', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1600 });
    await signInAndConfirmPlan(page, 'free', '/analyse');
    await fillAnalyseForm(page);

    await page.getByRole('button', { name: /generate deal pack/i }).click();
    await page.waitForURL(/\/property\/[^/?#]+(?:\?.*)?$/, { timeout: 30_000 });
    const propertyId = page.url().split('/').filter(Boolean).at(-1);
    expect(propertyId).toBeTruthy();

    await expect(page.getByRole('heading', { name: /quick actions/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('body')).toContainText(/manual-smoke-test|example\.com|source/i);

    await page.goto(`/property/${propertyId}/deal-pack`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/deal pack preview/i)).toBeVisible();
    await expect(page.locator('[data-deal-pack-root]')).toHaveCount(0);

    const pdfResponse = await page.context().request.get(`/api/property-pdf/${propertyId}`);
    expect(pdfResponse.status()).toBe(403);
  });

  test('starter account keeps full Deal Pack and PDF locked', async ({ page }) => {
    await signInAndConfirmPlan(page, 'starter', `/property/${publicPropertyId}`);
    await page.goto(`/property/${publicPropertyId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toContainText(/offer range preview|starter offer range|unlock investor pro/i);

    await page.goto(`/property/${publicPropertyId}/deal-pack`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/deal pack preview/i)).toBeVisible();
    await expect(page.locator('[data-deal-pack-root]')).toHaveCount(0);

    const pdfResponse = await page.context().request.get(`/api/property-pdf/${publicPropertyId}`);
    expect(pdfResponse.status()).toBe(403);
  });

  test('pro account can open the full Deal Pack and download PDF', async ({ page }) => {
    await signInAndConfirmPlan(page, 'pro', `/property/${publicPropertyId}`);

    await page.goto(`/property/${publicPropertyId}/deal-pack`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-deal-pack-root]')).toBeVisible({ timeout: 30_000 });

    const pdfResponse = await page.context().request.get(`/api/property-pdf/${publicPropertyId}`);
    expect(pdfResponse.status()).toBe(200);
    expect(pdfResponse.headers()['content-type'] || '').toContain('application/pdf');
  });
});
