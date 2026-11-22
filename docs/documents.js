import {countWords} from './core.js';
import {downloadFile, loadVendor, vendorUrl} from './vendor-loader.js';

const PDF_MIME = 'application/pdf';
const WORD_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const textLimit = 150000;
const MB = 1024 * 1024;
const sizes = {a4: [595.28, 841.89], letter: [612, 792]};
const extension = file => file.name.split('.').at(-1).toLowerCase();
let pdfReader;
let fontBytes;

export function documentName(value, fallback = 'octo-document') {
  return value.trim().replace(/[\\/:*?"<>|\u0000-\u001F]/g, '-').replace(/^\.+/, '').slice(0, 90) || fallback;
}

async function getPdfReader() {
  pdfReader ||= import(vendorUrl('pdfjs/pdf.mjs')).then(module => {
    module.GlobalWorkerOptions.workerSrc = vendorUrl('pdfjs/pdf.worker.mjs');
    return module;
  });
  try { return await pdfReader; }
  catch (error) { pdfReader = null; throw error; }
}

function pageText(items) {
  let text = '';
  let lastY;
  for (const item of items) {
    if (typeof item.str !== 'string') continue;
    const y = item.transform?.[5];
    if (text && !text.endsWith('\n')) {
      text += lastY !== undefined && y !== undefined && Math.abs(y - lastY) > 4 ? '\n' : ' ';
    }
    text += item.str;
    if (item.hasEOL) text += '\n';
    lastY = y;
  }
  return text.trim();
}

export async function readLocalDocument(file) {
  if (file.size > 20 * MB) throw Error('Choose a document of 20 MB or less.');
  const kind = extension(file);
  let text;
  if (kind === 'txt') {
    text = await file.text();
  } else if (kind === 'docx') {
    const bytes = await file.arrayBuffer();
    const signature = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
    if (signature[0] !== 80 || signature[1] !== 75) throw Error('This file is not a readable Word DOCX.');
    try {
      const mammoth = await loadVendor('mammoth.js', 'mammoth');
      text = (await mammoth.extractRawText({arrayBuffer: bytes})).value;
    } catch {
      throw Error('Could not read this Word file. Open it in Word and save a new DOCX copy.');
    }
  } else if (kind === 'pdf') {
    const pdfjs = await getPdfReader();
    const task = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      cMapUrl: vendorUrl('pdfjs/cmaps/'),
      cMapPacked: true,
      standardFontDataUrl: vendorUrl('pdfjs/standard_fonts/'),
      disableFontFace: true,
      isEvalSupported: false
    });
    try {
      const pdf = await task.promise;
      if (pdf.numPages > 200) throw Error('Split this PDF into files of 200 pages or less before extracting text.');
      const pages = [];
      let length = 0;
      for (let page = 1; page <= pdf.numPages && length <= textLimit; page++) {
        const view = await pdf.getPage(page);
        const value = pageText((await view.getTextContent()).items);
        pages.push(value);
        length += value.length + 2;
        view.cleanup();
      }
      text = pages.join('\n\n');
    } catch (error) {
      if (error.name === 'PasswordException') throw Error('Save an unlocked copy of this PDF before importing.');
      throw error;
    } finally {
      await task.destroy().catch(() => {});
    }
  } else {
    throw Error('Choose a PDF, DOCX, or TXT file.');
  }
  if (typeof text !== 'string' || !text.trim()) {
    throw Error(kind === 'pdf'
      ? 'This PDF has no selectable text. Run OCR before converting it to Word.'
      : 'No text was found in this document.');
  }
  return {text: text.slice(0, textLimit), truncated: text.length > textLimit};
}

async function getFont(pdf, customFont) {
  const kit = await loadVendor('fontkit.js', 'fontkit');
  pdf.registerFontkit(kit);
  if (customFont?.size > 12 * MB) throw Error('Choose a font file of 12 MB or less.');
  let bytes;
  if (customFont) {
    bytes = await customFont.arrayBuffer();
  } else {
    fontBytes ||= fetch(vendorUrl('DejaVuSans.ttf')).then(response => {
      if (!response.ok) throw Error('The PDF font could not be loaded.');
      return response.arrayBuffer();
    });
    try { bytes = await fontBytes; }
    catch (error) { fontBytes = null; throw error; }
  }
  return pdf.embedFont(bytes, {subset: true});
}

