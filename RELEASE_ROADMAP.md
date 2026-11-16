# AI Octopus — rolling design and release roadmap

## Release rhythm
- On each release, refresh at least one meaningful UI/UX element while preserving familiar navigation, readability, keyboard focus, mobile performance and accessibility.
- Rotate original, user-selectable visual palettes rather than making unannounced changes that interfere with users' saved themes.
- Use a minor release for new capabilities, and a patch release for verified fixes; publish release notes and review automated CI results first.
- Preserve GitHub backups and avoid overwriting earlier release artifacts.
- Review security advisories, provider APIs, and hosted database durability before shipping.

## Next release priorities (planned — not implemented)

1. **Google account sign-in** — OAuth 2.0 / OpenID Connect authorization code flow, verified identity tokens, secure account linking, consent and sign-out. Use provider-supported configuration and store secrets in Render, never frontend code. Do not claim operational until OAuth app credentials, redirect URLs, and login tests are confirmed.
2. **GitHub account sign-in** — GitHub OAuth sign-in with least privilege, secure session handling, user-approved account linking, and protection against duplicate accounts. Require the user's approval for GitHub OAuth app registration and credentials.
3. **Password-protected PDF workspace** — Allow a user to open and remove restrictions from a PDF they own or are authorized to access **when they supply the correct existing password**. Never attempt unknown-password cracking, brute forcing, or unauthorized bypassing. Do not store passwords; use sensitive-file protections and provide clear error messages.
4. **More PDF productivity tools** — Split, merge, rotate, rearrange pages, basic compression, OCR for scanned PDFs (opt-in), and conversion workflows with explicit fidelity limits.
5. **Original UI/UX evolution** — accessible, mobile-first glass panels, creative new tiles, animation with reduced-motion handling, and user-selected Aurora/Plasma/Solar themes.
6. **User-provided recording feedback** — review future screen recordings/videos supplied by the user and translate demonstrated interaction needs into scoped, tested issues before implementation.

These are **candidate features**, not a promise that credentials, private provider services, or paid resources are available. Production changes require testing and security review; do not overwrite working authentication or existing releases.

## Next candidates (not yet implemented)
1. Richer document layout preservation in PDF → DOCX and DOCX → PDF, with clear fidelity limits
2. OCR for image-only PDFs, with explicit opt-in and privacy information
3. Split/merge PDF workflows, with text and image handling
4. Revision history and document templates (resumes, reports, letters)
5. Accessibility enhancements, saved theme presets, and reduced motion

## Requirements before production data
- Upgrade free Render PostgreSQL to durable backed-up storage before its scheduled expiry.
- Configure provider keys only through Render secrets; do not commit API keys.
- Verify performance and ensure data policies are clear before enabling public accounts.
