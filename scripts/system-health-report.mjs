import fs from 'node:fs/promises';

const FRONTEND_URL = process.env.FRONTEND_URL || '';
const BACKEND_URL = process.env.BACKEND_URL || '';

async function ping(url) {
  if (!url) return { url, ok: false, status: 0, err: 'missing url' };
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    return { url, ok: res.ok, status: res.status, body };
  } catch (err) {
    return { url, ok: false, status: 0, err: String(err) };
  }
}

const now = new Date().toISOString();
const fe = await ping(`${FRONTEND_URL.replace(/\/$/, '')}/api/health`);
const be = await ping(`${BACKEND_URL.replace(/\/$/, '')}/health`);

const md = `# PropNexus System Health Report
Generated: ${now}

## Frontend
- URL: ${fe.url}
- Status: ${fe.status}
- OK: ${fe.ok}
- Body: \`${JSON.stringify(fe.body)}\`

## Backend
- URL: ${be.url}
- Status: ${be.status}
- OK: ${be.ok}
- Body: \`${JSON.stringify(be.body)}\`
`;
await fs.writeFile('SYSTEM_HEALTH_REPORT.md', md);
console.log('Wrote SYSTEM_HEALTH_REPORT.md');
