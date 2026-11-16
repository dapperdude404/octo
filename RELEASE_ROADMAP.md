# AI Octopus — rolling design and release roadmap

## Release rhythm
- On each release, refresh at least one meaningful UI/UX element while preserving familiar navigation, readability, keyboard focus, mobile performance and accessibility.
- Rotate original, user-selectable visual palettes rather than making unannounced changes that interfere with users' saved themes.
- Use a minor release for new capabilities, and a patch release for verified fixes; publish release notes and review automated CI results first.
- Preserve GitHub backups and avoid overwriting earlier release artifacts.
- Review security advisories, provider APIs, and hosted database durability before shipping.

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
