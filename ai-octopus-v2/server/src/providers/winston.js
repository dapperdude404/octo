import { env } from '../config.js';
import { providerJson, ProviderError } from '../errors.js';

export async function scanWinston(text, kind = 'ai') {
  if (!env.WINSTONAI_API_KEY) throw new ProviderError('Winston AI', 'WINSTONAI_API_KEY is not configured.');
  const wordCount = (text.match(/\b[\p{L}\p{N}'’-]+\b/gu) || []).length;
  if (wordCount < 80 || wordCount > 25000) throw new ProviderError('Winston AI', 'Winston accepts 80 to 25,000 words per request.', 400);
  const endpoint = kind === 'plagiarism' ? 'plagiarism' : 'detect';
  const { data } = await providerJson(`https://winstonai.ai/api/v1/${endpoint}`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${env.WINSTONAI_API_KEY}`, 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(kind === 'plagiarism' ? { text, exclude_quotes: true } : { text, sentences: true })
  }, 'Winston AI');
  return { provider: 'winston', status: data.status === 'queued' ? 'queued' : 'completed', providerId: data.id || null, result: data, raw: data };
}

export async function getWinstonScan(id) {
  if (!env.WINSTONAI_API_KEY) throw new ProviderError('Winston AI', 'WINSTONAI_API_KEY is not configured.');
  const { data } = await providerJson(`https://winstonai.ai/api/v1/scans/${encodeURIComponent(id)}`, {
    headers: { authorization: `Bearer ${env.WINSTONAI_API_KEY}` }
  }, 'Winston AI');
  return data;
}
