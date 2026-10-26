import http from 'node:http';
import { loadConfig } from './config.mjs';
import { findAvailablePort, generateSessionToken, applySecurityHeaders, DEFAULT_ALLOWED_ORIGINS } from './pairing.mjs';
import { handleChatCompletion, listAvailableModels } from './llm/router.mjs';
import { handleSpeechRequest, listAvailableVoices } from './tts/router.mjs';

export async function startServer(options = {}) {
  const config = loadConfig();
  const host = options.host || config.host || '127.0.0.1';
  const startPort = options.port || config.portRange?.start || 28280;
  const endPort = options.port ? options.port : (config.portRange?.end || 28289);

  const selectedPort = await findAvailablePort(startPort, endPort);
  const sessionToken = generateSessionToken();
  const bootTime = Date.now();

  const server = http.createServer(async (req, res) => {
    const origin = req.headers['origin'] || '';
    applySecurityHeaders(res, origin, DEFAULT_ALLOWED_ORIGINS);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const hostHeader = req.headers.host || '';
    if (!hostHeader.includes('127.0.0.1') && !hostHeader.includes('localhost')) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'DNS Rebinding Forbidden' }));
    }

    const parsedUrl = new URL(req.url, `http://${hostHeader}`);
    const pathname = parsedUrl.pathname;

    // 1. Health check
    if (pathname === '/health' || pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'ok',
        app: 'book-ai',
        version: config.version || '1.0.0',
        port: selectedPort,
      }));
    }

    // 2. Auto-Pairing Handshake (/v1/pair)
    if (pathname === '/v1/pair' && req.method === 'GET') {
      const origin = req.headers['origin'] || '';
      const isLocalOrigin = !origin || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:') || origin === 'tauri://localhost';
      const authHeader = req.headers['authorization'] || '';
      const isTokenValid = authHeader === `Bearer ${sessionToken}`;

      if (isLocalOrigin || isTokenValid) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          ok: true,
          app: 'book-ai',
          port: selectedPort,
          token: sessionToken,
          models: listAvailableModels(config).map((m) => m.id),
          voices: listAvailableVoices(config).map((v) => v.id),
        }));
      }

      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Unauthorized origin for pairing.' }));
    }

    // 3. Models List
    if (pathname === '/v1/models' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const models = listAvailableModels(config);
      return res.end(JSON.stringify({ data: models }));
    }

    // 4. Voices List
    if ((pathname === '/v1/voices' || pathname === '/voices') && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const voices = listAvailableVoices(config);
      return res.end(JSON.stringify({ voices: voices.map((v) => v.id), data: voices }));
    }

    // 5. Chat Completions (/v1/chat/completions)
    if (pathname === '/v1/chat/completions' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const stream = payload.stream === true;
          const text = await handleChatCompletion({
            model: payload.model,
            messages: payload.messages || [],
            config,
          });

          if (stream) {
            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
            });
            const chunkPayload = {
              id: `chatcmpl-${Date.now()}`,
              object: 'chat.completion.chunk',
              choices: [{ delta: { content: text }, finish_reason: 'stop', index: 0 }],
            };
            res.write(`data: ${JSON.stringify(chunkPayload)}\n\ndata: [DONE]\n\n`);
            return res.end();
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            choices: [{ message: { role: 'assistant', content: text }, finish_reason: 'stop', index: 0 }],
          }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // 6. Speech Narration (/v1/audio/speech)
    if ((pathname === '/v1/audio/speech' || pathname === '/audio/speech') && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const audioBuffer = await handleSpeechRequest({
            input: payload.input || payload.text,
            voice: payload.voice,
            model: payload.model,
            speed: payload.speed,
            config,
          });

          res.writeHead(200, {
            'Content-Type': 'audio/wav',
            'Content-Length': audioBuffer.length,
          });
          return res.end(audioBuffer);
        } catch (err) {
          console.error('[book-ai:tts] Speech request error:', err.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  });

  await new Promise((resolve) => server.listen(selectedPort, host, resolve));

  return {
    server,
    port: selectedPort,
    host,
    sessionToken,
    url: `http://${host}:${selectedPort}`,
  };
}
