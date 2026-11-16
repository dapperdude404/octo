import { env } from '../config.js';
import { providerJson, ProviderError } from '../errors.js';

let cachedToken = null;
let tokenExpiresAt = 0;
async function getToken() {
  if (!env.COPYLEAKS_EMAIL || !env.COPYLEAKS_API_KEY) throw new ProviderError('Copyleaks', 'COPYLEAKS_EMAIL and COPYLEAKS_API_KEY are not configured.');
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  const { data } = await providerJson('https://id.copyleaks.com/v3/account/login/api', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: env.COPYLEAKS_EMAIL, key: env.COPYLEAKS_API_KEY })
  }, 'Copyleaks');
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + 47 * 60 * 60 * 1000;
  return cachedToken;
}

export async function submitCopyleaks(text, kind = 'ai', title = 'Octo AI scan') {
  const token = await getToken();
  const scanId = crypto.randomUUID(); // 36 chars, within the Copyleaks scan ID limit
  if (env.NODE_ENV === 'production' && env.COPYLEAKS_SANDBOX === 'true') throw new ProviderError('Copyleaks', 'Disable sandbox mode before production scans.');
  const webhookEnabled = env.COPYLEAKS_WEBHOOK_ENABLED === 'true' && env.PUBLIC_API_URL.startsWith('https://') && env.COPYLEAKS_WEBHOOK_SECRET.length >= 24;
  const properties = {
    sandbox: env.COPYLEAKS_SANDBOX === 'true',
    ...(webhookEnabled ? { webhooks: { status: `${env.PUBLIC_API_URL}/api/webhooks/copyleaks/{STATUS}?token=${encodeURIComponent(env.COPYLEAKS_WEBHOOK_SECRET)}` } } : {}),
    ...(kind === 'ai' ? { aiGeneratedText: { detect: true } } : {}),
    ...(kind === 'plagiarism' ? { scanning: { internet: true } } : {})
  };
  const body = { base64: Buffer.from(text, 'utf8').toString('base64'), filename: `${title.replace(/[^a-z0-9-_]/gi, '_').slice(0, 60) || 'octo'}.txt`, properties };
  await providerJson(`https://api.copyleaks.com/v3/scans/submit/file/${encodeURIComponent(scanId)}`, {
    method: 'PUT', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body)
  }, 'Copyleaks');
  return { provider: 'copyleaks', status: 'queued', providerId: scanId, result: { scanId, note: webhookEnabled ? 'Submitted; awaiting Copyleaks webhook.' : 'Submitted. Configure a public HTTPS webhook to receive completion events.' }, raw: { scanId } };
}

export async function copyleaksWebhook(body) {
  // Store webhook payload as received; Copyleaks uses status callbacks and a separate export flow for detailed reports.
  return { scanId: body?.scanId || body?.scan_id || body?.id || null, body };
}
