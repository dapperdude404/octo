# OCTO AI — Android "App not installed: package conflicts" fix

**Scope:** Debug APK installation safety only. Production signing/upgrade is not changed.

## What the screenshot demonstrates

Android rejected `app-debug.apk` (shown as `5.1.0-rc.1`) with **"App not installed as package conflicts with an existing package."**

The existing production package ID is `com.octoai.app`. A newly generated GitHub Actions debug APK had the **same package ID**, while CI runners normally generate a different debug signing key. Android requires compatible signing certificates for replacement installations. A higher version code is **not sufficient** to bypass this rule. The screenshot alone cannot prove which installed APK/certificate caused the conflict; checking the existing package and signatures via ADB can establish it.

## Fix in this branch

- Preserve the original `com.octoai.app` release application ID and Capacitor config.
- Give every **CI debug build** a different application ID derived from the GitHub run ID:
  - `com.octoai.app.dev46045921194` for illustrative run ID `46045921194`
  - next run gets a new ID, so it does not collide with the original app **or previous CI builds**.
- Only the generated Android Gradle `debug` build type gets `applicationIdSuffix`; the release type remains unchanged.
- Stamp the existing `5.1.0-rc.1` versionName and `5010001` versionCode.
- CI checks the actual APK via `aapt dump badging` to ensure its **package** is isolated; it also verifies signing with `apksigner` and records the debug certificate fingerprint.
- Unit tests cover package-ID safety, per-run uniqueness and preservation of the production build type.
- Downloadable CI artifact names include the run ID for traceability.

## How to test the next APK safely

1. Wait until PR CI passes. Open the **Build and verify AI Octopus Android APK** action on this branch.
2. Download the new `ai-octopus-android-debug-apk-isolated-<run-id>` artifact and extract `app-debug.apk`.
3. Install it normally. It should appear as a **separate installation**; do **not** uninstall your current OCTO app.
4. Test startup, document import, account login, editor and local storage. Note: data from the production app will **not** appear automatically in this separate app.
5. Send the exact installation outcome and any screenshot back for review.

If the device rejects installation for a *different* reason (storage, Android policy, corrupted APK), record the full Android message and run `adb install -r path/to/app-debug.apk` for the precise installer error.

## Important limitations

**This does NOT produce an update-over-the-top APK** for the existing app. It produces an isolated development APK. A genuine in-place upgrade to `com.octoai.app` requires the **same signing identity** as the installed app (or a valid Android signing-key rotation path), a compatible/increasing version code and a compatible app package/config. The production signing key must be stored securely and must never be committed to source control.

Different CI runs deliberately install as separate apps and will not share app data. Uninstall older `dev...` builds through Android Settings when no longer needed. Firebase/OAuth/deep-link providers may require development package ID/signature configuration before they work in this test app; do not reuse production credentials unsafely.

**No uninstall, merge, stable release, signing-key upload or production deployment is authorized by this fix.**
