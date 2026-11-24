import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { stampAndroidGradle } from './versioning.js';

const packageUrl = new URL('../package.json', import.meta.url);
const gradleUrl = new URL('../android/app/build.gradle', import.meta.url);
const { version } = JSON.parse(await readFile(packageUrl, 'utf8'));
const gradle = await readFile(gradleUrl, 'utf8');
const next = stampAndroidGradle(gradle, version);
await writeFile(gradleUrl, next, 'utf8');
console.log('Stamped generated Android build.gradle for ' + version);
