import { readFileSync } from 'node:fs';
import { androidVersionCode, parseOctoVersion } from './versioning.js';

const json = url => JSON.parse(readFileSync(new URL(url, import.meta.url), 'utf8'));
const api = json('../package.json');
const desktop = json('../../desktop/package.json');
const lock = json('../../desktop/package-lock.json');
parseOctoVersion(api.version);
// Both release candidates and stable releases must pass the same consistency gate.
if (api.version !== desktop.version
  || api.version !== lock.version
  || api.version !== lock.packages?.['']?.version) {
  throw new Error('API, Windows, and desktop lockfile versions are inconsistent.');
}
const healthSource = readFileSync(new URL('../server/src/index.js', import.meta.url), 'utf8');
if (!healthSource.includes("version: appVersion")) {
  throw new Error('Health endpoint must use the API package version, not a stale literal.');
}
const workflow = readFileSync(new URL('../../.github/workflows/publish-release.yml', import.meta.url), 'utf8');
if (!workflow.includes("workflow_dispatch:") || !workflow.includes("CONFIRM-PUBLISH-")) {
  throw new Error('Release publisher is missing a manual publish confirmation gate.');
}
console.log('OCTO candidate metadata verified: ' + api.version
  + ' (Android versionCode ' + androidVersionCode(api.version) + ')');
