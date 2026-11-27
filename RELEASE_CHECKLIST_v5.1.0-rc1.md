# OCTO AI v5.1.0 Release Candidate — Review Checklist

**Only the reviewed Git commit can be a release candidate.** Keep source ZIP, web bundle, Android APK and Windows EXE tied to that same SHA; record their SHA-256 digests and platform version metadata. Use a distinct stable version and signoff before a final published release.

| Gate | Required evidence | Current disposition |
| --- | --- | --- |
| Version consistency | Packages, lockfile, runtime /api/health, Android aapt versionName/versionCode | Implemented; verify CI |
| Backward compatibility | Existing project tests, HTTP API contract, clarity/editor/import | Needs full CI/device checks |
| Android | Gradle debug APK, apksigner, aapt, real phone imports and OAuth | CI configured; real device pending |
| Windows | npm ci, portable EXE, smoke test, correct version | CI configured; review output |
| Backend | Docker image + PostgreSQL integration, /api/health version | CI configured; review output |
| Document integrity | TXT/PDF/DOCX, malformed import, draft preservation | Test code exists; manual device pending |
| Security | Server-only keys, auth flow, dependency scan and permissions | Manual audit pending |
| Research integrity | No fabricated AI detection, similarity or ML scores | Documentation maintained |
| Release management | Draft PR review, explicit merge approval, independent deployment/publication approval | Not approved |

**Do not change production Render, GitHub Pages, databases, OAuth settings, existing v5.0.0 releases, or app-store distribution from this candidate.**

Review links: [GitHub Actions](https://github.com/dapperdude404/octo/actions) · [OCTO repository](https://github.com/dapperdude404/octo).