function wrapText(text, font, pointSize, width) {
  const lines = [];
  for (const paragraph of text.split('\n')) {
    if (!paragraph) { lines.push(''); continue; }
    let line = '';
    for (const token of paragraph.match(/\S+|\s+/gu) ?? []) {
      const next = line + token;
      if (font.widthOfTextAtSize(next, pointSize) <= width) {
        line = next;
      } else {
        if (line.trim()) lines.push(line.trimEnd());
        line = token.trimStart();
        if (font.widthOfTextAtSize(line, pointSize) <= width) continue;
        let chunk = '';
        for (const char of line) {
          if (chunk && font.widthOfTextAtSize(chunk + char, pointSize) > width) {
            lines.push(chunk);
            chunk = '';
          }
          chunk += char;
        }
        line = chunk;
      }
    }
    if (line.trim()) lines.push(line.trimEnd());
  }
  return lines;
}

async function textPdf({text, title, paper, pointSize, pageNumbers, customFont}) {
  const {PDFDocument, rgb} = await loadVendor('pdf-lib.js', 'PDFLib');
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  const font = await getFont(pdf, customFont);
  const content = text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
  const supported = new Set(font.getCharacterSet());
  if ([...content].some(char => char !== '\n' && !supported.has(char.codePointAt(0)))) {
    throw Error('Choose a TTF or OTF font that includes all the characters in this document.');
  }

  const [width, height] = sizes[paper] ?? sizes.a4;
  const margin = 52;
  const lines = wrapText(content, font, pointSize, width - 2 * margin);
  const lineHeight = pointSize * 1.55;
  let page = pdf.addPage([width, height]);
  let y = height - margin - pointSize;
  for (const line of lines) {
    if (y < margin) {
      page = pdf.addPage([width, height]);
      y = height - margin - pointSize;
    }
    if (line) page.drawText(line, {x: margin, y, size: pointSize, font, color: rgb(.12, .17, .25)});
    y -= lineHeight;
  }
  if (pageNumbers) {
    pdf.getPages().forEach((item, index) => {
      item.drawText(String(index + 1), {x: width - margin - 14, y: 28, size: 9, font, color: rgb(.32, .37, .45)});
    });
  }
  return pdf.save();
}

async function wordDocument(text, title) {
  const {Document, Packer, Paragraph, TextRun} = await loadVendor('docx.js', 'docx');
  const children = text.replace(/\r\n?/g, '\n').split('\n').map(line =>
    new Paragraph({children: [new TextRun(line)], spacing: {after: 90}})
  );
  return Packer.toBlob(new Document({title, creator: 'Octo AI', sections: [{children}]}));
}

const htmlText = value => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
async function exportText(format, config) {
  if (format === 'pdf') return [await textPdf(config), PDF_MIME];
  if (format === 'docx') return [await wordDocument(config.text, config.title), WORD_MIME];
  if (format === 'json') {
    return [JSON.stringify({title: config.title, text: config.text, wordCount: countWords(config.text)}, null, 2), 'application/json;charset=utf-8'];
  }
  if (format === 'html') {
    const title = htmlText(config.title);
    return ['<!doctype html><html lang="en"><meta charset="utf-8"><title>' + title
      + '</title><body><pre style="white-space:pre-wrap;font:inherit">' + htmlText(config.text) + '</pre></body></html>', 'text/html;charset=utf-8'];
  }
  return [config.text, (format === 'md' ? 'text/markdown' : 'text/plain') + ';charset=utf-8'];
}

