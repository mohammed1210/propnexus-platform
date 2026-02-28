import fs from 'node:fs';
import path from 'node:path';

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      // Skip build output and deps
      if (ent.name === '.next' || ent.name === 'node_modules' || ent.name === 'dist') continue;
      out.push(...walkFiles(full));
      continue;
    }
    if (!ent.isFile()) continue;
    if (!/\.(ts|tsx|js|jsx)$/.test(ent.name)) continue;
    out.push(full);
  }
  return out;
}

describe('Yield/ROI UI hygiene', () => {
  it('does not dot-access yield_percent/roi_percent in app/components', () => {
    const frontendRoot = path.resolve(__dirname, '..');
    const targets = [path.join(frontendRoot, 'app'), path.join(frontendRoot, 'components')];

    const bad: Array<{ file: string; match: string }> = [];
    const re = /\.\s*(yield_percent|roi_percent)\b/g;

    for (const dir of targets) {
      for (const file of walkFiles(dir)) {
        // Allow the canonical normalization helper to reference these fields.
        if (file.endsWith(path.join('lib', 'normalizeProperty.ts'))) continue;

        const txt = fs.readFileSync(file, 'utf8');
        const m = txt.match(re);
        if (m && m.length) {
          bad.push({ file, match: m[0] });
        }
      }
    }

    if (bad.length) {
      const rendered = bad
        .slice(0, 10)
        .map((b) => `- ${path.relative(frontendRoot, b.file)}: ${b.match}`)
        .join('\n');
      throw new Error(
        `Direct \.yield_percent/\.roi_percent access reintroduced. Use normalize helpers instead.\n${rendered}`,
      );
    }
  });
});
