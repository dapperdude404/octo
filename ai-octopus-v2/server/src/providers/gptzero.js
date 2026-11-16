import { env } from '../config.js';
import { providerJson, ProviderError } from '../errors.js';

export async function scanGPTZero(text) {
  if (!env.GPTZERO_API_KEY) throw new ProviderError('GPTZero', 'GPTZERO_API_KEY is not configured.');
  if (text.length > 150000) throw new ProviderError('GPTZero', 'GPTZero API text limit is 150,000 characters.', 400);
  const { data } = await providerJson('https://api.gptzero.me/v2/predict/text', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': env.GPTZERO_API_KEY },
    body: JSON.stringify({ document: text })
  }, 'GPTZero');
  return { provider: 'gptzero', status: 'completed', result: data, raw: data };
}
