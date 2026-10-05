import { Client } from 'ssh2';

let cachedClient = null;
let cachedConfig = null;
let connectingPromise = null;

function getConfigFromBody(body = {}, env = process.env) {
  return {
    host: body.host || env.VPS_HOST,
    port: Number(body.port || env.VPS_PORT || 22),
    username: body.username || env.VPS_USER,
    password: body.password || env.VPS_PASSWORD || undefined,
    privateKey: body.privateKey || env.VPS_PRIVATE_KEY || undefined,
    passphrase: body.passphrase || env.VPS_PASSPHRASE || undefined,
    readyTimeout: Number(env.VPS_READY_TIMEOUT || 15000),
  };
}

function configIsComplete(cfg) {
  return !!(cfg.host && cfg.username && (cfg.password || cfg.privateKey));
}

function sameConfig(a, b) {
  if (!a || !b) return false;
  return (
    a.host === b.host &&
    a.port === b.port &&
    a.username === b.username &&
    a.password === b.password &&
    a.privateKey === b.privateKey
  );
}

export function getSshConfig(reqOrBody, env) {
  const source = extractConfigSource(reqOrBody);
  return getConfigFromBody(source, env);
}

function extractConfigSource(reqOrBody) {
  if (!reqOrBody) return {};
  const hasShape = typeof reqOrBody === 'object' && ('headers' in reqOrBody || 'body' in reqOrBody || 'query' in reqOrBody);
  if (!hasShape) return reqOrBody || {};
  const headers = (reqOrBody.headers && typeof reqOrBody.headers === 'object') ? reqOrBody.headers : {};
  const body = reqOrBody.body || {};
  const query = reqOrBody.query || {};
  const pickHeader = (k) => {
    const v = headers[k] || headers[k.toLowerCase()];
    return v === undefined ? undefined : (Array.isArray(v) ? v[0] : v);
  };
  const pickQuery = (k) => {
    const v = query[k];
    return v === undefined || v === null || v === '' ? undefined : (Array.isArray(v) ? v[0] : String(v));
  };
  return {
    host: pickQuery('__h') || pickHeader('x-vps-host') || body.host,
    port: pickQuery('__p') || pickHeader('x-vps-port') || body.port,
    username: pickQuery('__u') || pickHeader('x-vps-username') || body.username,
    password: pickQuery('__pw') || pickHeader('x-vps-password') || body.password,
    privateKey: pickQuery('__pk') || pickHeader('x-vps-privatekey') || body.privateKey,
    passphrase: pickQuery('__pp') || pickHeader('x-vps-passphrase') || body.passphrase,
  };
}

export async function ensureSshClient(reqOrBody, env) {
  const source = extractConfigSource(reqOrBody);
  const cfg = getConfigFromBody(source, env);
  if (!configIsComplete(cfg)) {
    const err = new Error(
      'Configuración SSH incompleta. Define host, username y password o privateKey.'
    );
    err.code = 'VPS_AUTH_MISSING';
    throw err;
  }

  if (cachedClient && cachedClient._ready && sameConfig(cfg, cachedConfig)) {
    return cachedClient;
  }

  if (connectingPromise && sameConfig(cfg, cachedConfig)) {
    return connectingPromise;
  }

  if (cachedClient && !sameConfig(cfg, cachedConfig)) {
    try { cachedClient.end(); } catch {}
    cachedClient = null;
  }

  connectingPromise = new Promise((resolve, reject) => {
    const conn = new Client();
    let settled = false;

    const onReady = () => {
      if (settled) return;
      settled = true;
      conn._ready = true;
      cachedClient = conn;
      cachedConfig = cfg;
      resolve(conn);
    };

    const onError = (err) => {
      if (settled) return;
      settled = true;
      try { conn.end(); } catch {}
      cachedClient = null;
      reject(err);
    };

    conn.on('ready', onReady);
    conn.on('error', onError);
    conn.on('timeout', () => onError(new Error('SSH connection timeout')));
    conn.on('end', () => { cachedClient = null; });
    conn.on('close', () => { cachedClient = null; });

    try {
      conn.connect({
        host: cfg.host,
        port: cfg.port,
        username: cfg.username,
        password: cfg.password,
        privateKey: cfg.privateKey,
        passphrase: cfg.passphrase,
        readyTimeout: cfg.readyTimeout,
      });
    } catch (e) {
      onError(e);
    }
  });

  return connectingPromise.finally(() => {
    connectingPromise = null;
  });
}

export function execCommand(conn, command, opts = {}) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let exited = false;

    conn.exec(command, { pty: opts.pty || false }, (err, stream) => {
      if (err) return reject(err);

      stream.on('close', (code) => {
        if (exited) return;
        exited = true;
        resolve({ code: code ?? 0, stdout, stderr });
      });
      stream.on('error', reject);
      stream.stdout.on('data', (d) => { stdout += d.toString(); });
      stream.stderr.on('data', (d) => { stderr += d.toString(); });
    });
  });
}

export function closeSshClient() {
  if (cachedClient) {
    try { cachedClient.end(); } catch {}
    cachedClient = null;
  }
}
