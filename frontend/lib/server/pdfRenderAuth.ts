import { timingSafeEqual } from 'node:crypto';

export const PDF_RENDER_TOKEN_HEADER = 'X-PropNexus-PDF-Render-Token';

export function getPdfRenderToken(): string | null {
  return (process.env.PROPNEXUS_INTERNAL_API_TOKEN ?? '').trim() || null;
}

export function hasValidPdfRenderToken(value: string | null): boolean {
  const expected = getPdfRenderToken();
  if (!expected || !value) return false;

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(value);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function redactPdfRenderToken(message: string): string {
  const token = getPdfRenderToken();
  if (!token || !message.includes(token)) return message;

  return message.split(token).join('[redacted]');
}
