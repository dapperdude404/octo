# Host AI Octopus API on Render

This repository includes a **Render Blueprint** at [render.yaml](../../render.yaml). The optional backend Docker image is built from the same source as the published GitHub package.

## Deploy
1. Connect a Render account and authorize access to the `dapperdude404/octo` repository.
2. In Render open **New → Blueprint**, select this repository on `main`, review the detected web service `ai-octopus-api` and PostgreSQL `ai-octopus-db`, then approve the resources. **Review potential costs and free-tier limitations before approving.**
3. Render sets `DATABASE_URL` from its PostgreSQL database and generates a secure `JWT_SECRET`; do not put secrets in GitHub. The app is configured for CORS origin `https://dapperdude404.github.io`.
4. Wait for a healthy deployment and visit `https://<actual-render-service-url>/api/health`. It must return JSON containing `"ok": true`. Never guess the Render host URL before provisioning.
5. Visit https://dapperdude404.github.io/octo/app/, select **Sign in → Connect an online API server**, and enter the actual HTTPS Render service URL.
6. Add provider keys privately in Render environment settings (optional). Check official GPTZero, Winston AI and Copyleaks API requirements first. The API cannot perform paid provider scans without valid credentials.

## Security and limitations
- The included `plan: free` resources are for a temporary development demo, **not** production accounts or durable scan-history data. Render's free PostgreSQL instance expires; migrate to a paid, backed-up database before storing important user data.
- Free web services spin down on inactivity, delaying the next API request.
- On container start, Prisma applies the checked-in initial migration. Do not deploy the initial migration blindly against an existing database.
- App data is stored in PostgreSQL; the Google Drive source ZIP or APK backup is **not** a database backup.
- Rate-limiting, application logs, provider credential management, backups, a privacy notice, and application security reviews are needed before opening public accounts.
- Render HTTPS hosting, domain assignment and the database cannot be verified until the Render deployment actually runs.
- See https://render.com/docs/blueprint-spec and https://render.com/docs/free for current platform rules.

## Troubleshooting
- If the service fails to boot, review Render logs and confirm the secret `DATABASE_URL`, the Prisma migration, and `JWT_SECRET` (32+ characters).
- If the browser cannot connect, enter the HTTPS URL without `/api/health`, verify `APP_ORIGIN`, and inspect the browser network error.
- If the API reports `ok: true` but scans fail, configure real provider credentials and confirm quotas and callback settings.