export function initDocumentStudio({getDraft, sendToDraft}) {
  const $ = id => document.getElementById(id);
  const input = $('doc-input');
  const text = $('doc-text');
  const status = $('doc-export-status');
  const format = $('doc-format');
  const download = $('doc-create');
  let upload = 0;
  let edits = 0;
  let exporting = false;

  function updateText(value) {
    if (typeof value === 'string') text.value = value;
    edits++;
    $('doc-word-stat').textContent = countWords(text.value).toLocaleString() + ' words';
    $('doc-char-stat').textContent = text.value.length.toLocaleString() + ' characters';
    download.disabled = exporting || !text.value.trim();
  }

  function updateFormat() {
    $('doc-pdf-settings').hidden = format.value !== 'pdf';
    download.textContent = 'Download ' + (format.value === 'docx' ? 'Word' : format.value.toUpperCase());
  }

  const workflows = {
    word: ['docx', 'PDF to Word', 'Open a PDF with selectable text and download its text in an editable Word document.'],
    pdf: ['pdf', 'Word to PDF', 'Open a DOCX file, review the text, and download a paginated PDF.'],
    maker: ['pdf', 'PDF maker', 'Write or paste text, choose a page layout, and download your PDF.']
  };

  const workflowButtons = [...document.querySelectorAll('.feature-switches [data-doc-workflow]')];
  function markWorkflow(active) {
    workflowButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.docWorkflow === active)));
  }

  document.querySelectorAll('[data-doc-workflow]').forEach(control => {
    control.addEventListener('click', () => {
      const [output, name, description] = workflows[control.dataset.docWorkflow];
      format.value = output;
      $('doc-heading').textContent = name;
      $('doc-instruction').textContent = description;
      markWorkflow(control.dataset.docWorkflow);
      updateFormat();
    });
  });

  input.onchange = async () => {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    const id = ++upload;
    const old = edits;
    status.textContent = 'Reading ' + file.name + '…';
    try {
      const result = await readLocalDocument(file);
      if (id !== upload) return;
      if (old !== edits) {
        status.textContent = 'The draft changed during import. Choose the file again to replace it.';
        return;
      }
      updateText(result.text);
      $('doc-title').value = file.name.replace(/\.[^.]+$/, '');
      $('doc-file-name').textContent = file.name;
      status.textContent = result.truncated ? 'Imported the first 150,000 characters.' : 'Text imported. Choose a format to download.';
    } catch (error) {
      if (id === upload) status.textContent = error.message || 'This file could not be read.';
    }
  };

  $('doc-import-draft').onclick = () => {
    const draft = getDraft();
    if (!draft.trim()) { status.textContent = 'The writing editor has no draft to import.'; return; }
    updateText(draft);
    status.textContent = 'Current writing draft imported.';
    text.focus();
  };

  $('doc-send-to-draft').onclick = () => {
    if (!text.value.trim()) { status.textContent = 'Enter or import text first.'; return; }
    sendToDraft(text.value);
  };

  text.addEventListener('input', () => updateText());
  format.addEventListener('change', () => { markWorkflow(null); updateFormat(); });
  $('doc-form').onsubmit = async event => {
    event.preventDefault();
    if (exporting || !text.value.trim()) return;
    if (text.value.length > textLimit) { status.textContent = 'Limit exports to 150,000 characters.'; return; }
    const output = format.value;
    const name = documentName($('doc-title').value);
    exporting = true;
    download.disabled = true;
    status.textContent = 'Creating your ' + output.toUpperCase() + '…';
    try {
      const [data, type] = await exportText(output, {
        text: text.value,
        title: name,
        paper: $('doc-paper').value,
        pointSize: Number($('doc-font-size').value),
        pageNumbers: $('doc-page-numbers').checked,
        customFont: $('doc-font-file').files[0]
      });
      const result = await downloadFile(data, type, name + '.' + output);
      status.textContent = result === 'cancelled' ? 'Save cancelled.'
        : output.toUpperCase() + (result === 'saved' ? ' saved.' : ' download started.');
    } catch (error) {
      status.textContent = error.message || 'Could not create this document.';
    } finally {
      exporting = false;
      download.disabled = !text.value.trim();
    }
  };
  markWorkflow('maker');
  updateFormat();
  updateText();
}

