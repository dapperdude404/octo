# AI Octopus v2.5.0 — Document Studio and visual themes

## New Document Studio
- Import PDF, DOCX and TXT content into the existing editor; PDF and DOCX uploads are extracted on the connected Render API.
- Export to real editable Word DOCX, plain TXT, HTML, Markdown, or JSON.
- Use the browser's Print → Save as PDF option for a print-ready PDF copy.
- Responsive glass-style format tiles, export status and file-name controls.
- DOCX output rebuilds the text and paragraphs; it does not preserve complex original PDF formatting, illustrations or tables.
- Scanned PDFs still require OCR before text extraction.

## Creative themes
- Aurora, Plasma and Solar palettes, each with a light/dark companion mode.
- Theme choices are kept locally in the browser, with accessible selector and reduced-motion support.

## Privacy and scope
- PDF/DOCX imports and Word exports send document text to the configured API server. Other listed text exports are browser-local.
- The heuristic AI-like writing score does not establish authorship. Third-party provider scans need valid credentials.
- Android APK is a debug artifact, not a Play Store release.
