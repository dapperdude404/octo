import {countWords, getSentences, grammarReview, improveClarity, localAnalyze} from './core.js';

const STORAGE_KEY = 'octa_assistant_history_v1';
const MESSAGE_LIMIT = 4000;
const DRAFT_LIMIT = 16000;
const HISTORY_LIMIT = 24;
const sentenceCounts = {one: 1, two: 2, three: 3, four: 4, five: 5};

const intents = [
  ['proofread', /\b(proofread|grammar|punctuation|typos?|spelling)\b/i],
  ['outline', /\b(outline|structure|organize|organise)\b/i],
  ['summary', /\b(summarize|summarise|summary|main points|key points|shorter|shorten|condense|tldr|tl;dr)\b/i],
  ['clarity', /\b(clarity|clarify|simplify|rewrite|improve|tighten|polish|wording|refine)\b/i],
  ['patterns', /\b(analyze|analyse|patterns?|detect)\b/i],
  ['stats', /\b(count|stats|statistics|reading time|how long|how many)\b/i],
  ['email', /\b(e-?mail)\b/i]
];
const summaryStopWords = new Set('about after again also and are because been before being but can could each for from had has have how into its may more most must only our out over same she some such than that the their them then there these they this those through too under use very was were what when where which who will with would you your'.split(' '));

function findIntent(value) {
  return intents.find(([, pattern]) => pattern.test(value))?.[0];
}

function parsePrompt(value) {
  const boundary = value.search(/:|\n/);
  const instruction = boundary === -1 ? value : value.slice(0, boundary);
  return {instruction, inlineText: findIntent(instruction) && boundary !== -1 ? value.slice(boundary + 1).trim() : ''};
}

function brief(value, limit = 16) {
  const words = value.trim().split(/\s+/);
  return words.length > limit ? words.slice(0, limit).join(' ') + '…' : value.trim();
}

function summarySentences(value, limit) {
  const sentences = getSentences(value.replace(/^\s*[•-]\s+/gm, ''));
  if (sentences.length <= limit) return sentences.length ? sentences : [value];
  const keywords = sentence => (sentence.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [])
    .filter(word => !summaryStopWords.has(word));
  const counts = new Map();
  const terms = sentences.map(sentence => [...new Set(keywords(sentence))]);
  for (const words of terms) {
    for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);
  }
  return sentences.map((sentence, index) => {
    const words = terms[index];
    const weight = words.reduce((sum, word) => sum + counts.get(word) - 1, 0);
    return {sentence, index, weight: weight / Math.max(1, words.length) + (index === 0 ? 0.2 : 0)};
  }).sort((a, b) => b.weight - a.weight || a.index - b.index).slice(0, limit)
    .sort((a, b) => a.index - b.index).map(entry => entry.sentence);
}

function outline(value) {
  const paragraphs = value.split(/\n\s*\n/).map(part => part.trim()).filter(Boolean);
  const points = paragraphs.length > 1 ? paragraphs : summarySentences(value, 4);
  return points.slice(0, 6).map((point, index) => {
    const firstSentence = getSentences(point)[0] || point;
    return `${index + 1}. ${brief(firstSentence)}`;
  }).join('\n');
}

function starterOutline(topic) {
  return [
    `1. Introduce ${topic}`,
    '   Explain why it matters and state the main question.',
    '2. Present the main points',
    '   Group the facts, examples or ideas that support your purpose.',
    '3. Address an open question',
    '   Explain an alternative, a limitation or a detail to research.',
    '4. Close with a takeaway',
    '   Summarize what the reader should remember or do next.'
  ].join('\n');
}

function emailDraft(value) {
  const cleaned = value.trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
  const topic = brief(cleaned, 24);
  const subject = brief(cleaned, 10);
  return [
    `Subject: ${subject.charAt(0).toUpperCase()}${subject.slice(1)}`, '',
    'Hi [Name],', '',
    `I’m reaching out about ${topic}. [Explain the reason for your message.]`, '',
    '[Add any relevant details or timing.]', '',
    'Please let me know [what you would like the recipient to do]. Thank you for your time.', '',
    'Best,',
    '[Your name]'
  ].join('\n');
}

