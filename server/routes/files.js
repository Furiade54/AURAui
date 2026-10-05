import { Router } from 'express';
import { ensureSshClient, execCommand } from '../lib/sshClient.js';

const router = Router();
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB por chunk/archivo base64 único

function parseLs(stdout, path) {
  const lines = stdout.trim().split('\n').filter(Boolean);
  const entries = [];
  for (const line of lines) {
    if (line.startsWith('total')) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 9) continue;
    const [perms, links, owner, group, size, m1, m2, m3] = parts;
    const name = parts.slice(8).join(' ');
    if (!name) continue;
    const isDir = perms.startsWith('d');
    const isLink = perms.startsWith('l');
    entries.push({
      name,
      type: isDir ? 'directory' : isLink ? 'symlink' : 'file',
      size: parseInt(size, 10),
      perms,
      links,
      owner,
      group,
      modified: `${m1} ${m2} ${m3}`,
      path: (path.endsWith('/') ? path : path + '/') + name,
    });
  }
  return entries;
}

function sanitizePath(p) {
  if (!p) return '/';
  if (!p.startsWith('/')) p = '/' + p;
  p = p.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  return p;
}

function shellEscape(s) {
  return String(s).replace(/'/g, "'\\''");
}

function joinPath(dir, name) {
  return sanitizePath((dir.endsWith('/') ? dir : dir + '/') + name);
}

function contentDispositionHeader(filename) {
  const f = String(filename || 'download');
  const ascii = f.replace(/[^\x20-\x7E]/g, '_');
  const encoded = encodeURIComponent(f);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

router.get('/', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    const path = sanitizePath(req.query.path || '/');
    const lsCmd = `ls -lah --time-style=long-iso '${shellEscape(path)}' 2>&1`;
    const r = await execCommand(conn, lsCmd);
    if (r.stderr) {
      return res.status(400).json({ ok: false, error: r.stderr.trim() });
    }
    res.json({
      ok: true,
      path,
      parent: path === '/' ? null : sanitizePath(path.split('/').slice(0, -1).join('/') || '/'),
      entries: parseLs(r.stdout, path),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.get('/read', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    const path = sanitizePath(req.query.path || '/');
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit || '200', 10)));
    const headR = await execCommand(conn, `head -c 1048576 '${shellEscape(path)}' 2>&1`);
    if (headR.stderr) {
      return res.status(400).json({ ok: false, error: headR.stderr.trim() });
    }
    let content = headR.stdout;
    const lines = content.split('\n').slice(0, limit);
    res.json({
      ok: true,
      path,
      content: lines.join('\n'),
      truncated: headR.stdout.length >= 1024 * 1024,
      line_count: lines.length,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.get('/download', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    const path = sanitizePath(req.query.path || '/');
    const name = String(req.query.name || path.split('/').pop() || 'download');

    const statR = await execCommand(conn, `stat -c '%F' '${shellEscape(path)}' 2>&1`);
    if (!/regular|file/i.test(statR.stdout) || statR.stderr) {
      return res.status(400).json({ ok: false, error: 'No se puede descargar: no es un archivo regular.' });
    }

    const sizeR = await execCommand(conn, `stat -c '%s' '${shellEscape(path)}' 2>&1`);
    const fileSize = parseInt((sizeR.stdout || '0').trim(), 10) || 0;

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', contentDispositionHeader(name));
    if (fileSize > 0) res.setHeader('Content-Length', String(fileSize));

    const chunk = 512 * 1024;
    let offset = 0;
    while (true) {
      const r = await execCommand(
        conn,
        `dd if='${shellEscape(path)}' bs=1 skip=${offset} count=${chunk} 2>/dev/null | base64 -w0; echo __END__`
      );
      let b64 = (r.stdout || '').split('__END__')[0].trim();
      if (!b64) break;
      const buf = Buffer.from(b64, 'base64');
      if (!buf.length) break;
      res.write(buf);
      offset += buf.length;
      if (buf.length < chunk) break;
      if (fileSize && offset >= fileSize) break;
    }
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: err.message || String(err) });
    } else {
      try { res.end(); } catch {}
    }
  }
});

