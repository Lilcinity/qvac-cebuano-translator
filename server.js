// QVAC Cebuano Translator -- Web UI
//
// A small local web server so the translator can be used from a browser
// instead of the terminal. It's still the exact same on-device pipeline as
// the CLI (see lib/qvac.js): loadModel() once at startup, completion() per
// request, unloadModel() on shutdown. The browser never talks to anything
// but this process, on localhost -- no cloud, no API key, nothing leaves
// this machine.
//
// Usage: node server.js  [--port 5173]

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIRECTIONS, loadTranslationModel, translate, unloadTranslationModel } from './lib/qvac.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');

const portFlagIndex = process.argv.indexOf('--port');
const PORT = portFlagIndex !== -1 ? Number(process.argv[portFlagIndex + 1]) : 5173;

function onProgress(p) {
  const mb = (n) => (n / 1e6).toFixed(1);
  const line = `  downloading model: ${p.percentage.toFixed(0)}% (${mb(p.downloaded)}/${mb(p.total)} MB)`;
  process.stderr.write(process.stderr.isTTY ? `\r${line}` : `${line}\n`);
  if (p.percentage >= 100) process.stderr.write('\n');
}

async function serveStatic(res) {
  const filePath = path.join(PUBLIC_DIR, 'index.html');
  const html = await readFile(filePath, 'utf8');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

async function handleTranslate(req, res, modelId) {
  let body = '';
  for await (const chunk of req) body += chunk;

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Malformed JSON body.' }));
    return;
  }

  const { direction, text } = payload;
  if (!DIRECTIONS[direction] || typeof text !== 'string' || !text.trim()) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Expected { direction: "1"|"2", text: string }.' }));
    return;
  }

  // Plain chunked text/event-stream-free streaming: each write is one
  // token straight from completion()'s run.events, so the browser sees the
  // translation appear the same way it does in the terminal.
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
    'X-On-Device': 'true'
  });

  try {
    await translate(modelId, text.trim(), String(direction), (chunk) => res.write(chunk));
  } catch (error) {
    // Model errors surface as extra text on an already-open stream, since
    // headers are already sent by the time completion() could fail.
    res.write(`\n[error: ${error.message}]`);
  }
  res.end();
}

async function main() {
  console.log('');
  console.log('================================================');
  console.log('   QVAC CEBUANO TRANSLATOR -- web UI');
  console.log('   English <-> Cebuano (Bisaya), fully on-device');
  console.log('================================================');
  console.log('');
  console.log('Loading translation model on-device (Qwen3 1.7B)...');

  const modelId = await loadTranslationModel(onProgress);
  console.log('Model loaded. All inference below runs locally -- no cloud, no API key.');

  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/translate') {
      handleTranslate(req, res, modelId).catch((error) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      });
      return;
    }

    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      serveStatic(res).catch(() => {
        res.writeHead(404);
        res.end('Not found');
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });

  server.listen(PORT, () => {
    console.log(`\nOpen http://localhost:${PORT} in your browser.\n`);
  });

  const shutdown = async () => {
    console.log('\nShutting down...');
    server.close();
    await unloadTranslationModel(modelId);
    console.log('Model unloaded. Salamat sa paggamit! (Thanks for using it!)');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('\n✖ Error:', error);
  process.exit(1);
});