function replyToLocal(prompt, draft, priorReply) {
  const {instruction, inlineText} = parsePrompt(prompt);
  const requested = findIntent(instruction);
  const formatting = /\b(bullets?|one sentence|a paragraph|a list)\b/i.test(instruction);
  const requestOpener = /^(?:please\b|can you\b|could you\b|would you\b)/i.test(instruction)
    || findIntent(instruction.split(/\s+/).slice(0, 3).join(' '));
  const continuing = priorReply?.awaiting && !inlineText && !formatting && !requestOpener;
  const usePrior = !inlineText && priorReply?.replacement
    && (formatting || /\b(it|that|your (?:answer|response|summary|revision))\b/i.test(instruction));
  const intent = continuing ? priorReply.awaiting : requested || (formatting ? 'summary' : null);
  if (!intent) {
    return {content: 'I can outline an idea, draft an email, summarize text, proofread, improve wording, analyze writing patterns, or count words. Include your current draft, or enter a request such as “Summarize: [your text]”.'};
  }
  const topic = instruction.match(/\b(?:about|regarding|for|on)\s+(.+)/i)?.[1].trim();
  if (intent === 'outline' && topic && !inlineText) {
    return {content: `Starter outline\n\n${starterOutline(topic.replace(/[.!?]+$/, ''))}`};
  }
  const value = inlineText || (continuing ? prompt : '') || (intent === 'email' ? topic : '')
    || (usePrior ? priorReply.replacement : '') || draft;
  if (!value) {
    if (intent === 'email') return {content: 'What should the email be about? Send a topic or a few details.', awaiting: intent};
    return {content: 'Paste the text in your next message or select Include current draft, then send the request again.', awaiting: intent};
  }
  if (value.length > DRAFT_LIMIT) {
    return {content: `Send a section of up to ${DRAFT_LIMIT.toLocaleString()} characters at a time.`};
  }

  switch (intent) {
    case 'proofread': {
      const {issues, wordCount} = grammarReview(value);
      if (!issues.length) return {content: `I checked ${wordCount.toLocaleString()} words. The available punctuation, spacing and repetition rules found no issues.`};
      const preview = issues.slice(0, 8).map(issue => `• ${issue.type} near “${issue.match}” — ${issue.detail}`).join('\n');
      const footer = issues.length > 8 ? '\n\nThe Grammar Review panel can show more matches.' : '';
      return {content: `Possible issues to review\n\n${preview}${footer}`};
    }
    case 'outline':
      return {content: `Outline from your text\n\n${outline(value)}`};
    case 'email': {
      const replacement = emailDraft(value);
      return {content: `Email draft\n\n${replacement}`, replacement};
    }
    case 'summary': {
      const length = instruction.toLowerCase().match(/\b([1-5]|one|two|three|four|five)\s+(?:bullet|point|sentence|line)/);
      const shorter = /\b(shorter|shorten|one sentence)\b/i.test(instruction);
      const limit = length ? sentenceCounts[length[1]] || Number(length[1]) : shorter ? 1 : 3;
      const sentences = summarySentences(value, limit);
      const bullets = /\b(bullets?|points?|list)\b/i.test(instruction);
      const replacement = bullets ? sentences.map(sentence => `• ${sentence}`).join('\n') : sentences.join(' ');
      return {content: `Key sentences from your text\n\n${replacement}`, replacement};
    }
    case 'clarity': {
      const replacement = improveClarity(value);
      if (replacement === value) return {content: 'The available clarity rules found no wording or spacing changes to suggest.'};
      return {content: `Suggested wording\n\n${replacement}`, replacement};
    }
    case 'patterns': {
      const result = localAnalyze(value);
      if (!result.available) return {content: result.note};
      const matches = result.matches.length ? `\nCommon expressions found include ${result.matches.slice(0, 6).join(', ')}.` : '';
      return {content: `Pattern score ${result.score}/100 across ${result.wordCount} words. ${result.label}.${matches}\n\nUse the score to review phrasing and sentence structure. Assess authorship using additional evidence.`};
    }
    case 'stats': {
      const words = countWords(value);
      const sentences = getSentences(value).length;
      const minutes = Math.ceil(words / 220);
      return {content: `${words.toLocaleString()} words\n${value.length.toLocaleString()} characters\n${sentences.toLocaleString()} sentences\nAbout ${minutes} min to read`};
    }
  }
}

function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Object.fromEntries(['local', 'connected'].map(mode => [
      mode,
      Array.isArray(saved?.[mode]) ? saved[mode].filter(message => message
        && ['user', 'assistant'].includes(message.role) && typeof message.content === 'string'
        && message.content.length <= DRAFT_LIMIT + MESSAGE_LIMIT)
        .slice(-HISTORY_LIMIT) : []
    ]));
  } catch {
    return {local: [], connected: []};
  }
}

