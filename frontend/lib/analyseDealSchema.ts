import { z } from 'zod';

function textOrUndefined(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : Number.NaN;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }
  return Number.NaN;
}

export const analysePropertyTypeOptions = [
  'Flat',
  'Terraced',
  'Semi-detached',
  'Detached',
  'Bungalow',
  'Maisonette',
  'Studio',
  'Mixed use',
  'Commercial',
  'Land',
] as const;

export const analyseDealSchema = z.object({
  sourceUrl: z
    .preprocess(textOrUndefined, z.string().url('Enter a valid http(s) URL.').max(2048).optional()),
  title: z.preprocess(textOrUndefined, z.string().max(240).optional()),
  location: z.preprocess(textOrUndefined, z.string().max(240).optional()),
  postcode: z.preprocess(textOrUndefined, z.string().max(24).optional()),
  price: z.preprocess(
    numberOrUndefined,
    z.number().finite('Enter a valid asking price.').positive('Asking price must be greater than zero.').max(100000000),
  ),
  bedrooms: z.preprocess(numberOrUndefined, z.number().int('Bedrooms must be a whole number.').min(0).max(50).optional()),
  bathrooms: z.preprocess(numberOrUndefined, z.number().int('Bathrooms must be a whole number.').min(0).max(50).optional()),
  propertyType: z.preprocess(textOrUndefined, z.string().max(80).optional()),
  estimatedMonthlyRent: z.preprocess(
    numberOrUndefined,
    z.number().finite('Enter a valid monthly rent.').min(0).max(1000000).optional(),
  ),
  description: z.preprocess(textOrUndefined, z.string().max(4000).optional()),
}).superRefine((value, ctx) => {
  if (!value.location && !value.postcode) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['location'],
      message: 'Add an address/location or a postcode.',
    });
  }
});

export type AnalyseDealInput = z.infer<typeof analyseDealSchema>;
