# OCTO AI — Academic Research Studio V5

**Status:** Development branch / initial foundation. **Not released.** The production site remains on v2.5.0.

## Scope and acceptance
1. **Natural academic editor:** side-by-side original/revised text; paragraph or span-level suggested changes; accept/reject/restore; immutable original; IEEE/APA/general presets. Changes must preserve citations, equations, figures, and numeric findings, and explain their rationale.
2. **Academic quality:** eight criteria weighted 20/20/15/15/10/10/5/5. Never claim a complete 100-point assessment until all eight are evidence-backed. Initial `research/quality.js` exposes **partial heuristic signals only**, with missing dimensions clearly marked. Target 95–100 is an editorial aspiration, never a promised result.
3. **AI writing:** distinct provider responses for GPTZero/Winston/Copyleaks and Turnitin **only if formally authorized**. Record provider, scan date, score definition, provenance, error status, limits. Local heuristic scores are not AI-authorship probabilities.
4. **Similarity:** provide distinct **New Plagiarism Review** (local duplicate/reference matching) and **New Turnitin Scan** (only enabled with approved official integration) actions. Local exact duplicate detection can run without external services; external source matching, reference verification and similarity percentages require licensed, authorized data access. Never invent corpus matches or percentages. Show status, source scope, timestamp, and limitations for every scan.
5. **IEEE export:** official conference/journal template selected by user; editable DOCX and PDF with two-column formatting, equations, captions, figures, references, and preflight checks. Current v2.5 DOCX export is plain text; it does not satisfy this requirement.
6. **Research validation:** accept safe bounded uploads for datasets/logs/evaluation reports/model manifests; derive metrics only from actual confusion matrices or validated predictions/ground truth. Label each result VERIFIED, REPORTED, MISSING or INCONSISTENT. No untrusted model execution.
7. **UI:** responsive research dashboard, editable diff, project history, provider status, quality panel, IEEE exports, validation report, accessible keyboard support and light/dark themes.
8. **Architecture:** retain existing web app, Node.js server, Prisma/PostgreSQL, Capacitor, PDF/DOCX/TXT; enforce server-side credentials, rate limits, content and file validation, deletion/retention policy.
9. **Testing:** unit/integration/export/security tests, provider error tests, source-preservation tests, document render checks, screenshots and dependency audit.
10. **Delivery:** PR with code, evidence, release notes, checklist. **Do not merge or deploy without explicit review and approval.**

## Proposed modules
- `server/src/research/quality.js`: initial partial quality-signal engine (implemented on this branch)
- `server/src/research/revisions.js`: deterministic span suggestions with explicit accept/reject/restore engine (implemented; UI integration planned)
- `server/src/research/citations.js`: local numbered-reference inventory, missing/unused/duplicate warnings (implemented; external verification planned)
- `server/src/research/similarity.js`: local exact duplicate and user-supplied reference analysis with explicit Turnitin-unavailable status (initial module added; official provider adapter and UI planned)
- `server/src/research/validation.js`: confusion-matrix accuracy/precision/recall/F1 recomputation with provenance (implemented; dataset upload UI and execution planned)
- `server/src/research/provider-status.js`: honest provider capability/status manifest (implemented; credentialed scanning planned)
- `server/src/research/ieee-export.js`: official-template document export (planned)
- `web/research` and mirrored `app`: research dashboard and editor (planned)

## Security and correctness gates
- Treat manuscript and datasets as private. Set file size, type, decompression, and request limits. Avoid logging document bodies, credentials, or PDF passwords.
- External providers are opt-in and disabled without verified credentials and terms. Turnitin requires an approved integration.
- No training claims or model validation unless a reproducible run occurred.
- Maintain compatibility with the existing production UI and API; run full tests before merging.
- Review free database expiration and backup strategy separately before persisting projects or scan history.

## Release checklist
- [x] Inspect existing repo, stack and current version
- [x] Create isolated development branch
- [x] Add initial explainable scoring contract and unit tests
- [x] Add deterministic suggestions and independent accept/reject/restore logic with tests
- [ ] Implement reviewable side-by-side editing UI and individual suggestion actions
- [ ] Validate score definitions and full 100-point coverage
- [ ] Implement authorized provider adapters and failure handling
- [x] Add initial local duplicate/reference comparison with tests (not a plagiarism database scan)
- [ ] Add New Plagiarism Review / New Turnitin Scan UI and authorized provider adapter
- [ ] Implement verified external similarity/citation checks
- [ ] Implement official IEEE template export and rendering tests
- [x] Add confusion-matrix recomputation with evidence status and tests
- [ ] Implement model/dataset uploads and research validation UI
- [x] Add dedicated GitHub Actions workflow for V5 unit tests
- [ ] Run full existing test suite and security/dependency checks
- [ ] Attach UI screenshots and verified CI evidence to PR
- [ ] Obtain user review and approval for production deployment