export function pageIndices(input, total) {
  if (!input.trim()) throw Error('Enter a page range such as 1–3, 5.');
  const indices = new Set();
  for (const part of input.split(',')) {
    const range = part.trim().match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
    if (!range) throw Error('Separate numbers and ranges with commas, such as 1–3, 5.');
    const first = Number(range[1]);
    const last = Number(range[2] ?? first);
    if (first < 1 || last < first || last > total) throw Error('Choose pages between 1 and ' + total + '.');
    for (let page = first; page <= last; page++) indices.add(page - 1);
  }
  return [...indices];
}

export function initPdfTools() {
  const $ = id => document.getElementById(id);
  const mode = $('pdf-tool-mode');
  const files = $('pdf-tool-files');
  const status = $('pdf-tool-status');
  const action = $('pdf-tool-create');

  function updateMode() {
    const pictures = mode.value === 'images';
    files.accept = pictures ? 'image/jpeg,image/png,.jpg,.jpeg,.png' : 'application/pdf,.pdf';
    files.multiple = mode.value !== 'split';
    $('pdf-range-field').hidden = mode.value !== 'split';
    $('pdf-tool-paper-field').hidden = !pictures;
    $('pdf-tool-file-names').textContent = '';
    files.value = '';
    status.textContent = '';
  }
  mode.onchange = updateMode;
  document.querySelectorAll('[data-pdf-tool]').forEach(control => {
    control.addEventListener('click', () => {
      mode.value = control.dataset.pdfTool;
      updateMode();
    });
  });
  files.onchange = () => {
    $('pdf-tool-file-names').textContent = [...files.files].map(file => file.name).join(' · ');
  };

  $('pdf-tool-form').onsubmit = async event => {
    event.preventDefault();
    if (action.disabled) return;
    const chosen = [...files.files];
    const operation = mode.value;
    const paper = sizes[$('pdf-tool-paper').value] ?? sizes.a4;
    const ranges = $('pdf-tool-ranges').value;
    if (!chosen.length) { status.textContent = 'Choose files first.'; return; }
    if (operation === 'merge' && chosen.length < 2) { status.textContent = 'Choose at least two PDF files.'; return; }
    if (chosen.length > 24 || chosen.reduce((sum, file) => sum + file.size, 0) > 60 * MB) {
      status.textContent = 'Choose up to 24 files with a combined size of 60 MB or less.';
      return;
    }
    action.disabled = true;
    status.textContent = 'Building PDF…';
    try {
      const {PDFDocument} = await loadVendor('pdf-lib.js', 'PDFLib');
      const pdf = await PDFDocument.create();
      for (const file of chosen) {
        const bytes = await file.arrayBuffer();
        if (operation === 'images') {
          const image = extension(file) === 'png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
          const [width, height] = paper;
          const page = pdf.addPage(paper);
          const scale = Math.min((width - 64) / image.width, (height - 64) / image.height);
          const scaled = image.scale(scale);
          page.drawImage(image, {x: (width - scaled.width) / 2, y: (height - scaled.height) / 2, ...scaled});
        } else {
          const source = await PDFDocument.load(bytes);
          if (source.getPageCount() > 400) throw Error('Choose PDFs of 400 pages or fewer.');
          const selected = operation === 'split'
            ? pageIndices(ranges, source.getPageCount()) : source.getPageIndices();
          if (selected.length + pdf.getPageCount() > 400) throw Error('The resulting file is limited to 400 pages.');
          for (const page of await pdf.copyPages(source, selected)) pdf.addPage(page);
        }
      }
      const result = await downloadFile(await pdf.save(), PDF_MIME, documentName($('pdf-tool-name').value, 'octo-pages') + '.pdf');
      status.textContent = result === 'cancelled' ? 'Save cancelled.'
        : pdf.getPageCount().toLocaleString() + ' pages · ' + (result === 'saved' ? 'PDF saved.' : 'PDF download started.');
    } catch (error) {
      status.textContent = error.message || 'Could not read one of the selected files.';
    } finally {
      action.disabled = false;
    }
  };
  updateMode();
}