router.post('/mkdir', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    const dir = sanitizePath(req.body?.dir);
    const name = String(req.body?.name || '').trim();
    if (!name || /[\/]/.test(name)) {
      return res.status(400).json({ ok: false, error: 'Nombre de carpeta inválido.' });
    }
    const full = joinPath(dir, name);
    const r = await execCommand(conn, `mkdir -p '${shellEscape(full)}' 2>&1; echo "EXIT=$?"`);
    if (/EXIT=0/.test(r.stdout) && !r.stderr) {
      return res.json({ ok: true, path: full });
    }
    res.status(400).json({ ok: false, error: (r.stderr || r.stdout || 'mkdir falló').trim() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.post('/upload', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    const dir = sanitizePath(req.body?.dir);
    const name = String(req.body?.name || '').trim();
    const mode = String(req.body?.mode || '0644').trim();
    const b64 = String(req.body?.content_base64 || '');
    if (!name || /[\/]/.test(name)) {
      return res.status(400).json({ ok: false, error: 'Nombre de archivo inválido.' });
    }
    if (!b64 || b64.length > (MAX_UPLOAD_BYTES * 4) / 3 + 10) {
      return res.status(400).json({ ok: false, error: `Contenido demasiado grande (máx ${Math.floor(MAX_UPLOAD_BYTES/1024)} KB).` });
    }
    const full = joinPath(dir, name);
    const tmpName = `.auraui_upload_${Date.now()}_${Math.floor(Math.random()*100000)}`;
    const tmpPath = joinPath('/tmp', tmpName);
    const writeR = await execCommand(
      conn,
      `printf '%s' '${shellEscape(b64)}' | base64 -d > '${shellEscape(tmpPath)}' 2>&1 && mv '${shellEscape(tmpPath)}' '${shellEscape(full)}' 2>&1 && chmod ${mode} '${shellEscape(full)}' 2>&1; echo "EXIT=$?"`
    );
    if (/EXIT=0/.test(writeR.stdout) && !writeR.stderr) {
      return res.json({ ok: true, path: full });
    }
    res.status(400).json({ ok: false, error: (writeR.stderr || writeR.stdout || 'upload falló').trim() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.post('/delete', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    const target = sanitizePath(req.body?.path);
    if (target === '/') {
      return res.status(400).json({ ok: false, error: 'No se permite borrar /.' });
    }
    const recursive = req.body?.recursive === true;
    const cmd = recursive
      ? `rm -rf -- '${shellEscape(target)}' 2>&1`
      : `rm -f -- '${shellEscape(target)}' 2>&1`;
    const r = await execCommand(conn, `${cmd}; echo "EXIT=$?"`);
    if (/EXIT=0/.test(r.stdout) && !r.stderr) {
      return res.json({ ok: true });
    }
    res.status(400).json({ ok: false, error: (r.stderr || r.stdout || 'delete falló').trim() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.post('/rename', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    const oldPath = sanitizePath(req.body?.path);
    const newName = String(req.body?.name || '').trim();
    if (!newName || /[\/]/.test(newName)) {
      return res.status(400).json({ ok: false, error: 'Nombre inválido.' });
    }
    const parent = sanitizePath(oldPath.split('/').slice(0, -1).join('/') || '/');
    const newPath = joinPath(parent, newName);
    if (oldPath === newPath) return res.json({ ok: true, path: newPath });
    const r = await execCommand(conn, `mv -T -- '${shellEscape(oldPath)}' '${shellEscape(newPath)}' 2>&1; echo "EXIT=$?"`);
    if (/EXIT=0/.test(r.stdout) && !r.stderr) {
      return res.json({ ok: true, path: newPath });
    }
    res.status(400).json({ ok: false, error: (r.stderr || r.stdout || 'rename falló').trim() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.post('/copy', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    const src = sanitizePath(req.body?.source);
    const destDir = sanitizePath(req.body?.dest_dir);
    const name = String(req.body?.name || '').trim() || src.split('/').pop() || 'copy';
    if (!name || /[\/]/.test(name)) return res.status(400).json({ ok: false, error: 'Nombre inválido.' });
    if (src === '/' || destDir === '/') return res.status(400).json({ ok: false, error: 'Operación no permitida sobre /.' });
    const isDir = /^\s*d/.test(
      (await execCommand(conn, `ls -ld '${shellEscape(src)}' 2>&1`)).stdout.split('\n')[0] || ''
    );
    const dest = joinPath(destDir, name);
    if (dest === src) return res.json({ ok: true, path: dest });
    const flag = isDir ? '-a' : '';
    const r = await execCommand(
      conn,
      `dest='${shellEscape(dest)}'; if [ -e "$dest" ]; then i=1; while [ -e "${dest}__cp_$i" ]; do i=$((i+1)); done; dest="${dest}__cp_$i"; fi; cp ${flag} -n -- '${shellEscape(src)}' "$dest" 2>&1; echo "EXIT=$?__DEST__$dest"`
    );
    const m = r.stdout.match(/EXIT=(\d+)__DEST__(.+)$/m);
    const exit = m ? Number(m[1]) : -1;
    const finalDest = m ? m[2].trim() : dest;
    if (exit === 0 && !r.stderr) return res.json({ ok: true, path: finalDest });
    res.status(400).json({ ok: false, path: finalDest, error: (r.stderr || r.stdout || 'copy falló').trim() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.post('/move', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    const src = sanitizePath(req.body?.source);
    const destDir = sanitizePath(req.body?.dest_dir);
    const name = String(req.body?.name || '').trim() || src.split('/').pop() || 'move';
    if (!name || /[\/]/.test(name)) return res.status(400).json({ ok: false, error: 'Nombre inválido.' });
    if (src === '/' || destDir === '/') return res.status(400).json({ ok: false, error: 'Operación no permitida sobre /.' });
    const dest = joinPath(destDir, name);
    if (dest === src) return res.json({ ok: true, path: dest });
    const r = await execCommand(
      conn,
      `dest='${shellEscape(dest)}'; if [ -e "$dest" ]; then i=1; while [ -e "${dest}__mv_$i" ]; do i=$((i+1)); done; dest="${dest}__mv_$i"; fi; mv -T -- '${shellEscape(src)}' "$dest" 2>&1; echo "EXIT=$?__DEST__$dest"`
    );
    const m = r.stdout.match(/EXIT=(\d+)__DEST__(.+)$/m);
    const exit = m ? Number(m[1]) : -1;
    const finalDest = m ? m[2].trim() : dest;
    if (exit === 0 && !r.stderr) return res.json({ ok: true, path: finalDest });
    res.status(400).json({ ok: false, path: finalDest, error: (r.stderr || r.stdout || 'move falló').trim() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

export default router;
