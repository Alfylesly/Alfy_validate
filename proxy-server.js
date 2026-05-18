// proxy-server.js
// Optional: tiny server that keeps your Anthropic API key off the browser.
// Deploy this anywhere (Vercel, Fly.io, Render, your own VPS) and point the
// frontend at https://your-proxy.example.com/claude (set it in Admin → Settings).
//
// Run locally:
//   ANTHROPIC_API_KEY=sk-ant-... node proxy-server.js
//
// Then in the frontend Settings:
//   Mode: "Through a proxy server"
//   Proxy URL: http://localhost:8787/claude

const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 8787;
const API_KEY = process.env.ANTHROPIC_API_KEY;
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';

if (!API_KEY) {
  console.error('ERROR: set ANTHROPIC_API_KEY env var.');
  process.exit(1);
}

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const server = http.createServer((req, res) => {
  setCORS(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method !== 'POST' || !req.url.startsWith('/claude')) {
    res.writeHead(404); return res.end('Not found');
  }
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    const proxyReq = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      }
    }, proxyRes => {
      let data = '';
      proxyRes.on('data', c => data += c);
      proxyRes.on('end', () => {
        res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
        res.end(data);
      });
    });
    proxyReq.on('error', err => { res.writeHead(500); res.end(JSON.stringify({ error: err.message })); });
    proxyReq.write(body);
    proxyReq.end();
  });
});

server.listen(PORT, () => console.log(`Claude proxy listening on :${PORT}`));
