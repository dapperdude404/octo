# AI Octopus v2.1 — JavaScript web + Android-ready writing toolkit

**Original AI Octopus design.** This project is inspired by the user's reference video for polish and usability, without copying its competitor's branding, content or code. The application uses **JavaScript / Node.js** for logic, with HTML/CSS for the interface. Optional Capacitor tools generate an Android native wrapper.

## Try it immediately (no install or login required)

1. Install current [Node.js LTS](https://nodejs.org/) (Node.js **22.18+**, preferably a fully patched supported LTS version).
2. On Windows, double-click `start-preview.bat`; on Mac/Linux run `node scripts/preview.js`.
3. Open **http://localhost:4173** in your browser. The local AI-pattern indicator, clarity editor, grammar rules, draft comparison, TXT import, copy, and TXT export work. **No provider credits are used.**

**Note:** The preview does not run server-side endpoints. Login, history, and PDF/DOCX extraction require the full backend.

## What you get

| Area | Status |
|---|---|
| Responsive AI Octopus landing page, mascot, menu and light/dark mode | Included |
| AI-like heuristic score 0–100, visual meter, explanation of patterns | Works locally (not a validated detector) |
| Rule-based clarity editor, grammar checks, draft comparison | Works locally |
| TXT download/import and clipboard support | Works locally (browser permissions apply) |
| PDF and DOCX selectable-text extraction | Works with backend; scanned pages need OCR |
| Email/password account and saved provider scan history | Backend + PostgreSQL required |
| GPTZero, Winston AI, Copyleaks adapters | Credentials + paid API plans may be required; not live-tested |
| Android project via Capacitor | Android Studio + SDK required; no prebuilt APK |
| Claude Code instructions, Windows batch scripts, GitHub publishing guide | Included |

## Full backend (accounts, history, uploads, optional API scans)

Install Node.js, Docker and Git. Run:

```bash
cp .env.example .env
# Replace JWT_SECRET with a random secret of at least 32 characters.
docker compose up -d db
npm install
npm run db:generate
npm run db:migrate
npm run web:build
npm test
npm start
```

Open **http://localhost:3000**. Windows users can also run `setup-windows.bat` followed by `start-server.bat` after starting PostgreSQL and setting a secure JWT secret.

### Provider configuration

Set any desired API credentials in the server-only `.env` file:

```dotenv
GPTZERO_API_KEY=
WINSTONAI_API_KEY=
COPYLEAKS_EMAIL=
COPYLEAKS_API_KEY=
COPYLEAKS_SANDBOX=true
```

GPTZero only supports the AI check in this app; Winston AI and Copyleaks are options for AI or plagiarism workflows. Some plans require payment. The UI does **not** launch provider checks automatically. Copyleaks sandbox mode returns mock data, not production results. Turnitin is **not** integrated.

Copyleaks requires a public HTTPS callback for asynchronous results. By default callbacks are off. `COPYLEAKS_WEBHOOK_SECRET` guards the incoming webhook by a shared URL token when enabled; do not treat that as a production-grade signature/client certificate validation. Detailed similarity report export is not implemented. Review current provider docs and upgrade this flow before public release.

### Android

```bash
npm run android:add       # once; generates native Android project
npm run android:open      # opens Android Studio
npm run android:sync      # after web changes
```

On Windows, `android-setup.bat` generates/syncs the Capacitor Android project after the npm install. For accounts/provider scans from mobile, deploy the backend to HTTPS and set its origin in **Account → Backend address**. The native wrapper does not include Node.js or PostgreSQL. Android Studio compiles the final APK/AAB.

### Testing & quality

```bash
npm test
npm run web:build
npm run doctor
```

`npm run doctor` needs `.env`. The local Node test suite checks shared analysis functions. Full backend database integration, live provider calls, and Android compilation require a configured development environment and were not included in this package verification. A dependency lockfile and dependency audit should be generated during `npm install` before production release.

### API endpoints

`GET /api/health`, `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/documents/extract`, `POST /api/editor/analyze`, `POST /api/editor/clarity`, `POST /api/editor/grammar`, `POST /api/scans`, `GET /api/scans`, `GET /api/scans/:id`, and the disabled-by-default Copyleaks webhook endpoint.

## Safety and privacy

The 0–100 AI-like **surface-pattern** score is hand-weighted and uncalibrated. It is not a probability or definitive authorship decision. AI-written and human-written texts can score alike. Don't use the number by itself for student discipline or hiring decisions.

Local tools operate in the browser. PDF/DOCX extraction and enabled provider scans send text to the configured backend; paid provider scans may send content to third parties. Always obtain consent and respect your users' privacy.

Before production release: deploy HTTPS, rotate JWT/database credentials, enforce quotas and cost caps, add abuse monitoring and deletion controls, implement robust webhook verification, set up backup/recovery, add email confirmation/password reset, update supported dependencies, obtain lockfile and run security review.

## Develop with Claude / share on GitHub

Open this directory in Claude Code; see **`CLAUDE.md`**. To publish an owner-controlled private repo, see **`GITHUB_PUBLISH.md`**. No account is automatically linked and no code is uploaded.

## License

See `LICENSE`. Third-party provider trademarks and APIs belong to their respective owners.
