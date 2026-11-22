# Google + GitHub OAuth (development branch)
Status: **implemented in source, not configured or deployed**. No OAuth client credentials are committed.

## Set up
1. Create a Google Cloud OAuth web client with authorized redirect URI `https://ai-octopus-api-l83b.onrender.com/api/auth/oauth/google/callback`. Configure OAuth consent screen, authorized domains and appropriate test users.
2. Create a GitHub OAuth App with homepage `https://dapperdude404.github.io/octo/app/` and callback `https://ai-octopus-api-l83b.onrender.com/api/auth/oauth/github/callback`.
3. Set server-only Render environment variables: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `APP_ORIGIN=https://dapperdude404.github.io/octo/app/`, `PUBLIC_API_URL=https://ai-octopus-api-l83b.onrender.com`, and existing `JWT_SECRET` and `DATABASE_URL`. Never put secrets in GitHub Pages or Android client.
4. Back up PostgreSQL; run `npm run db:deploy` with a durable database before starting the updated server.
5. Verify `GET /api/auth/oauth/status` shows the two providers enabled. Test consent, cancellation, expired state, code replay, verified-email handling, existing-email conflicts and existing password login.
6. Validate mobile browser redirects; Android Capacitor deep-link integration is **not yet implemented**.
7. Review PR, CI, security and deployment settings before merging.

## Security
- OAuth state is a signed, five-minute JWT bound to a short-lived HttpOnly SameSite=Lax cookie; callbacks check provider and nonce.
- Provider access tokens remain server-side; provider identities are keyed by provider-specific immutable user IDs.
- OAuth callback issues a random one-minute **single-use** code stored as a SHA-256 hash in PostgreSQL, then redirects to the approved frontend origin. Frontend exchanges it for the existing seven-day OCTO session token.
- Email collisions are rejected rather than silently linking separate accounts. Explicit account-linking and email/password reset flows are future work.
- Frontend session JWT remains in sessionStorage as in existing OCTO; consider moving to a hardened HttpOnly session-cookie design before sensitive production use.
- OAuth endpoints require HTTPS in production; callback and exchange should be covered by application-level and live provider integration tests before deployment.
- No production credentials, consent-screen approval, or live end-to-end tests have been supplied.

## Render Secret Files compatibility (stabilization branch)

The server will read `GITHUB_CLIENT_SECRET` and `GOOGLE_CLIENT_SECRET` from
`/etc/secrets/GITHUB_CLIENT_SECRET` and `/etc/secrets/GOOGLE_CLIENT_SECRET`
**only when their matching environment variables are blank or absent**.
The environment variable takes precedence. This supports Render's Secret Files
without committing secret material. Files must be regular, non-symlink, nonempty,
and 8 KB or smaller. The OAuth status endpoint still reports booleans only.

This is source implementation, **not** a production deployment. Never put OAuth
secrets in GitHub source, issue comments, screenshots, or mobile assets.
An OAuth configuration status of true does not prove that an actual login works.
A separate approved deployment and browser callback test are still required.
