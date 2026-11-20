import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = process.cwd();
const source = resolve(root, 'web');
const target = resolve(root, 'server/public');
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
// Reuse the audited server-side pure research engines in the browser preview.
// Do not duplicate algorithms or include server secrets / provider integrations.
const researchEngine = resolve(root, 'server/src/research');
const browserEngine = resolve(target, 'research/engine');
await mkdir(browserEngine, { recursive: true });
for (const name of ['revisions.js', 'quality.js', 'citations.js']) {
  await cp(resolve(researchEngine, name), resolve(browserEngine, name));
}
console.log(`Web assets copied to ${target}`);
