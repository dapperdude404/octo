# AI Octopus v2.1 — Online web deployment

## Browser app

Public browser entry point (GitHub Pages): https://dapperdude404.github.io/octo/app/

The files are published from the `app/` directory on the `main` branch of `dapperdude404/octo`. This URL assumes the repository's GitHub Pages source is **Deploy from a branch → main → /(root)**. If the site does not appear, check **Settings → Pages** and select that source, then wait for the build. The site is static and works on desktop, tablet and mobile browsers. No APK is required.

Available without a backend: local AI-style pattern score (heuristic, not a validated authorship probability), clarity editor, grammar rules, draft comparison, TXT import/export. The browser app does not send text to external services for these tools.

## Full online features require a separate HTTPS API

GitHub Pages cannot execute Node.js or host PostgreSQL. To enable accounts, scan history, PDF/DOCX text extraction, and GPTZero/Winston/Copyleaks integrations, deploy the Node backend in this repository to a Node-compatible host (for example Render, Railway, Fly.io or a VPS) and provision PostgreSQL.

- Runtime: Node.js 22.18+ or a supported newer LTS.
- Project root: `ai-octopus-v2/`.
- Build: `npm install && npm run db:generate && npx prisma db push --schema server/prisma/schema.prisma && npm run web:build` (for a first development deployment; use reviewed Prisma migrations for production).
- Start: `npm start`.
- Required server environment: `NODE_ENV=production`, `DATABASE_URL` (PostgreSQL), `JWT_SECRET` (secure random 32+ characters), `APP_ORIGIN=https://dapperdude404.github.io`, `PORT` (host-provided).
- Optional provider credentials: `GPTZERO_API_KEY`, `WINSTONAI_API_KEY`, `COPYLEAKS_EMAIL`, `COPYLEAKS_API_KEY`. Do not commit them to GitHub.
- Verify `https://YOUR_API_HOST/api/health` returns JSON with `ok:true`.
- In the online app, click **Sign in** → **Connect an online API server** and enter `https://YOUR_API_HOST`. The browser saves the API URL locally. Use HTTPS to avoid mixed-content blocking.

Provider integrations require actual vendor credentials and may incur charges; they are not verified against private production accounts. Copyleaks callbacks require additional configuration. Before allowing public sign-ups, complete security review, production migrations, privacy notices, monitoring and backups.

## Repo structure

- `app/`: public GitHub Pages entry point
- `ai-octopus-v2/web/`: editable browser source
- `ai-octopus-v2/server/`: Node.js API and Prisma schema
- `ai-octopus-v2/server/public/`: static files served when running the Node backend
- `ai-octopus-v2/capacitor.config.json`: optional Android wrapper

When updating the web source, keep the `app/` published copy in sync.
