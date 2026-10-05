import { Router } from 'express';
import { ensureSshClient, execCommand, getSshConfig } from '../lib/sshClient.js';

const router = Router();

function parsePortsString(portsStr) {
  if (!portsStr || !portsStr.trim()) return [];
  const parts = portsStr.split(',').map((s) => s.trim()).filter(Boolean);
  const result = [];
  const re = /^(?:\[?([^\]:]+)\]?:)?(\d+)->(?:\[?([^\]:]+)\]?:)?(\d+)\/(tcp|udp)$/;
  for (const part of parts) {
    const m = part.match(re);
    if (m) {
      const hostIp = (m[1] && m[1] !== '' && m[1] !== '0.0.0.0' && m[1] !== '::') ? m[1] : null;
      const hostPort = Number(m[2]);
      const containerPort = Number(m[4]);
      const proto = m[5];
      result.push({ host_ip: hostIp, host_port: hostPort, container_port: containerPort, proto });
    }
  }
  return result;
}

function parseContainers(stdout) {
  const lines = stdout.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/\s{2,}/).map((c) => c.trim());
    if (cols.length < 6) continue;
    const portsRaw = cols[5] || '';
    result.push({
      id: cols[0],
      image: cols[1],
      command: cols[2],
      created: cols[3],
      status: cols[4],
      ports: portsRaw,
      names: cols[6] || '',
      published_ports: parsePortsString(portsRaw),
    });
  }
  return result;
}

function parseImages(stdout) {
  const lines = stdout.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/\s{2,}/).map((c) => c.trim());
    if (cols.length < 5) continue;
    result.push({
      repository: cols[0],
      tag: cols[1],
      image_id: cols[2],
      created: cols[3],
      size: cols[4],
    });
  }
  return result;
}

function parseVolumes(stdout) {
  const lines = stdout.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/\s{2,}/).map((c) => c.trim());
    if (cols.length < 3) continue;
    result.push({
      name: cols[0],
      driver: cols[1],
      scope: cols[2],
    });
  }
  return result;
}

function safeParseFloat(s) {
  if (s === null || s === undefined || s === '') return 0;
  const n = parseFloat(String(s));
  return Number.isFinite(n) ? n : 0;
}

function parseSizeToBytes(value) {
  if (!value) return 0;
  const m = String(value).trim().match(/^([\d.,]+)\s*([KMGTP]?B?)$/i);
  if (!m) return safeParseFloat(value);
  let n = safeParseFloat(m[1].replace(',', '.'));
  const unit = (m[2] || '').toUpperCase().replace('B', '');
  if (unit === 'K') n *= 1024;
  else if (unit === 'M') n *= 1024 * 1024;
  else if (unit === 'G') n *= 1024 * 1024 * 1024;
  else if (unit === 'T') n *= 1024 * 1024 * 1024 * 1024;
  else if (unit === 'P') n *= 1024 * 1024 * 1024 * 1024 * 1024;
  return n;
}

function parseStatsRawEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  // Campos típicos Docker stats JSON 25-0-1
  const id = String(raw.ID || raw.Container || '').slice(0, 12);
  const name = String(raw.Name || raw.Names || '').replace(/^\/+/, '');

  // CPU
  let cpuPct = 0;
  const cpuRaw = raw.CPUPerc || raw.CPUPercentage || raw['CPU %'];
  if (typeof cpuRaw === 'number') cpuPct = cpuRaw;
  else if (typeof cpuRaw === 'string') cpuPct = safeParseFloat(cpuRaw.replace('%', ''));
  if (!Number.isFinite(cpuPct) || cpuPct < 0) cpuPct = 0;

  // Mem: "128MiB / 1GiB"  o {raw, usage, limit}
  let memUsedBytes = 0, memLimitBytes = 0, memPct = 0;
  const memRaw = raw.MemUsage || raw.MemoryUsage || raw.Mem || raw['MEM USAGE / LIMIT'];
  const memPctRaw = raw.MemPerc || raw.MemoryPercentage || raw['MEM %'];
  if (typeof memPctRaw === 'number') memPct = memPctRaw;
  else if (typeof memPctRaw === 'string') memPct = safeParseFloat(memPctRaw.replace('%', ''));

  if (memRaw && typeof memRaw === 'string') {
    const parts = String(memRaw).split('/').map((s) => s.trim());
    if (parts.length >= 2) {
      memUsedBytes = parseSizeToBytes(parts[0]);
      memLimitBytes = parseSizeToBytes(parts[1]);
    }
  } else if (memRaw && typeof memRaw === 'object') {
    memUsedBytes = safeParseFloat(memRaw.used || memRaw.raw || memRaw.Usage || 0);
    memLimitBytes = safeParseFloat(memRaw.limit || memRaw.Limit || 0);
  }
  if (memPct <= 0 && memLimitBytes > 0) memPct = (memUsedBytes / memLimitBytes) * 100;
  if (!Number.isFinite(memPct) || memPct < 0) memPct = 0;
  if (memPct > 10000) memPct = 0;

  // Net: "648kB / 821kB"
  let netRxBytes = 0, netTxBytes = 0;
  const netRaw = raw.NetIO || raw.Network || raw['NET I/O'];
  if (netRaw && typeof netRaw === 'string') {
    const parts = String(netRaw).split('/').map((s) => s.trim());
    if (parts.length >= 2) {
      netRxBytes = parseSizeToBytes(parts[0]);
      netTxBytes = parseSizeToBytes(parts[1]);
    }
  } else if (netRaw && typeof netRaw === 'object') {
    netRxBytes = safeParseFloat(netRaw.rx || netRaw.Rx || netRaw.RX || 0);
    netTxBytes = safeParseFloat(netRaw.tx || netRaw.Tx || netRaw.TX || 0);
  }

  // Block I/O
  let blockReadBytes = 0, blockWriteBytes = 0;
  const blockRaw = raw.BlockIO || raw.Storage || raw['BLOCK I/O'];
  if (blockRaw && typeof blockRaw === 'string') {
    const parts = String(blockRaw).split('/').map((s) => s.trim());
    if (parts.length >= 2) {
      blockReadBytes = parseSizeToBytes(parts[0]);
      blockWriteBytes = parseSizeToBytes(parts[1]);
    }
  } else if (blockRaw && typeof blockRaw === 'object') {
    blockReadBytes = safeParseFloat(blockRaw.read || blockRaw.Read || blockRaw.R || 0);
    blockWriteBytes = safeParseFloat(blockRaw.write || blockRaw.Write || blockRaw.W || 0);
  }

  // PIDs
  let pids = null;
  if (raw.PIDs !== undefined) {
    const p = safeParseFloat(raw.PIDs);
    pids = Number.isFinite(p) ? p : null;
  }

  if (!id && !name) return null;
  return {
    id,
    name,
    cpu_pct: Math.round(cpuPct * 10) / 10,
    mem_used_bytes: Math.round(memUsedBytes),
    mem_limit_bytes: Math.round(memLimitBytes),
    mem_pct: Math.round(memPct * 10) / 10,
    net_rx_bytes: Math.round(netRxBytes),
    net_tx_bytes: Math.round(netTxBytes),
    block_read_bytes: Math.round(blockReadBytes),
    block_write_bytes: Math.round(blockWriteBytes),
    pids,
  };
}

