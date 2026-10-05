import { Router } from 'express';
import { ensureSshClient, execCommand } from '../lib/sshClient.js';

const router = Router();

function parseCpuFromTop(stdout) {
  const lines = stdout.trim().split('\n');
  let cpuLine = '';
  for (const l of lines) {
    if (l.includes('Cpu(s)') || l.includes('%Cpu(s)') || l.includes('CPU')) {
      cpuLine = l;
      break;
    }
  }
  let user = 0, system = 0, idle = 100;
  const match = cpuLine.match(/([\d.]+)\s*us.*?([\d.]+)\s*sy.*?([\d.]+)\s*id/);
  if (match) {
    user = parseFloat(match[1]);
    system = parseFloat(match[2]);
    idle = parseFloat(match[3]);
  } else {
    const idleMatch = cpuLine.match(/([\d.]+)\s*id/);
    if (idleMatch) idle = parseFloat(idleMatch[1]);
  }
  return {
    user: Number(user.toFixed(1)),
    system: Number(system.toFixed(1)),
    used: Number((100 - idle).toFixed(1)),
    idle: Number(idle.toFixed(1)),
    cores: detectCores(stdout),
  };
}

function detectCores(stdout) {
  const m = stdout.match(/(\d+)\s*Cpu\(s\)/);
  if (m) return parseInt(m[1], 10);
  const procs = stdout.match(/^(\d+)\s/m);
  if (procs) return 1;
  return 1;
}

function parseMemory(stdout) {
  const lines = stdout.trim().split('\n');
  let total = 0, used = 0, free = 0, buffers = 0, cached = 0;
  for (const line of lines) {
    if (line.startsWith('Mem:')) {
      const parts = line.split(/\s+/);
      total = parseInt(parts[1], 10);
      used = parseInt(parts[2], 10);
      free = parseInt(parts[3], 10);
      if (parts[5]) buffers = parseInt(parts[5], 10);
      if (parts[6]) cached = parseInt(parts[6], 10);
      break;
    }
  }
  const usedReal = Math.max(0, used - buffers - cached);
  return {
    total_kb: total,
    used_kb: used,
    free_kb: free,
    buffers_kb: buffers,
    cached_kb: cached,
    used_real_kb: usedReal,
    total_mb: Math.round(total / 1024),
    used_mb: Math.round(usedReal / 1024),
    percent: total ? Number(((usedReal / total) * 100).toFixed(1)) : 0,
  };
}

function parseDisk(stdout) {
  const lines = stdout.trim().split('\n').filter(Boolean);
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(/\s+/);
    if (parts.length < 6) continue;
    const fs = parts[0];
    if (!/^\/dev\//.test(fs)) continue;
    const total = parseInt(parts[1], 10) * 1024;
    const used = parseInt(parts[2], 10) * 1024;
    const avail = parseInt(parts[3], 10) * 1024;
    const usePct = parseInt((parts[4] || '0').replace('%', ''), 10);
    const mount = parts[5];
    result.push({
      filesystem: fs,
      total_bytes: total,
      used_bytes: used,
      available_bytes: avail,
      use_percent: usePct,
      mount_point: mount,
    });
  }
  return result;
}

function parseNetwork(stdout) {
  const lines = stdout.trim().split('\n').filter((l) => l.includes(':'));
  const ifaces = [];
  for (const line of lines) {
    const split = line.split(':');
    const name = split[0].trim();
    const rest = split.slice(1).join(':').trim().split(/\s+/);
    if (rest.length < 16) continue;
    const rx_bytes = parseInt(rest[0], 10);
    const rx_packets = parseInt(rest[1], 10);
    const tx_bytes = parseInt(rest[8], 10);
    const tx_packets = parseInt(rest[9], 10);
    if (name === 'lo') continue;
    ifaces.push({
      name,
      rx_bytes,
      rx_packets,
      tx_bytes,
      tx_packets,
    });
  }
  return ifaces;
}

function parseUptime(stdout) {
  const trimmed = stdout.trim();
  const upMatch = trimmed.match(/up\s+(.+?),\s+\d+ user/);
  const loadMatch = trimmed.match(/load average:\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
  return {
    raw: trimmed,
    uptime: upMatch ? upMatch[1].trim() : trimmed,
    load_1m: loadMatch ? parseFloat(loadMatch[1]) : 0,
    load_5m: loadMatch ? parseFloat(loadMatch[2]) : 0,
    load_15m: loadMatch ? parseFloat(loadMatch[3]) : 0,
  };
}

async function parseUname(conn) {
  try {
    const r = await execCommand(conn, 'uname -srmo');
    const parts = r.stdout.trim().split(/\s+/);
    return {
      kernel: parts[0] || '',
      release: parts[1] || '',
      arch: parts[3] || '',
      full: r.stdout.trim(),
    };
  } catch {
    return { kernel: '', release: '', arch: '', full: '' };
  }
}

function parseHostname(stdout) {
  return stdout.trim();
}

router.get('/', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    const [topR, freeR, dfR, netR, upR, hostR, unameR] = await Promise.all([
      execCommand(conn, 'top -bn1 -w200 | head -30'),
      execCommand(conn, 'free -k'),
      execCommand(conn, 'df -Pk'),
      execCommand(conn, 'cat /proc/net/dev 2>/dev/null'),
      execCommand(conn, 'uptime'),
      execCommand(conn, 'hostname'),
      parseUname(conn),
    ]);
    res.json({
      ok: true,
      hostname: parseHostname(hostR.stdout),
      uname: unameR,
      cpu: parseCpuFromTop(topR.stdout),
      memory: parseMemory(freeR.stdout),
      disk: parseDisk(dfR.stdout),
      network: parseNetwork(netR.stdout),
      uptime: parseUptime(upR.stdout),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

export default router;
