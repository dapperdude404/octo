/**
 * Release-candidate version helpers, deliberately independent of third-party packages.
 * Android versionCode increases monotonically for patch/minor increments and for
 * RC -> final. This does NOT make a debug build production-signable.
 */
export function parseOctoVersion(version) {
  const match = typeof version === 'string' && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-rc\.([1-9]\d*))?$/.exec(version);
  if (!match) throw new Error('Expected numeric SemVer (optionally -rc.N).');
  const [, majorText, minorText, patchText, candidateText] = match;
  const [major, minor, patch] = [majorText, minorText, patchText].map(Number);
  const candidate = candidateText === undefined ? null : Number(candidateText);
  if (![major, minor, patch].every(Number.isSafeInteger)
    || major > 2000 || minor > 99 || patch > 99
    || (candidate !== null && (!Number.isSafeInteger(candidate) || candidate < 1 || candidate > 98))) {
    throw new RangeError('Version exceeds supported Android versionCode range.');
  }
  return { major, minor, patch, candidate };
}

export function androidVersionCode(version) {
  const { major, minor, patch, candidate } = parseOctoVersion(version);
  const code = major * 1000000 + minor * 10000 + patch * 100 + (candidate ?? 99);
  if (code > 2147483647) throw new RangeError('Android versionCode overflow.');
  return code;
}

export function stampAndroidGradle(source, version) {
  const code = androidVersionCode(version);
  let codeCount = 0;
  let nameCount = 0;
  const updated = source
    .replace(/(\bversionCode\s+)\d+\b/g, (_match, prefix) => {
      codeCount += 1;
      return prefix + code;
    })
    .replace(/(\bversionName\s+)(["'])([^"'\\]*)\2/g, (_match, prefix, quote) => {
      nameCount += 1;
      return prefix + quote + version + quote;
    });
  if (codeCount !== 1 || nameCount !== 1) {
    throw new Error('Expected one versionCode and one versionName in generated Android Gradle.');
  }
  return updated;
}

/**
 * GitHub runners generate a fresh debug-signing key for each build. A release
 * candidate must not claim the production applicationId, or Android will reject
 * it if an existing installation was signed using another key.
 *
 * Keep production com.octoai.app untouched. Give every CI debug APK a unique
 * package namespace so it can be installed alongside any existing OCTO APK.
 * Distinct CI runs intentionally do NOT upgrade one another or share app data.
 */
export function androidDebugPackageId(baseId, runId) {
  if (typeof baseId !== 'string' || !/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/.test(baseId)) {
    throw new Error('Invalid base Android application ID.');
  }
  if (typeof runId !== 'string' || !/^[1-9][0-9]{0,17}$/.test(runId)) {
    throw new Error('Expected a numeric GitHub Actions run ID.');
  }
  return baseId + '.dev' + runId;
}

export function stampAndroidDebugIdentity(gradle, runId) {
  const suffix = '.dev' + runId;
  // Validate the entire resulting package ID and allow only known Gradle input.
  androidDebugPackageId('com.octoai.app', runId);
  if (typeof gradle !== 'string') throw new Error('Expected Gradle source text.');
  const buildTypes = [...gradle.matchAll(/\bbuildTypes\s*\{/g)];
  if (buildTypes.length !== 1) throw new Error('Expected one Android buildTypes section.');
  if (/\bapplicationIdSuffix\b/.test(gradle)) {
    throw new Error('Unexpected existing applicationIdSuffix; review package identity manually.');
  }
  // Capacitor's generated Gradle defines a release build type. Insert a debug
  // block without touching release, applicationId or signing configuration.
  return gradle.replace(/\bbuildTypes\s*\{/, match =>
    match + '\n        debug { applicationIdSuffix "' + suffix + '" }');
}
