import { Router } from 'express';
import { ensureSshClient, execCommand } from '../lib/sshClient.js';

const router = Router();

function parsePs(stdout) {
  const lines = stdout.trim().split('\n').filter(Boolean);
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.trim().split(/\s+/);
    if (parts.length < 11) continue;
    const [user, pid, cpu, mem, vsz, rss, tty, stat, start, time] = parts;
    const command = parts.slice(10).join(' ');
    result.push({
      user,
      pid: parseInt(pid, 10),
      cpu: parseFloat(cpu),
      mem: parseFloat(mem),
      vsz_kb: parseInt(vsz, 10),
      rss_kb: parseInt(rss, 10),
      tty,
      stat,
      start,
      time,
      command,
    });
  }
  result.sort((a, b) => b.cpu - a.cpu || b.mem - a.mem);
  return result;
}

router.get('/', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    const limit = Math.min(200, Math.max(20, parseInt(req.query.limit || '80', 10)));
    const r = await execCommand(conn, `ps aux --sort=-%cpu | head -${limit + 1}`);
    res.json({ ok: true, processes: parsePs(r.stdout), count: 0 });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.post('/:pid/kill', async (req, res) => {
  try {
    const pid = req.params.pid;
    const signal = req.body?.signal || 15;
    if (!/^\d+$/.test(String(pid))) {
      return res.status(400).json({ ok: false, error: 'PID inválido' });
    }
    const conn = await ensureSshClient(req, process.env);
    const r = await execCommand(conn, `kill -${signal} ${pid} 2>&1; echo "EXIT=$?"`);
    const match = r.stdout.match(/EXIT=(\d+)/);
    const code = match ? parseInt(match[1], 10) : 0;
    res.json({ ok: code === 0, code, output: r.stdout.trim() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

export default router;
