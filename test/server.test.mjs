import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../src/server.mjs';

test('book-ai server integration & pairing suite', async (t) => {
  let instance;

  await t.test('starts on an available port in 28280-28289', async () => {
    instance = await startServer();
    assert.ok(instance.port >= 28280 && instance.port <= 28289, `Port ${instance.port} is within 28280-28289`);
    assert.ok(instance.sessionToken.startsWith('sec_'));
  });

  await t.test('GET /health returns 200 and book-ai signature', async () => {
    const res = await fetch(`${instance.url}/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ok');
    assert.equal(data.app, 'book-ai');
  });

  await t.test('GET /v1/pair returns pairing token and capabilities', async () => {
    const res = await fetch(`${instance.url}/v1/pair`, {
      headers: { Origin: 'http://localhost:5173' },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.equal(res.headers.get('access-control-allow-private-network'), 'true');

    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.app, 'book-ai');
    assert.equal(data.port, instance.port);
    assert.equal(data.token, instance.sessionToken);
    assert.ok(Array.isArray(data.models));
    assert.ok(Array.isArray(data.voices));
  });

  await t.test('GET /v1/models lists available models', async () => {
    const res = await fetch(`${instance.url}/v1/models`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.data.length > 0);
  });

  await t.test('GET /v1/voices lists available voices', async () => {
    const res = await fetch(`${instance.url}/v1/voices`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.voices.includes('af_heart'));
  });

  await t.test('POST /v1/chat/completions returns answer in OpenAI format', async () => {
    const res = await fetch(`${instance.url}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet',
        messages: [{ role: 'user', content: 'Say one word: test' }],
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.choices?.[0]?.message?.content);
  });

  await t.test('POST /v1/audio/speech returns WAV audio binary', async () => {
    const res = await fetch(`${instance.url}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: 'Welcome to Book Reader.',
        voice: 'af_heart',
      }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'audio/wav');
    const buffer = await res.arrayBuffer();
    assert.ok(buffer.byteLength > 100);
    const header = Buffer.from(buffer.slice(0, 4)).toString();
    assert.equal(header, 'RIFF');
  });

  // Clean shutdown
  instance.server.close();
});
