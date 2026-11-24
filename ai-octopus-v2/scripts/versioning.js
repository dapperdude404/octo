/**
 * Release-candidate version helpers, deliberately independent of third-party packages.
 * Android versionCode increases monotonically for patch/minor increments and for
 * RC -> final. This does NOT make a debug build production-signable.
 */
export function parseOctoVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/.exec(version);
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
