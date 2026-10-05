import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import metrics from './routes/metrics.js';
import processes from './routes/processes.js';
import docker from './routes/docker.js';
import services from './routes/services.js';
import files from './routes/files.js';
import packages from './routes/packages.js';
import { ensureSshClient, getSshConfig, closeSshClient } from './lib/sshClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.SERVER_PORT || 50505);
const HOST = process.env.HOST || process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
const TRUST_PROXY = process.env.TRUST_PROXY === '1' || process.env.NODE_ENV === 'production';

if (TRUST_PROXY) app.set('trust proxy', true);

app.use(express.json({ limit: '16mb' }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-VPS-Host, X-VPS-Port, X-VPS-Username, X-VPS-Password, X-VPS-Privatekey, X-VPS-Passphrase'
  );
  res.setHeader('Access-Control-Expose-Headers', 'X-VPS-Host, X-VPS-Username');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use((req, _res, next) => {
  if (!req.url.startsWith('/api') && !req.url.startsWith('/ws')) return next();
  const ip =
    (TRUST_PROXY ? String(req.headers['x-forwarded-for'] || '').split(',')[0] : '') ||
    req.socket?.remoteAddress ||
    '';
  console.log(`[req] ${new Date().toISOString()} ${req.method} ${req.url} ${ip}`);
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString(), pid: process.pid });
});

app.post('/api/vps/test', async (req, res) => {
  try {
    const cfg = getSshConfig(req.body, process.env);
    const conn = await ensureSshClient(req, process.env);
    const r = await import('./lib/sshClient.js');
    const { execCommand } = r;
    const who = await execCommand(conn, 'whoami 2>&1');
    res.json({ ok: true, whoami: who.stdout.trim(), config: { host: cfg.host, port: cfg.port, username: cfg.username } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

app.post('/api/vps/disconnect', async (req, res) => {
  closeSshClient();
  res.json({ ok: true });
});

app.use('/api/metrics', metrics);
app.use('/api/processes', processes);
app.use('/api/docker', docker);
app.use('/api/services', services);
app.use('/api/files', files);
app.use('/api/packages', packages);

const distDir = path.resolve(__dirname, '..', 'dist');
app.use(express.static(distDir, { fallthrough: true }));
app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api') || req.url.startsWith('/ws')) return next();
  res.sendFile(path.join(distDir, 'index.html'), (err) => {
    if (err) next();
  });
});

app.use((err, req, res, next) => {
  console.error('[server] error:', err);
  res.status(500).json({ ok: false, error: err.message || 'Internal Server Error' });
});

const wss = new WebSocketServer({ server, path: '/ws/terminal' });

wss.on('connection', async (ws, req) => {
  let stream = null;
  let conn = null;
  let closed = false;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    try { stream && stream.end(); } catch {}
    try { ws.close(); } catch {}
  };

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    const { type, data } = msg || {};

    if (type === 'init') {
      try {
        conn = await ensureSshClient(data, process.env);
        const cols = Number(data.cols || 80);
        const rows = Number(data.rows || 24);
        conn.shell({ term: data.term || 'xterm-256color', cols, rows, width: cols, height: rows }, (err, s) => {
          if (err) {
            ws.send(JSON.stringify({ type: 'output', data: `Error: ${err.message}\r\n` }));
            return cleanup();
          }
          stream = s;
          stream.on('data', (d) => {
            if (!closed) ws.send(JSON.stringify({ type: 'output', data: d.toString() }));
          });
          stream.on('close', cleanup);
          stream.on('error', cleanup);
          stream.stderr.on('data', (d) => {
            if (!closed) ws.send(JSON.stringify({ type: 'output', data: d.toString() }));
          });
          if (!closed) ws.send(JSON.stringify({ type: 'ready' }));
        });
      } catch (err) {
        ws.send(JSON.stringify({ type: 'output', data: `Error SSH: ${err.message}\r\n` }));
        cleanup();
      }
      return;
    }

    if (type === 'input' && stream) {
      try { stream.write(data); } catch {}
      return;
    }

    if (type === 'resize' && stream && stream.setWindow) {
      const cols = Math.max(2, Number(data?.cols || 80));
      const rows = Math.max(2, Number(data?.rows || 24));
      try { stream.setWindow(rows, cols); } catch {}
      return;
    }

    if (type === 'close') {
      cleanup();
    }
  });

  ws.on('close', cleanup);
  ws.on('error', cleanup);
});

process.on('SIGTERM', () => { closeSshClient(); server.close(() => process.exit(0)); });
process.on('SIGINT', () => { closeSshClient(); server.close(() => process.exit(0)); });

server.listen(PORT, HOST, () => {
  console.log(`[server] AuraUI VPS Monitor running on http://${HOST}:${PORT}`);
});
