// proxy-server.js
// Optional: tiny server that keeps your API key off the browser.
// Supports both Google Gemini and Anthropic Claude. The frontend sends a
// "provider" field in the body — the proxy routes accordingly.
//
// Run locally (Gemini):
//   GEMINI_API_KEY=AIza... node proxy-server.js
//
// Run locally (Claude):
//   ANTHROPIC_API_KEY=sk-ant-... node proxy-server.js
//
// Run locally (both):
//   GEMINI_API_KEY=... ANTHROPIC_API_KEY=... node proxy-server.js
//
// In the frontend Settings:
//   Mode: "Through a proxy server"
//   Proxy URL: http://localhost:8787/llm

const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 8787;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY;
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';

if (!GEMINI_KEY && !CLAUDE_KEY) {
  console.error('ERROR: set GEMINI_API_KEY and/or ANTHROPIC_API_KEY env vars.');
  process.exit(1);
}

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function forward({ hostname, path, headers }, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'POST', headers }, r => {
      let data = '';
      r.on('data', c => data += c);
      r.on('end', () => resolve({ status: r.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const server = http.createServer((req, res) => {
  setCORS(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method !== 'POST') { res.writeHead(404); return res.end('Not found'); }

  let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    try {
      const payload = JSON.parse(body);
      const provider = payload.provider || 'gemini';
      const { model, system, messages, max_tokens } = payload;

      if (provider === 'gemini') {
        if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY not set on server');
        const geminiBody = JSON.stringify({
          system_instruction: system ? { parts: [{ text: system }] } : undefined,
          contents: (messages || []).map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          })),
          generationConfig: { maxOutputTokens: max_tokens || 1500, temperature: 0.7 }
        });
        const out = await forward({
          hostname: 'generativelanguage.googleapis.com',
          path: `/v1beta/models/${model || 'gemini-2.5-flash'}:generateContent`,
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY }
        }, geminiBody);
        if (out.status >= 400) { res.writeHead(out.status); return res.end(out.body); }
        const data = JSON.parse(out.body);
        const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ text }));
      }

      if (provider === 'claude') {
        if (!CLAUDE_KEY) throw new Error('ANTHROPIC_API_KEY not set on server');
        const claudeBody = JSON.stringify({ model, system, messages, max_tokens: max_tokens || 1500 });
        const out = await forward({
          hostname: 'api.anthropic.com',
          path: '/v1/messages',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': CLAUDE_KEY,
            'anthropic-version': '2023-06-01',
          }
        }, claudeBody);
        if (out.status >= 400) { res.writeHead(out.status); return res.end(out.body); }
        const data = JSON.parse(out.body);
        const text = data.content?.[0]?.text || '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ text }));
      }

      res.writeHead(400); return res.end('Unknown provider: ' + provider);
    } catch (err) {
      res.writeHead(500); res.end(JSON.stringify({ error: err.message }));
    }
  });
});

server.listen(PORT, () => {
  const enabled = [GEMINI_KEY && 'gemini', CLAUDE_KEY && 'claude'].filter(Boolean).join(', ');
  console.log(`LLM proxy listening on :${PORT}  (providers: ${enabled})`);
});
