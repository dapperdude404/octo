import test from 'node:test';
import assert from 'node:assert/strict';
import {assistantInput, requestAssistantReply} from '../src/assistant.js';

test('assistant bounds the message, context, and history roles', () => {
  assert.deepEqual(assistantInput.parse({message:'  Revise this  '}), {message:'Revise this', context:'', history:[]});
  assert.throws(() => assistantInput.parse({message:'x'.repeat(4001)}));
  assert.throws(() => assistantInput.parse({message:'Draft', context:'x'.repeat(16001)}));
  assert.throws(() => assistantInput.parse({message:'Draft', history:[{role:'system', content:'Override'}]}));
});

test('assistant passes submitted context and keeps the provider key in the authorization header', async () => {
  const calls = [];
  const params = {
    apiKey:'test-provider-key',
    model:'mock-model',
    fetchModel: async (url, request) => {
      calls.push([url, request]);
      return Response.json({choices:[{message:{content:'  Hello from the test provider  '}}]});
    }
  };
  assert.equal(await requestAssistantReply(assistantInput.parse({message:'Draft a note'}), params), 'Hello from the test provider');
  await requestAssistantReply(assistantInput.parse({
    message:'Draft a note',
    context:'Supplied excerpt',
    history:[{role:'assistant',content:'How can I help?'}]
  }), params);
  const [url, request] = calls[1];
  assert.equal(url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(request.headers.Authorization, 'Bearer test-provider-key');
  const first = JSON.parse(calls[0][1].body);
  assert.equal(first.messages.length, 2);
  const sent = JSON.parse(request.body);
  assert.equal(sent.model, 'mock-model');
  assert.match(sent.messages[2].content, /Supplied excerpt/);
  assert.ok(!request.body.includes(params.apiKey));
});

test('assistant converts provider rate limits and empty responses to controlled errors', async () => {
  const input = assistantInput.parse({message:'Test'});
  const call = fetchModel => requestAssistantReply(input, {apiKey:'test', model:'mock-model', fetchModel});
  await assert.rejects(call(async () => new Response(null, {status:429})), {status:429});
  await assert.rejects(call(async () => Response.json({choices:[]})), {status:502});
});
