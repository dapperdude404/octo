import { countWords, localAnalyze, improveClarity, grammarReview, compareDrafts } from './core.js';
import { initAssistant } from './assistant.js';
import { documentName, initDocumentStudio, initPdfTools, readLocalDocument } from './documents.js';
import { downloadFile } from './vendor-loader.js';
import { initVision } from './vision.js';

const $ = id => document.getElementById(id);
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

function readSetting(area, key) {
  try {
    return window[area].getItem(key);
  } catch {
    return null;
  }
}

function writeSetting(area, key, value) {
  try {
    if (value === null) window[area].removeItem(key);
    else window[area].setItem(key, value);
  } catch {
    // The workspace also works when browser storage is disabled.
  }
}

const state = {
  tab: 'overview',
  user: null,
  token: readSetting('sessionStorage', 'octo_token') || '',
  authMode: 'login',
  original: null,
  revision: null,
  draftVersion: 0
};
let toastTimer;
let stopCamera = () => {};

function notify(message) {
  $('toast').textContent = message;
  $('toast').classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.add('hidden'), 3800);
}

let apiHost = readSetting('localStorage', 'octo_api_base');
function apiBase() {
  const fallback = location.hostname.endsWith('.github.io')
    ? 'https://ai-octopus-api-l83b.onrender.com' : '';
  return (apiHost || fallback).replace(/\/$/, '');
}