export function initAssistant({getDraft, setDraft, request, signedIn}) {
  const byId = id => document.getElementById(id);
  const form = byId('assistant-form');
  if (!form) return;
  const prompt = byId('assistant-prompt');
  const transcript = byId('assistant-messages');
  const empty = byId('assistant-empty');
  const status = byId('assistant-status');
  const modeSelect = byId('assistant-mode');
  const useDraft = byId('assistant-use-draft');
  const send = byId('assistant-send');
  const clear = byId('assistant-clear');
  const history = loadHistory();
  let mode = 'local';
  let sending = false;
  let connectionCheck = 0;
  const messages = () => history[mode];

  function showStatus(message) {
    status.textContent = message;
  }

  function store() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // The current conversation still works when browser storage is unavailable.
    }
  }

  function action(label, callback) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'subtle-btn';
    button.textContent = label;
    button.addEventListener('click', callback);
    return button;
  }

  function makeMessage(message) {
    const row = document.createElement('article');
    row.className = `assistant-message assistant-message-${message.role}`;
    const identity = document.createElement('strong');
    identity.className = 'assistant-message-label';
    identity.textContent = message.role === 'user' ? 'You' : 'Octa Assistant';
    const content = document.createElement('div');
    content.className = 'assistant-message-content';
    content.textContent = message.content;
    row.append(identity, content);

    if (message.role === 'assistant') {
      const actions = document.createElement('div');
      actions.className = 'assistant-message-actions';
      actions.append(action('Copy', async () => {
        try {
          await navigator.clipboard.writeText(message.replacement || message.content);
          showStatus('Copied to clipboard.');
        } catch {
          showStatus('Clipboard access is unavailable. Select the text to copy it.');
        }
      }));
      if (typeof message.replacement === 'string' && message.replacement) {
        actions.append(action('Replace draft', () => {
          setDraft(message.replacement);
          showStatus('Draft replaced with the suggested text.');
        }));
      }
      row.append(actions);
    }
    return row;
  }

  function refreshTranscript() {
    transcript.replaceChildren(...messages().map(makeMessage));
    if (empty) empty.hidden = messages().length > 0;
    clear.disabled = sending || !messages().length;
  }

  function append(message) {
    if (messages().length >= HISTORY_LIMIT) {
      messages().shift();
      transcript.firstElementChild?.remove();
    }
    messages().push(message);
    transcript.append(makeMessage(message));
    transcript.scrollTop = transcript.scrollHeight;
    if (empty) empty.hidden = true;
    clear.disabled = sending;
    store();
  }

  async function checkConnection() {
    const check = ++connectionCheck;
    showStatus('Checking the assistant server…');
    try {
      const result = await request('/api/assistant/status');
      if (check !== connectionCheck) return;
      if (!result.configured) showStatus('Connected AI needs a model key on the server. Local mode is ready now.');
      else if (result.requiresAccount && !signedIn()) showStatus('Sign in to use Connected AI. Local mode is ready now.');
      else showStatus('Connected mode shares your message and recent connected chat with the model provider.');
    } catch {
      if (check === connectionCheck) {
        showStatus('Connected AI is unavailable. Check the API address in account settings or use Local mode.');
      }
    }
  }

  function setBusy(busy) {
    sending = busy;
    transcript.setAttribute('aria-busy', String(busy));
    send.disabled = busy;
    modeSelect.disabled = busy;
    clear.disabled = busy || !messages().length;
  }

  modeSelect.value = mode;
  modeSelect.addEventListener('change', () => {
    mode = modeSelect.value;
    ++connectionCheck;
    refreshTranscript();
    if (mode === 'connected') {
      useDraft.checked = false;
      checkConnection();
    } else {
      showStatus('Local assistant processes writing in this browser.');
    }
  });

  clear.addEventListener('click', () => {
    history[mode] = [];
    store();
    refreshTranscript();
    prompt.value = '';
    useDraft.checked = false;
    showStatus('Conversation cleared.');
    prompt.focus();
  });

  document.querySelectorAll('[data-assistant-prompt]').forEach(button => {
    button.addEventListener('click', () => {
      prompt.value = button.dataset.assistantPrompt;
      if (mode === 'local' && button.dataset.assistantDraft === 'true') useDraft.checked = true;
      prompt.setSelectionRange(prompt.value.length, prompt.value.length);
      prompt.focus();
    });
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const message = prompt.value.trim();
    if (sending) return;
    if (!message) {
      showStatus('Enter a message to send.');
      prompt.focus();
      return;
    }
    if (message.length > MESSAGE_LIMIT) {
      showStatus(`Enter a message of up to ${MESSAGE_LIMIT.toLocaleString()} characters.`);
      return;
    }
    const context = useDraft.checked ? getDraft().trim() : '';
    if (context.length > DRAFT_LIMIT) {
      showStatus(`The current draft exceeds ${DRAFT_LIMIT.toLocaleString()} characters. Paste an excerpt or uncheck Include current draft.`);
      return;
    }
    const priorReply = messages().findLast(item => item.role === 'assistant');
    if (mode === 'local') {
      prompt.value = '';
      append({role: 'user', content: message});
      append({role: 'assistant', ...replyToLocal(message, context, priorReply)});
      showStatus('Local response ready.');
      prompt.focus();
      return;
    }

    ++connectionCheck;
    const recent = messages().slice(-10).map(item => ({
      role: item.role,
      content: item.content.slice(0, MESSAGE_LIMIT)
    }));
    showStatus('Waiting for the connected assistant…');
    setBusy(true);
    try {
      const result = await request('/api/assistant', {message, context, history: recent});
      if (typeof result.reply !== 'string' || !result.reply.trim()) {
        throw new Error('The connected assistant returned an empty reply.');
      }
      append({role: 'user', content: message});
      append({role: 'assistant', content: result.reply.trim().slice(0, DRAFT_LIMIT)});
      if (prompt.value.trim() === message) prompt.value = '';
      showStatus('Connected response ready.');
    } catch (error) {
      showStatus(`${error.message} Retry or switch to Local assistant.`);
    } finally {
      setBusy(false);
    }
  });

  prompt.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  refreshTranscript();
  showStatus('Local assistant processes writing in this browser.');
}
