import { readFile, writeFile } from 'node:fs/promises';
import { stampAndroidGradle, stampAndroidDebugIdentity } from './versioning.js';

const packageUrl = new URL('../package.json', import.meta.url);
const gradleUrl = new URL('../android/app/build.gradle', import.meta.url);
const { version } = JSON.parse(await readFile(packageUrl, 'utf8'));
const gradle = await readFile(gradleUrl, 'utf8');
const runId = process.env.GITHUB_RUN_ID;
if (process.env.GITHUB_ACTIONS === 'true' && !runId) {
  throw new Error('GITHUB_RUN_ID is required to isolate CI debug APK package identity.');
}
// Local builds retain a stable development-only package name. CI uses a
// per-run package ID to prevent conflicts with existing differently signed APKs.
const next = stampAndroidDebugIdentity(
  stampAndroidGradle(gradle, version),
  runId || '1'
);
await writeFile(gradleUrl, next, 'utf8');
console.log('Stamped generated Android debug build for ' + version
  + ', debug package com.octoai.app.dev' + (runId || '1')
  + '; production package remains com.octoai.app.');
