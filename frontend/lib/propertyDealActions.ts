type PropertyLike = Record<string, any> | null | undefined;

const ORIGINAL_URL_KEYS = [
  'source_url',
  'listing_url',
  'property_url',
  'external_url',
  'url',
  'link',
  'details_url',
  'rightmove_url',
  'zoopla_url',
  'onthemarket_url',
  'original_url',
  'original_listing_url',
];

const AGENT_NAME_KEYS = ['agent_name', 'branch_name', 'advertiser_name', 'agency_name', 'agent'];
const AGENT_PHONE_KEYS = ['agent_phone', 'phone', 'telephone', 'contact_phone'];
const AGENT_EMAIL_KEYS = ['agent_email', 'email', 'contact_email'];

function firstString(property: PropertyLike, keys: string[]): string | null {
  if (!property || typeof property !== 'object') return null;

  for (const key of keys) {
    const value = property[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function textIncludes(property: PropertyLike, needle: RegExp): boolean {
  const haystack = [
    firstString(property, ORIGINAL_URL_KEYS),
    firstString(property, ['source', 'portal', 'provider', 'site', 'listing_source']),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return needle.test(haystack);
}

export function getSafeExternalHref(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function getOriginalListingUrl(property: PropertyLike): string | null {
  return getSafeExternalHref(firstString(property, ORIGINAL_URL_KEYS));
}

export function getSourceLabel(property: PropertyLike): string {
  if (textIncludes(property, /rightmove/)) return 'Rightmove';
  if (textIncludes(property, /zoopla/)) return 'Zoopla';
  if (textIncludes(property, /onthemarket|on the market|\botm\b/)) return 'OnTheMarket';
  if (textIncludes(property, /openrent|open rent/)) return 'OpenRent';
  return 'Other listing';
}

export function getAgentName(property: PropertyLike): string | null {
  return firstString(property, AGENT_NAME_KEYS);
}

export function getAgentPhone(property: PropertyLike): string | null {
  return firstString(property, AGENT_PHONE_KEYS);
}

export function getAgentEmail(property: PropertyLike): string | null {
  return firstString(property, AGENT_EMAIL_KEYS);
}

function formatGBP(value: unknown): string | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatPercent(value: unknown): string | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${Math.round(n * 10) / 10}%`;
}

export function buildInvestorEnquiry(property: PropertyLike): string {
  const title = firstString(property, ['title', 'address', 'location']) ?? 'this property';
  const location = firstString(property, ['location', 'address']);
  const price = formatGBP(property?.price ?? property?.asking_price);
  const yieldValue = formatPercent(property?.yield_percent ?? property?.rental_yield_percent ?? property?.yieldPercent);
  const roiValue = formatPercent(property?.roi_percent ?? property?.roiPercent);
  const source = getSourceLabel(property);

  const subject = location && !title.includes(location) ? `${title}, ${location}` : title;
  const metrics = [
    price ? `asking price ${price}` : null,
    yieldValue ? `yield ${yieldValue}` : null,
    roiValue ? `ROI ${roiValue}` : null,
    source !== 'Other listing' ? `source ${source}` : null,
  ].filter(Boolean);

  return [
    `Hi, I’m interested in ${subject}. Is this property still available?`,
    'Could you please confirm viewing availability, tenure, any known works required, and whether offers are currently being considered?',
    metrics.length > 0
      ? `I am reviewing this as an investment opportunity (${metrics.join(', ')}) and would like to confirm the key details before arranging a viewing.`
      : 'I am reviewing this as an investment opportunity and would like to confirm the key details before arranging a viewing.',
    'Many thanks.',
  ].join(' ');
}

export function getDealActionChecklist(_property: PropertyLike): string[] {
  return [
    'Confirm the property is still available.',
    'Ask about current offers and vendor position.',
    'Confirm tenure, lease length and service charges where relevant.',
    'Ask about known works, refurb requirements or defects.',
    'Confirm rental demand / current tenancy position.',
    'Compare with latest Land Registry sold comps.',
    'Stress-test finance, voids, fees and refurb costs.',
    'Arrange viewing before making an offer.',
  ];
}
