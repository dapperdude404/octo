# AI Octopus — Backups, safety, and maintenance

## Current safe copy
- Source repository: https://github.com/dapperdude404/octo
- Stable backup branch (snapshot before adding developer links): https://github.com/dapperdude404/octo/tree/backup/ai-octopus-2026-11-16
- Production branch: `main`
- Website: https://dapperdude404.github.io/octo/app/
- Android CI: https://github.com/dapperdude404/octo/actions/workflows/android-apk.yml

A GitHub branch is a useful recovery point, **not an independent backup**: deleting the repository can delete all its branches.

## Save an independent copy
1. Open the repository on GitHub.
2. Select **Code → Download ZIP** and store it somewhere outside GitHub, such as your computer or trusted cloud storage.
3. Repeat after major releases, and keep at least two dated copies.
4. Save any future PostgreSQL data with encrypted, tested database backups; source-code backups do **not** include hosted user data.
5. Save signing keys and release credentials securely and separately from the repository. A debug APK is not a Play Store release build.

## Protect the GitHub account and source
- Enable GitHub two-factor authentication and save recovery codes.
- In **Settings → Branches** or **Rules → Rulesets**, protect `main`: require pull requests and passing build checks before merges, as supported by your plan.
- Never commit `.env`, API tokens, database passwords, JWT secrets, or Android signing keys. Use your host's environment variables and GitHub Actions Secrets.
- Review GitHub Actions failures and dependency/security alerts.
- Use small, descriptive commits; create a release tag for each stable milestone.
- Avoid force-pushing or deleting the backup branch.

## If a change breaks the site
1. Inspect the last successful commit in **Commits** or **Actions**.
2. Use GitHub's **Revert** functionality or open a pull request restoring the previous version.
3. Compare with the dated backup branch; do not force-reset `main` without reviewing newer changes.
4. Verify the website and Android workflow after restoring.

## Routine maintenance
- Weekly: open the live site on a phone, review failed Actions runs and open issues.
- Monthly: review Node.js, Capacitor, Prisma, provider API changes, and security advisories.
- Before major updates: download a fresh ZIP and verify your database backup, if applicable.

Website and APK availability do not prove that hosted accounts, database storage, or third-party provider APIs are working. Test these separately once a backend is deployed.