function parseStatsOutput(stdout) {
  const text = String(stdout || '').trim();
  if (!text) return [];
  const lines = text.split('\n').map((s) => s.trim()).filter(Boolean);
  const stats = [];
  // 1) Intentar líneas JSON una a una (--format '{{json .}}')
  let anyJson = false;
  for (const line of lines) {
    if (line.startsWith('{')) {
      try {
        const obj = JSON.parse(line);
        const parsed = parseStatsRawEntry(obj);
        if (parsed) {
          stats.push(parsed);
          anyJson = true;
        }
      } catch { /* ignore */ }
    }
  }
  if (anyJson) return stats;

  // 2) Fallback: parseo tabla docker stats tabular
  if (lines.length < 2) return [];
  // Detectar header
  const header = lines[0].toLowerCase();
  const columns = [];
  const findCols = (hdr) => {
    const order = ['name', 'cpu', 'mem', 'net', 'block', 'pids'];
    let pos = 0;
    for (const key of order) {
      const idx = hdr.indexOf(key === 'cpu' ? 'cpu %' : key === 'mem' ? 'mem usage' : key === 'net' ? 'net i/o' : key === 'block' ? 'block i/o' : key);
      if (idx !== -1) columns.push({ key, start: idx });
    }
    columns.sort((a, b) => a.start - b.start);
  };
  findCols(header);
  if (columns.length < 2) return [];

  const getField = (row, key, nextStart) => {
    const col = columns.find((c) => c.key === key);
    if (!col) return '';
    const end = nextStart !== undefined ? nextStart : row.length;
    return row.slice(col.start, end).trim();
  };
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (!row) continue;
    const cpuPctStr = getField(row, 'cpu', columns.find((c) => c.key === 'mem')?.start).replace('%', '');
    const memStr = getField(row, 'mem', columns.find((c) => c.key === 'net')?.start);
    const netStr = getField(row, 'net', columns.find((c) => c.key === 'block')?.start);
    const blockStr = getField(row, 'block', columns.find((c) => c.key === 'pids')?.start);
    const pidsStr = getField(row, 'pids');
    const memParts = memStr.split('/').map((s) => s.trim());
    let memPct = 0;
    const memPctMatch = row.match(/([\d.,]+)\s*%/);
    if (memPctMatch) memPct = safeParseFloat(memPctMatch[1]);
    const parsed = parseStatsRawEntry({
      Name: getField(row, 'name', columns.find((c) => c.key === 'cpu')?.start),
      CPUPerc: cpuPctStr,
      MemUsage: memParts.join(' / '),
      MemPerc: memPct,
      NetIO: netStr,
      BlockIO: blockStr,
      PIDs: pidsStr,
    });
    if (parsed) stats.push(parsed);
  }
  return stats;
}

async function runDockerAction(conn, command) {
  const r = await execCommand(conn, command);
  return {
    ok: /EXIT=0/.test(r.stdout),
    output: r.stdout.trim(),
  };
}

router.get('/ps', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    const cfg = getSshConfig(req, process.env);
    const all = req.query.all === '1' ? ' -a' : '';
    const r = await execCommand(conn, `docker ps${all} 2>&1`);
    res.json({ ok: true, vps_host: cfg.host || null, containers: parseContainers(r.stdout) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.get('/images', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    const r = await execCommand(conn, 'docker images 2>&1');
    res.json({ ok: true, images: parseImages(r.stdout) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.get('/volumes', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    const r = await execCommand(conn, 'docker volume ls 2>&1');
    res.json({ ok: true, volumes: parseVolumes(r.stdout) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    const cmd =
      `docker stats --no-stream --format '{{json .}}' 2>&1 ; echo "EXIT_DOCKER_STATS=$?"`;
    const r = await execCommand(conn, cmd);
    const stats = parseStatsOutput(r.stdout);
    res.json({ ok: true, stats });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err), stats: [] });
  }
});

router.post('/:id/start', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    const r = await runDockerAction(conn, `docker start ${req.params.id} 2>&1; echo "EXIT=$?"`);
    res.json(r);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.post('/:id/stop', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    const r = await runDockerAction(conn, `docker stop ${req.params.id} 2>&1; echo "EXIT=$?"`);
    res.json(r);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.post('/:id/restart', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    const r = await runDockerAction(conn, `docker restart ${req.params.id} 2>&1; echo "EXIT=$?"`);
    res.json(r);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.get('/:id/logs', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    const tail = Math.min(500, Math.max(10, parseInt(req.query.tail || '100', 10)));
    const r = await execCommand(conn, `docker logs --tail=${tail} ${req.params.id} 2>&1`);
    res.json({ ok: true, logs: r.stdout });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

export default router;
