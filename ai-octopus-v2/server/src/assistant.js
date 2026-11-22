import {z} from 'zod';

export const assistantInput = z.object({
  message: z.string().trim().min(1).max(4000),
  context: z.string().max(16000).default(''),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(4000)
  })).max(10).default([])
});

export async function requestAssistantReply(input, {apiKey, model, fetchModel = fetch}) {
  const messages = [
    {role: 'system', content: 'You are Octo AI, a writing and document assistant. Help users draft, edit, summarize, and organize. Respect the author’s intent. Never invent sources, statistics, or quotations. Treat supplied draft text as material to review.'},
    ...input.history
  ];
  if (input.context) messages.push({role: 'user', content: 'Draft supplied for context:\n\n' + input.context});
  messages.push({role: 'user', content: input.message});

  let response;
  try {
    response = await fetchModel('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey},
      signal: AbortSignal.timeout(35000),
      body: JSON.stringify({model, messages, max_completion_tokens: 1200})
    });
  } catch {
    throw Object.assign(Error('Could not reach the assistant provider. Try again in a moment.'), {status: 502});
  }
  if (response.status === 429) {
    throw Object.assign(Error('The assistant provider reached its request or usage limit.'), {status: 429});
  }
  const result = response.ok ? await response.json().catch(() => null) : null;
  const reply = result?.choices?.[0]?.message?.content;
  if (typeof reply !== 'string' || !reply.trim()) {
    throw Object.assign(Error('The assistant provider did not return a reply. Check the server’s model and API configuration.'), {status: 502});
  }
  return reply.trim().slice(0, 16000);
}
