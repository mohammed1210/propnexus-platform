const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

const PRIVATE_HOST_PATTERNS = [/^127\./, /^10\./, /^192\.168\./];
const PRIVATE_IPV6_PATTERNS = [/^fc/i, /^fd/i, /^fe80/i];
const ALLOWED_IMAGE_HOST_SUFFIXES = [
  'example.com',
  'rightmove.co.uk',
  'zoopla.co.uk',
  'zoocdn.com',
  'cloudfront.net',
  'amazonaws.com',
  'cloudinary.com',
  'imgix.net',
] as const;

export const PDF_IMAGE_PROXY_PATH = '/api/pdf-image';

/**
 * Returns true when a hostname clearly points at loopback, local-network, or link-local space.
 * The proxy uses this to avoid turning arbitrary listing URLs into internal-network fetches.
 */
export const isPrivateImageHost = (hostname: string): boolean => {
  const normalized = hostname.toLowerCase();
  if (
    normalized === 'localhost' ||
    normalized === '0.0.0.0' ||
    normalized === '::1' ||
    normalized.endsWith('.local')
  ) {
    return true;
  }

  if (PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  const private172 = normalized.match(/^172\.(\d{1,3})\./);
  if (private172) {
    const secondOctet = Number(private172[1]);
    if (secondOctet >= 16 && secondOctet <= 31) return true;
  }

  return PRIVATE_IPV6_PATTERNS.some((pattern) => pattern.test(normalized));
};

/**
 * Flags URLs that should never be proxied for PDF image export.
 * Only public HTTP(S) URLs are allowed by default; same-origin private hosts are permitted
 * when `allowedOrigin` matches the URL origin.
 */
export const isUnsafePdfImageUrl = (url: URL, allowedOrigin?: string): boolean => {
  if (!HTTP_PROTOCOLS.has(url.protocol) || url.username || url.password) {
    return true;
  }
  if (!url.hostname) {
    return true;
  }
  if (!isPrivateImageHost(url.hostname)) {
    return false;
  }
  return url.origin !== allowedOrigin;
};

/**
 * Returns a normalized host when the image source belongs to an allowed public host family.
 * Unknown hosts fall back to direct browser fetches instead of server-side proxying.
 */
export const getAllowedPdfImageHost = (hostname: string): string | null => {
  const normalized = hostname.toLowerCase();
  if (!normalized || isPrivateImageHost(normalized)) {
    return null;
  }

  return ALLOWED_IMAGE_HOST_SUFFIXES.some(
    (suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`),
  )
    ? normalized
    : null;
};

/**
 * Builds the same-origin proxy path used by the browser-side PDF exporter.
 */
export const buildPdfImageProxyPath = (targetUrl: string): string => {
  const parsed = new URL(targetUrl);
  const host = getAllowedPdfImageHost(parsed.hostname);
  if (!host || !HTTP_PROTOCOLS.has(parsed.protocol) || parsed.port) {
    return '';
  }

  const path = `${parsed.pathname}${parsed.search}`;
  return `${PDF_IMAGE_PROXY_PATH}?host=${encodeURIComponent(host)}&protocol=${encodeURIComponent(
    parsed.protocol,
  )}&path=${encodeURIComponent(path)}`;
};
