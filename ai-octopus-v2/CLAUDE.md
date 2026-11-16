# AI Octopus v2.1 — Developer instructions for Claude Code

## Your goal
Build and maintain **AI Octopus**, an original, polished, mobile-first writing toolkit with a signature octopus identity. Treat the user-provided video as inspiration for navigation, ease of use and polish, NOT as permission to clone another website or use that company's branding.

## Product principles
1. Keep all app logic in **JavaScript / Node.js**. HTML/CSS are the presentation layer. Do not introduce a Python or Kotlin codebase unless the owner explicitly asks for one. Capacitor generates Android native scaffolding automatically.
2. Make local tools useful without login. Provider checks and persisted account history use a backend and require opt-in.
3. Distinguish **rule-based AI-like pattern score (0–100)** from genuine third-party detector outputs. This is NOT a probability of AI authorship and NOT evidence someone cheated.
4. Keep all API credentials server-side. Never leak keys in browser source, logs, GitHub or Android assets.
5. Preserve dark/light modes, mobile navigation, accessible forms, word counts, editing tools and privacy notices.
6. Any paid provider invocation must be explicitly user-triggered. Never submit drafts to providers silently.

## Quick starts
- `node scripts/preview.js` — starts zero-dependency local frontend preview on http://127.0.0.1:4173. Local tools function. Auth, PDF/DOCX extraction and provider scans need the full backend.
- `npm install && npm run web:build && npm test` — install, build, test.
- Copy `.env.example` to `.env`, set a secure JWT secret, start PostgreSQL, run `npm run db:generate`, `npm run db:migrate`, then `npm start` for the full API.
- `npm run android:add`, then `npm run android:open` after installation. Android Studio + SDK are required. The Android wrapper is NOT a self-contained backend.

## Code map
- `web/index.html`: UI layout, navigation and forms.
- `web/style.css`: responsive CSS themes.
- `web/src.js`: browser state and UI event handlers.
- `web/core.js`: **single source of truth** for local analysis, grammar, clarity, and comparison; imported by backend.
- `server/src/index.js`: Express API, login, document uploads, provider jobs.
- `server/src/providers/`: GPTZero, Winston AI, Copyleaks provider adapters.
- `server/prisma/schema.prisma`: users/scans relational models.
- `server/test/`: automated tests.
- `scripts/build-web.js`: copies `web/` into `server/public/` (do not hand-edit generated copies).

## For development
- Edit `web/`, not `server/public/`.
- Keep browser/server analysis identical by importing from `web/core.js` on the server.
- Add tests alongside all feature additions; run `npm test` and `npm run web:build`.
- Check small Android viewport (360px), large desktop, light theme and dark theme.
- Do not claim paid provider integrations were fully tested unless credentials and live endpoints were actually verified.
- Do not deploy, purchase credits, post to GitHub or expose content without owner approval.

## Known production work
- Validate current official provider API contracts, especially Copyleaks callback authentication and detailed result export, before enabling for real customers.
- Add background tasks / retries, transparent rate & cost limits, retention controls, password reset and email verification.
- Obtain a dependency lockfile (`npm install`) and run audit before release.
- Build native Android APK in Android Studio; use HTTPS backend configured in the account dialog.
- Consider moving from Bearer JWT in sessionStorage to secure HttpOnly cookies for web with CSRF controls; test mobile implications.

## Good next sprint
Polish mobile workflows, improve inclusive analysis language, add export and document previews, set up developer API integration mocks and Playwright end-to-end tests.
