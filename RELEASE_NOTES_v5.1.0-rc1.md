# OCTO AI v5.1.0-rc.1 — Release candidate notes (NOT PUBLISHED)

**Status:** Isolated branch only; not a GitHub tag, release, store-ready APK, deployment, or approved production version.

**Base:** `main` at `1a031617fc4e0e8db1839c5c5554de5ad82619d1` (23 November 2026).

## Included in candidate
- Align Node API `ai-octopus-v2/package.json` and Windows `desktop/package.json` plus desktop lockfile at `5.1.0-rc.1`.
- Make API `/api/health` return its runtime package version, removing the stale hard-coded `2.5.0` response.
- Introduce a deterministic generated Android `versionName=5.1.0-rc.1` and `versionCode=5010001`; stamp after Capacitor creates/syncs the native project.
- Add unit tests for candidate parsing, increasing Android version codes, generated Gradle version replacement and fail-closed malformed build metadata.
- Check candidate version consistency in Android and Windows CI; assert built Android APK metadata actually matches the candidate.
- Strengthen release publishing safeguards: manual `workflow_dispatch` on main only; exact `CONFIRM-PUBLISH-vX.Y.Z` input, stable version alignment and version-specific release notes required. The candidate itself is **not** publishable via this stable-only publisher.
- Check packaged Docker API `/api/health` response against the source package version during integration tests.

## Existing features preserved without claiming new validation
- Current OCTO browser writing, grammar, clarity, document studio and image tools.
- OAuth, server-only provider secrets, API and PostgreSQL integrations remain unchanged.
- Existing document-import validation guard, web mirrors and academic research foundations remain unchanged.
- Existing published `v5.0.0` release and debug artifact remain untouched.

## Known limitations and blockers
- An older v5.0.0 release has mismatched source/web/APK commit origins. This candidate does not rewrite it.
- Android `versionCode` must be checked against the **largest ever distributed** installed APK before calling a future build an in-place upgrade. Existing artifacts may use a different increment scheme. The RC code is not an authorization to distribute it.
- A debug APK is not production-signed and cannot establish store readiness.
- OAuth end-to-end sign-in, PDF/DOCX imports on a physical Android device, consent-based external providers, accessibility/screen readers and academic IEEE export need separate live verification.
- V5 research studio is not fully finished; neither authorship nor plagiarism nor scientific accuracy can be invented.

## Candidate acceptance tests
- [ ] `npm run version:check` passes
- [ ] `npm test` passes including new `versioning.test.js`
- [ ] `npm run web:check` passes, followed by `npm run web:build`
- [ ] Backend Docker integration tests pass including actual `/api/health` version
- [ ] GitHub Android Gradle `assembleDebug` passes, `apksigner` and `aapt` confirm versionName and versionCode
- [ ] Windows `npm ci` builds and smoke test passes; package version matches installed artifact
- [ ] Security/dependency and release workflow permissions audited
- [ ] Manual Android import / apply / restore / login regression and accessibility matrix recorded
- [ ] Separate explicit approval received before merging this PR
- [ ] Separate explicit approval received before any deployment, tag or release publication

## Versioning rule
For candidate `M.m.p-rc.N` with `1 <= N <= 98` use Android code `M*1,000,000 + m*10,000 + p*100 + N`. A stable `M.m.p` uses offset `99`. Supported bounds are enforced and unit-tested. Future versioning scheme changes must preserve Android package upgrade monotonicity.

> **No merge, deployment, tagging or publication is authorized by this file or the pull request.**
