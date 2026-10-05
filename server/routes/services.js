import { Router } from 'express';
import { ensureSshClient, execCommand } from '../lib/sshClient.js';

const router = Router();

function parseServices(stdout) {
  const lines = stdout.trim().split('\n').filter(Boolean);
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('.service')) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4) continue;
    const unit = parts[0];
    const load = parts[1];
    const active = parts[2];
    const sub = parts[3];
    const description = parts.slice(4).join(' ');
    result.push({ unit, load, active, sub, description });
  }
  return result;
}

async function runSystemctlAction(conn, action, name) {
  const r = await execCommand(conn, `systemctl ${action} ${name} 2>&1; echo "EXIT=$?"`);
  return { ok: /EXIT=0/.test(r.stdout), output: r.stdout.trim() };
}

router.get('/', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    const stateFilter = req.query.state || 'running';
    const typeFilter = req.query.type || 'service';
    const r = await execCommand(
      conn,
      `systemctl list-units --type=${typeFilter} --state=${stateFilter} --no-pager 2>&1`
    );
    res.json({ ok: true, services: parseServices(r.stdout) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.get('/all', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    const r = await execCommand(
      conn,
      'systemctl list-unit-files --type=service --no-pager --state=enabled,disabled,masked 2>&1'
    );
    const lines = r.stdout.trim().split('\n').filter(Boolean);
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].trim().split(/\s+/);
      if (parts.length < 2) continue;
      if (!parts[0].endsWith('.service')) continue;
      out.push({ unit_file: parts[0], state: parts[1], preset: parts[2] || '' });
    }
    res.json({ ok: true, files: out });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.get('/:name/status', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    const r = await execCommand(conn, `systemctl status ${req.params.name} --no-pager 2>&1; echo "EXIT=$?"`);
    res.json({ ok: true, output: r.stdout });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.post('/:name/start', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    res.json(await runSystemctlAction(conn, 'start', req.params.name));
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.post('/:name/stop', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    res.json(await runSystemctlAction(conn, 'stop', req.params.name));
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.post('/:name/restart', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    res.json(await runSystemctlAction(conn, 'restart', req.params.name));
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.post('/:name/enable', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    res.json(await runSystemctlAction(conn, 'enable', req.params.name));
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.post('/:name/disable', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    res.json(await runSystemctlAction(conn, 'disable', req.params.name));
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

export default router;
