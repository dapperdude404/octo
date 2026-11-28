# OCTO AI — Four Coding Rules

These project rules apply to changes proposed for the OCTO AI web app, Android app, Windows desktop app, backend, research tools, docs, and automation.

1. **Think before you code.** Confirm the reported problem, current behavior, source of truth, scope and acceptance criteria before editing.
2. **Keep it simple.** Prefer the smallest maintainable solution with existing libraries and patterns. Avoid unnecessary architecture, dependencies or UI changes.
3. **Touch only what is required.** Use a focused branch and minimal diff. Preserve user documents, accounts, previous releases, app IDs, signing, credentials, production deployments and unrelated features.
4. **Test until the goal is completed.** Run targeted tests and applicable CI, verify the actual artifact and relevant device/browser workflow, record failures and what remains untested. Do not call a fix complete when only compilation succeeded.

## Applying the rules

- In each pull request, state **problem**, **minimal change**, **tests and evidence**, **known limitations** and **approval needed**.
- For Android bugs, separate JavaScript unit tests, Gradle/APK verification and **physical-phone behavior**. A passing APK build does not prove a file picker, login, or export works.
- For exports/imports, preserve the source draft on failure, handle cancel/error explicitly, and verify saved/openable files.
- For version/release changes, align version metadata and keep public releases distinct from debug or release-candidate builds.
- If a check cannot be run, say **not tested** rather than inferring success.
- **Never merge, deploy, tag, or publish production changes without the owner's separate explicit approval.**

These rules guide future work; adding this document does not itself change runtime behavior or authorize a release.
