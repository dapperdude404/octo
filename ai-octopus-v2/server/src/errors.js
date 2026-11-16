export class ProviderError extends Error {
  constructor(provider, message, status = 502) { super(message); this.provider = provider; this.status = status; }
}
export async function providerJson(url, options, provider) {
  let response;
  try { response = await fetch(url, { ...options, signal: AbortSignal.timeout(45000) }); }
  catch (error) { throw new ProviderError(provider, `${provider} could not be reached: ${error.message}`); }
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw: raw.slice(0, 2000) }; }
  if (!response.ok) {
    const message = data?.message || data?.error || data?.detail || `Provider returned HTTP ${response.status}`;
    throw new ProviderError(provider, String(message).slice(0, 500), response.status >= 400 && response.status < 500 ? 400 : 502);
  }
  return { data, headers: response.headers };
}