async function api(route, options = {}) {
  const headers = new Headers(options.headers);
  if (state.token) headers.set('Authorization', `Bearer ${state.token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  let response;
  try {
    response = await fetch(`${apiBase()}${route}`, { ...options, headers });
  } catch {
    throw Error('Could not reach the Octo AI server. Check the API address in account settings.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const message = !apiBase() && [404, 405, 501].includes(response.status)
      ? 'Connect an Octo AI API server in account settings to use this feature.'
      : `The server could not complete the request (${response.status}).`;
    throw Error(data?.error || message);
  }
  return data;
}

const authModal = $('auth-modal');
const authDialog = authModal.querySelector('[role="dialog"]') || authModal;
const appShell = $('app-shell');
let authTrigger;
let previousOverflow;

function showAuthMode(mode) {
  state.authMode = mode;
  const registering = mode === 'register';
  $('auth-title').textContent = registering ? 'Create your account' : 'Welcome back';
  $('auth-sub').textContent = registering
    ? 'Save provider scans in your personal workspace.'
    : 'Sign in to access connected tools and saved scans.';
  $('name-wrap').classList.toggle('hidden', !registering);
  $('password').autocomplete = registering ? 'new-password' : 'current-password';
  $('auth-submit').textContent = registering ? 'Create account' : 'Sign in';
  $('auth-switch-copy').textContent = registering ? 'Already have an account?' : 'New to Octo AI?';
  $('auth-switch').textContent = registering ? 'Sign in' : 'Create account';
  $('auth-error').textContent = '';
  if ($('oauth-error')) $('oauth-error').textContent = '';
}

function renderAuth() {
  const signedIn = Boolean(state.user);
  $('auth-form').classList.toggle('hidden', signedIn);
  $('auth-switch-copy').parentElement.classList.toggle('hidden', signedIn);
  $('oauth-options')?.classList.toggle('hidden', signedIn);
  $('auth-signed-in').classList.toggle('hidden', !signedIn);
  if (signedIn) {
    $('auth-title').textContent = 'Your account';
    $('auth-sub').textContent = 'Manage your sign-in and API connection.';
    $('signed-in-email').textContent = `Signed in as ${state.user.email}`;
  } else {
    showAuthMode(state.authMode);
  }
}

function openAuth(trigger = document.activeElement) {
  if (!authModal.classList.contains('hidden')) return;
  authTrigger = trigger;
  previousOverflow = document.body.style.overflow;
  renderAuth();
  $('api-host').value = apiBase();
  authModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  if (appShell && !appShell.contains(authModal)) appShell.inert = true;
  $('auth-close').focus();
}

function closeAuth() {
  if (authModal.classList.contains('hidden')) return;
  authModal.classList.add('hidden');
  document.body.style.overflow = previousOverflow;
  if (appShell && !appShell.contains(authModal)) appShell.inert = false;
  const target = authTrigger instanceof HTMLElement && authTrigger.getClientRects().length
    ? authTrigger : $('account-button');
  target.focus();
}

function updateAccount() {
  const label = state.user ? 'Account' : 'Sign in';
  $('account-button').textContent = label;
  if ($('mobile-account')) $('mobile-account').textContent = label;
  if (!authModal.classList.contains('hidden')) renderAuth();
}

function clearSession() {
  state.token = '';
  state.user = null;
  writeSetting('sessionStorage', 'octo_token', null);
  updateAccount();
  renderProviders([]);
  if (state.tab === 'history') renderHistory(null);
}

function acceptSession(data) {
  state.token = data.token;
  state.user = data.user;
  writeSetting('sessionStorage', 'octo_token', state.token);
  updateAccount();
  if (state.tab === 'history') loadHistory();
}

$('account-button').onclick = event => openAuth(event.currentTarget);
if ($('mobile-account')) $('mobile-account').onclick = () => {
  closeMenu();
  openAuth($('menu-toggle') || $('account-button'));
};
$('auth-close').onclick = closeAuth;
authModal.addEventListener('click', event => {
  if (event.target === authModal) closeAuth();
});
$('auth-switch').onclick = () => showAuthMode(state.authMode === 'login' ? 'register' : 'login');

function keepFocusInAuth(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeAuth();
  }
  if (event.key !== 'Tab') return;
  const focusable = [...authDialog.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex]')]
    .filter(item => item.tabIndex >= 0 && !item.matches(':disabled') && item.getClientRects().length);
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

$('auth-form').onsubmit = async event => {
  event.preventDefault();
  const button = $('auth-submit');
  const host = apiBase();
  const mode = state.authMode;
  button.disabled = true;
  $('auth-error').textContent = '';
  try {
    const input = { email: $('email').value.trim(), password: $('password').value };
    if (mode === 'register') input.displayName = $('display-name').value.trim();
    const data = await api(`/api/auth/${mode}`, { method: 'POST', body: JSON.stringify(input) });
    if (apiBase() !== host) return;
    if (!data.token || !data.user) throw Error('The server did not return an account session.');
    acceptSession(data);
    $('password').value = '';
    closeAuth();
    notify('Signed in to Octo AI.');
  } catch (error) {
    $('auth-error').textContent = error.message;
  } finally {
    button.disabled = false;
  }
};

$('logout').onclick = () => {
  clearSession();
  closeAuth();
  notify('Signed out.');
};

$('save-api-host').onclick = event => {
  event.preventDefault();
  const input = $('api-host');
  let value = input.value.trim();
  if (value) {
    try {
      const url = new URL(value);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw Error('Unsupported API address.');
      }
      value = url.href.replace(/\/$/, '');
    } catch {
      notify('Enter a complete HTTP or HTTPS API address, without credentials or URL parameters.');
      input.focus();
      return;
    }
  }
  const previous = apiBase();
  apiHost = value;
  writeSetting('localStorage', 'octo_api_base', value);
  if (previous !== apiBase()) clearSession();
  input.value = apiBase();
  notify('API address saved.');
};

document.querySelectorAll('[data-oauth]').forEach(button => {
  button.onclick = async () => {
    const errorMessage = $('oauth-error');
    const provider = button.dataset.oauth;
    const host = apiBase();
    errorMessage.textContent = '';
    button.disabled = true;
    try {
      const result = await api('/api/auth/oauth/status');
      if (apiBase() !== host) return;
      if (!result[provider]) throw Error('This sign-in provider is unavailable on the configured server.');
      location.assign(`${host}/api/auth/oauth/${encodeURIComponent(provider)}/start`);
    } catch (error) {
      errorMessage.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
});

async function completeOAuth() {
  const params = new URLSearchParams(location.hash.slice(1));
  const code = params.get('octo_oauth_code');
  const error = params.get('octo_oauth_error');
  if (!code && !error) return false;
  history.replaceState(null, '', location.pathname + location.search);
  try {
    if (error) throw Error(error === 'account_exists'
      ? 'An account already uses this email. Sign in with your existing method.'
      : 'Social sign-in was cancelled or could not be completed.');
    const result = await api('/api/auth/oauth/exchange', { method: 'POST', body: JSON.stringify({ code }) });
    if (!result.token || !result.user) throw Error('The server did not return an account session.');
    acceptSession(result);
    notify('Signed in to Octo AI.');
    return true;
  } catch (failure) {
    openAuth();
    if ($('oauth-error')) $('oauth-error').textContent = failure.message;
    return false;
  }
}

const tools = {
  overview: {title: 'Overview', description: 'Choose a tool to start working.', mode: 'Local tools ready'},
  assistant: {title: 'AI Assistant', description: 'Outline an idea, revise a draft, or connect to an AI model.'},
  detector: {
    title: 'AI Pattern Detector', description: 'See which writing patterns stand out in your draft.',
    action: 'Analyze writing', help: 'Use at least 40 words for a pattern estimate.'
  },
  editor: {
    title: 'Clarity Editor', description: 'Review concise alternatives for common wordy phrases.',
    action: 'Improve clarity', help: 'Review suggestions before applying them to your draft.'
  },
  grammar: {
    title: 'Grammar Review', description: 'Check punctuation, repeated words, and common errors.',
    action: 'Check grammar', help: 'Review the suggestions and choose which edits to keep.'
  },
  compare: {
    title: 'Compare Drafts', description: 'See what changed between two versions of your writing.',
    action: 'Compare versions', help: 'Add the revised draft in the comparison panel.'
  },
  documents: {title: 'Document Studio', description: 'Convert PDF and Word documents or build a PDF from text.'},
  'pdf-tools': {title: 'PDF Pages', description: 'Organize PDFs and turn images into documents.'},
  vision: {title: 'Face Recognition', description: 'Compare a photo with the profiles saved on your device.'},
  providers: {
    title: 'Provider Scans', description: 'Submit a draft to your configured third-party providers.',
    action: 'Submit scans', help: 'Provider scans require an account and server-side API keys.',
    mode: 'Account required'
  },
  history: {
    title: 'Scan History', description: 'Review previously submitted scans from your account.',
    mode: 'Account required'
  }
};
const tabs = [...document.querySelectorAll('[data-tab]')];
const tabList = tabs[0]?.closest('[role="tablist"]');
const narrowTabs = matchMedia('(max-width: 820px)');

function updateTabOrientation() {
  const vertical = tabList?.closest('.sidebar') && !narrowTabs.matches;
  tabList?.setAttribute('aria-orientation', vertical ? 'vertical' : 'horizontal');
}

function selectTab(tab, { navigate = false } = {}) {
  const details = tools[tab];
  if (!Object.hasOwn(tools, tab) || !$(`${tab}-view`)) return;
  if (state.tab === 'vision' && tab !== 'vision') stopCamera();
  state.tab = tab;
  tabs.forEach(button => {
    const active = button.dataset.tab === tab;
    button.tabIndex = active ? 0 : -1;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
    $(`${button.dataset.tab}-view`)?.classList.toggle('hidden', !active);
  });
  const workspace = $('workspace');
  workspace.dataset.activeTool = tab;
  $('shared-editor-column').classList.toggle('hidden', !details.action);
  if ($('workspace-title')) $('workspace-title').textContent = details.title;
  if ($('workspace-crumb')) $('workspace-crumb').textContent = details.title;
  if ($('workspace-description')) $('workspace-description').textContent = details.description;
  if ($('workspace-mode-copy')) $('workspace-mode-copy').textContent = details.mode || 'Runs in browser';
  if ($('workspace-mode')) $('workspace-mode').hidden = tab === 'assistant';
  if (details.action) {
    const primary = $('primary-action');
    const label = primary.querySelector('[data-action-label]');
    if (label) label.textContent = details.action;
    else if (primary.firstChild?.nodeType === Node.TEXT_NODE) primary.firstChild.textContent = details.action + ' ';
    else primary.textContent = details.action;
    $('editor-help').textContent = details.help;
  }
  if (tab === 'history') loadHistory();
  syncPrimaryAction();
  if (navigate) {
    tabs.find(button => button.dataset.tab === tab)?.focus({ preventScroll: true });
    workspace.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
}

tabs.forEach((button, i) => {
  const tab = button.dataset.tab;
  const panel = $(`${tab}-view`);
  if (!panel) return;
  button.id ||= `${tab}-tab`;
  button.setAttribute('aria-controls', panel.id);
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', button.id);
  if (!panel.hasAttribute('tabindex')) panel.tabIndex = 0;
  button.onclick = () => selectTab(tab);
  button.onkeydown = event => {
    const count = tabs.length;
    let target;
    if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = count - 1;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') target = (i + count - 1) % count;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') target = (i + 1) % count;
    else return;
    event.preventDefault();
    selectTab(tabs[target].dataset.tab);
    tabs[target].focus();
  };
});
narrowTabs.addEventListener('change', updateTabOrientation);
updateTabOrientation();

document.querySelectorAll('[data-goto]').forEach(control => {
  control.addEventListener('click', event => {
    event.preventDefault();
    closeMenu();
    selectTab(control.dataset.goto, { navigate: true });
  });
});

const menu = $('mobile-nav');
const menuToggle = $('menu-toggle');

function closeMenu() {
  menu?.classList.add('hidden');
  menuToggle?.setAttribute('aria-expanded', 'false');
}

if (menu && menuToggle) {
  menuToggle.onclick = () => {
    const closed = menu.classList.toggle('hidden');
    menuToggle.setAttribute('aria-expanded', String(!closed));
  };
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
}
document.addEventListener('keydown', event => {
  if (!authModal.classList.contains('hidden')) {
    keepFocusInAuth(event);
  } else if (event.key === 'Escape' && menu && !menu.classList.contains('hidden')) {
    closeMenu();
    menuToggle?.focus();
  }
});

const paletteSelector = $('theme-palette');
const palettes = ['aurora', 'plasma', 'solar', 'ocean', 'forest'];

function setPalette(value) {
  const palette = palettes.includes(value) ? value : 'aurora';
  document.documentElement.dataset.palette = palette;
  paletteSelector.value = palette;
  writeSetting('localStorage', 'octo_palette', palette);
}

function setTheme(light) {
  document.documentElement.classList.toggle('light', light);
  const button = $('theme-toggle');
  const label = light ? 'Switch to dark theme' : 'Switch to light theme';
  button.setAttribute('aria-label', label);
  button.title = label;
  const icon = button.querySelector('use');
  if (icon && $('i-sun') && $('i-moon')) icon.setAttribute('href', light ? '#i-moon' : '#i-sun');
  else if (!icon) button.textContent = light ? '☾' : '☀';
  writeSetting('localStorage', 'octo_theme', light ? 'light' : 'dark');
}

paletteSelector.onchange = () => setPalette(paletteSelector.value);
$('theme-toggle').onclick = () => setTheme(!document.documentElement.classList.contains('light'));
setPalette(readSetting('localStorage', 'octo_palette'));
setTheme(readSetting('localStorage', 'octo_theme') === 'light');

const editor = $('editor');
const emptyResults = {
  detectorLabel: $('score-label').textContent,
  detectorSummary: $('score-summary').textContent,
  detectorTag: $('result-tag').textContent,
  signals: $('signals-list').innerHTML,
  signalsCount: $('signals-count').textContent,
  revision: $('revision-preview').textContent,
  grammarLabel: $('grammar-summary').textContent,
  grammarSummary: $('grammar-sub').textContent,
  grammar: $('grammar-list').innerHTML,
  comparison: $('compare-results').innerHTML
};
const currentResults = new Set();
let uploadId = 0;
let scanInProgress = false;

function updateCounts() {
  const value = editor.value;
  const words = countWords(value);
  const wordCount = `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'}`;
  const characterCount = `${value.length.toLocaleString()} ${value.length === 1 ? 'character' : 'characters'}`;
  $('word-count').textContent = wordCount;
  $('char-count').textContent = characterCount;
  $('read-time').textContent = `${Math.ceil(words / 220)} min read`;
}

function resetDetector() {
  $('score-number').textContent = '—';
  $('score-label').textContent = emptyResults.detectorLabel;
  $('score-label').style.removeProperty('color');
  $('score-summary').textContent = emptyResults.detectorSummary;
  $('score-ring').style.removeProperty('--percent');
  $('score-ring').style.removeProperty('--ring-color');
  $('score-ring').setAttribute('aria-valuenow', '0');
  $('score-ring').setAttribute('aria-valuetext', 'No score yet');
  $('score-pin').style.left = '0%';
  $('result-tag').textContent = emptyResults.detectorTag;
  $('signals-count').textContent = emptyResults.signalsCount;
  $('signals-list').innerHTML = emptyResults.signals;
}

function resetClarity() {
  state.original = null;
  state.revision = null;
  $('revision-preview').textContent = emptyResults.revision;
  $('apply-revision').disabled = true;
  $('restore-original').disabled = true;
  $('copy-revision').disabled = true;
}

function resetGrammar() {
  $('grammar-summary').textContent = emptyResults.grammarLabel;
  $('grammar-sub').textContent = emptyResults.grammarSummary;
  $('grammar-list').innerHTML = emptyResults.grammar;
}

function resetComparison() {
  $('compare-results').innerHTML = emptyResults.comparison;
}

function draftChanged({ keepRevision = false } = {}) {
  state.draftVersion += 1;
  updateCounts();
  if (currentResults.delete('detector')) resetDetector();
  if (currentResults.delete('grammar')) resetGrammar();
  if (currentResults.delete('compare')) resetComparison();
  if (!keepRevision && currentResults.delete('editor')) resetClarity();
}

function setText(value, { keepRevision = false, filename = '' } = {}) {
  editor.value = String(value);
  $('file-name').textContent = filename;
  draftChanged({ keepRevision });
}

editor.addEventListener('input', () => draftChanged());
$('compare-text').addEventListener('input', () => {
  if (currentResults.delete('compare')) resetComparison();
});

const sample = `Writing is a way to think more clearly and make ideas useful to other people. When a draft feels complicated, I read it aloud and look for sentences trying to do too much. I might change the order of two ideas or replace a long phrase with a shorter one. Moreover, a good revision should preserve the writer's intention. It is important to note that no single writing pattern can tell us who wrote a passage. In conclusion, useful feedback points to specific changes and gives writers room for their own judgment.`;

$('sample-button').onclick = () => {
  setText(sample);
  notify('Sample draft loaded.');
};
$('clear-button').onclick = () => {
  setText('');
  editor.focus();
  notify('Draft cleared.');
};
$('paste-button').onclick = async () => {
  const version = state.draftVersion;
  try {
    const value = await navigator.clipboard.readText();
    if (state.draftVersion !== version) return;
    if (!value) return notify('Your clipboard is empty.');
    setText(value);
    notify('Clipboard text pasted.');
  } catch {
    notify('Paste directly into the editor to use text from your clipboard.');
    editor.focus();
  }
};

async function copyText(value, message) {
  if (!value.trim()) return notify('Add text before copying.');
  try {
    await navigator.clipboard.writeText(value);
    notify(message);
  } catch {
    notify('Clipboard access is unavailable in this browser.');
  }
}

$('copy-button').onclick = () => copyText(editor.value, 'Draft copied.');
$('download-button').onclick = () => {
  if (!editor.value.trim()) return notify('Add a draft before downloading.');
  const name = documentName($('file-name').textContent.replace(/\.[^.]+$/, ''), 'octo-draft');
  downloadFile(editor.value, 'text/plain;charset=utf-8', name + '.txt');
};
$('upload-button')?.addEventListener('click', () => $('file').click());

$('file').onchange = async event => {
  const file = event.currentTarget.files?.[0];
  event.currentTarget.value = '';
  if (!file) return;
  const ticket = ++uploadId;
  const version = state.draftVersion;
  const uploadButton = $('upload-button');
  if (uploadButton) uploadButton.disabled = true;
  try {
    const {text: value, truncated} = await readLocalDocument(file);
    if (ticket !== uploadId) return;
    if (version !== state.draftVersion) return notify('Your draft changed while importing. Choose the file again to replace it.');
    setText(value, { filename: file.name });
    notify(truncated ? 'Imported the first 150,000 characters.' : 'Document imported.');
  } catch (error) {
    if (ticket === uploadId) notify(error.message);
  } finally {
    if (ticket === uploadId && uploadButton) uploadButton.disabled = false;
  }
};

function runDetector() {
  const result = localAnalyze(editor.value.trim());
  if (!result.available) return notify(result.note);
  currentResults.add('detector');
  const signalColor = result.score < 30 ? 'var(--mint)' : result.score < 60 ? 'var(--amber)' : 'var(--red)';
  $('score-number').textContent = result.score;
  $('score-ring').style.setProperty('--percent', `${result.score}%`);
  $('score-ring').style.setProperty('--ring-color', signalColor);
  $('score-ring').setAttribute('aria-valuenow', result.score);
  $('score-ring').setAttribute('aria-valuetext', `${result.score} out of 100`);
  $('score-pin').style.left = `${result.score}%`;
  $('score-label').textContent = result.score < 30 ? 'Human-like patterns'
    : result.score < 60 ? 'Mixed writing signals' : 'AI-like patterns';
  $('score-label').style.color = signalColor;
  $('score-summary').textContent = `Checked ${result.wordCount} words across ${result.sentenceCount} sentences. The score measures writing patterns alone.`;
  $('result-tag').textContent = 'ANALYZED';
  const components = result.components;
  const signals = [
    ['Stock expressions', components.stockPhrases, `Selected phrases: ${result.matches.join(', ') || 'none'}`],
    ['Sentence rhythm', components.evenSentenceLength, 'Similarity in sentence lengths'],
    ['Contractions', components.noContractions, 'Absence of contractions in longer passages'],
    ['Em dashes', components.emDashes, 'Em dash frequency'],
    ['Formal transitions', components.formalOpeners, 'Connectives at the start of sentences']
  ];
  const count = signals.filter(([, score]) => score > 0).length;
  $('signals-count').textContent = `${count} ${count === 1 ? 'signal' : 'signals'}`;
  $('signals-list').innerHTML = signals.map(([title, value, detail]) =>
    `<div class="signal-item"><strong>${escapeHtml(title)}</strong>
      <em>+${Number(value).toFixed(1)} pts</em><small>${escapeHtml(detail)}</small></div>`
  ).join('');
  notify('Pattern analysis complete.');
}

function runClarity() {
  if (!editor.value.trim()) return notify('Add a draft first.');
  currentResults.add('editor');
  state.original = editor.value;
  state.revision = improveClarity(state.original);
  $('revision-preview').textContent = state.revision;
  const changed = state.revision !== state.original;
  $('copy-revision').disabled = false;
  $('apply-revision').disabled = !changed;
  $('restore-original').disabled = true;
  notify(changed ? 'Revision ready for review.' : 'No preset changes matched this draft.');
}

$('apply-revision').onclick = () => {
  if (state.revision === null) return;
  setText(state.revision, { keepRevision: true, filename: $('file-name').textContent });
  $('apply-revision').disabled = true;
  $('restore-original').disabled = false;
  notify('Revision applied. Use Restore original to undo.');
};
$('restore-original').onclick = () => {
  if (state.original === null) return;
  setText(state.original, { keepRevision: true, filename: $('file-name').textContent });
  $('restore-original').disabled = true;
  $('apply-revision').disabled = false;
  notify('Original draft restored.');
};
$('copy-revision').onclick = () => copyText(state.revision || '', 'Revision copied.');

function runGrammar() {
  if (!editor.value.trim()) return notify('Add a draft first.');
  currentResults.add('grammar');
  const result = grammarReview(editor.value);
  $('grammar-summary').textContent = result.issueCount
    ? `${result.issueCount} possible ${result.issueCount === 1 ? 'issue' : 'issues'} found`
    : 'No issues matched the current checks';
  $('grammar-sub').textContent = `Checked ${result.wordCount} words across ${result.sentenceCount} sentences.`;
  $('grammar-list').innerHTML = result.issues.length
    ? result.issues.map(item => `<div class="grammar-item"><strong>${escapeHtml(item.type)}</strong>
      <span class="grammar-quote">“${escapeHtml(item.match)}”</span><p>${escapeHtml(item.detail)}</p></div>`).join('')
    : '<div class="empty-insight"><span aria-hidden="true">✓</span><p>No matches for these checks.</p></div>';
  notify('Grammar review complete.');
}

function runCompare() {
  const result = compareDrafts(editor.value, $('compare-text').value);
  if (result.error) return notify(result.error);
  currentResults.add('compare');
  const changes = result.parts.map(({ kind, word }) => {
    const content = escapeHtml(word);
    if (kind === 'added') return `<ins>${content}</ins>`;
    if (kind === 'removed') return `<del>${content}</del>`;
    return content;
  }).join(' ');
  $('compare-results').innerHTML = `<p><b>${result.added} added · ${result.removed} removed</b></p><div>${changes}</div>`;
  notify('Draft comparison complete.');
}
$('compare-button').onclick = runCompare;

function renderProviders(results) {
  $('provider-results').innerHTML = results.map(entry => {
    const title = `${String(entry.provider).toUpperCase()} · ${entry.status}`;
    const summary = entry.error || entry.result?.note || JSON.stringify(entry.result || {}).slice(0, 400);
    return `<div class="provider-item"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(summary)}</p></div>`;
  }).join('') || '<p class="muted">No provider results yet.</p>';
}

function syncPrimaryAction() {
  $('primary-action').disabled = state.tab === 'providers' && scanInProgress;
}

async function runProviders() {
  if (scanInProgress) return;
  if (!state.user) {
    openAuth();
    return;
  }
  const text = editor.value.trim();
  const providers = [...document.querySelectorAll('.provider-option input:checked')].map(box => box.value);
  const kind = $('scan-kind').value;
  if (countWords(text) < 40) return notify('Enter at least 40 words for provider checks.');
  if (!providers.length) return notify('Choose at least one provider.');
  if (kind === 'plagiarism' && providers.includes('gptzero')) return notify('Select Winston AI or Copyleaks for plagiarism checks.');
  const owner = state.token;
  const button = $('scan-button');
  scanInProgress = true;
  button.disabled = true;
  syncPrimaryAction();
  try {
    const payload = { text, providers, kind, title: $('scan-title').value };
    const data = await api('/api/scans', { method: 'POST', body: JSON.stringify(payload) });
    if (state.token !== owner) return;
    renderProviders(data.results || []);
    notify('Scan requests submitted.');
  } catch (error) {
    notify(error.message);
  } finally {
    scanInProgress = false;
    button.disabled = false;
    syncPrimaryAction();
  }
}
$('scan-button').onclick = runProviders;

function renderHistory(scans) {
  const panel = $('history-results');
  if (!state.user) {
    panel.innerHTML = '<div class="empty-insight"><p>Sign in to see your saved provider scans.</p></div><button type="button" class="btn btn-outline" id="history-signin">Sign in</button>';
    $('history-signin').onclick = event => openAuth(event.currentTarget);
    return;
  }
  panel.innerHTML = scans?.length
    ? scans.map(scan => {
      const title = `${String(scan.provider).toUpperCase()} · ${scan.kind}`;
      const detail = `${scan.title || 'Untitled'} · ${scan.wordCount} words · ${new Date(scan.createdAt).toLocaleString()}`;
      return `<div class="history-row"><div class="history-top"><strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(scan.status)}</span></div><p>${escapeHtml(detail)}</p>
        ${scan.error ? `<p>${escapeHtml(scan.error)}</p>` : ''}
        <button type="button" class="subtle-btn" data-id="${escapeHtml(scan.id)}">View record</button></div>`;
    }).join('')
    : '<div class="empty-insight"><p>No saved scans yet.</p></div>';
  panel.querySelectorAll('[data-id]').forEach(button => {
    button.onclick = async () => {
      const owner = state.token;
      button.disabled = true;
      try {
        const { scan } = await api(`/api/scans/${encodeURIComponent(button.dataset.id)}`);
        if (state.token !== owner) return;
        selectTab('providers', { navigate: true });
        renderProviders([scan]);
      } catch (error) {
        notify(error.message);
      } finally {
        button.disabled = false;
      }
    };
  });
}

let historyRequest;
async function loadHistory() {
  if (!state.user) return renderHistory(null);
  const owner = state.token;
  if (historyRequest?.owner === owner) return;
  const request = { owner };
  historyRequest = request;
  $('refresh-history').disabled = true;
  try {
    const { scans } = await api('/api/scans');
    if (state.token === owner) renderHistory(scans);
  } catch (error) {
    notify(error.message);
  } finally {
    if (historyRequest === request) {
      historyRequest = null;
      $('refresh-history').disabled = false;
    }
  }
}
$('refresh-history').onclick = loadHistory;

const primaryActions = {
  detector: runDetector, editor: runClarity, grammar: runGrammar, compare: runCompare,
  providers: runProviders
};
$('primary-action').onclick = () => primaryActions[state.tab]?.();

async function boot() {
  updateCounts();
  resetClarity();
  resetDetector();
  updateAccount();
  const sendToDraft = value => {
    setText(value);
    selectTab('editor', {navigate: true});
    notify('Text added to the writing editor.');
  };
  stopCamera = initVision();
  initDocumentStudio({getDraft: () => editor.value, sendToDraft});
  initPdfTools();
  initAssistant({
    getDraft: () => editor.value,
    setDraft: sendToDraft,
    signedIn: () => Boolean(state.user),
    request: (route, payload) => api(route, payload
      ? {method: 'POST', body: JSON.stringify(payload), signal: AbortSignal.timeout(45000)}
      : {signal: AbortSignal.timeout(8000)})
  });
  selectTab('overview');
  const signedIn = await completeOAuth();
  if (!signedIn && state.token) {
    const token = state.token;
    try {
      const { user } = await api('/api/auth/me');
      if (state.token !== token) return;
      if (!user) throw Error('The server did not return an account.');
      acceptSession({ token, user });
    } catch {
      if (state.token === token) clearSession();
    }
  }
}

boot();
