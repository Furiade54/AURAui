import { Router } from 'express';
import { ensureSshClient, execCommand } from '../lib/sshClient.js';

const router = Router();

const COMMON_PACKAGES = [
  { name: 'htop', category: 'Monitorización', description: 'Monitor interactivo de procesos (TUI). Mejor top.' },
  { name: 'btop', category: 'Monitorización', description: 'htop modernizado: CPU/RAM/Disco/Red con gráficos animados.' },
  { name: 'iotop', category: 'Monitorización', description: 'Monitor en tiempo real de E/S de disco por proceso.' },
  { name: 'iftop', category: 'Monitorización', description: 'Ancho de banda por conexión/host en interfaz de red.' },
  { name: 'bmon', category: 'Monitorización', description: 'Monitor de ancho de banda de red con tasas y gráficos.' },
  { name: 'nmon', category: 'Monitorización', description: 'Monitor todo-en-uno: CPU, RAM, Disco, Red, FS.' },
  { name: 'glances', category: 'Monitorización', description: 'Dashboard multi-métricas con vista web/TUI/curses.' },
  { name: 'bpytop', category: 'Monitorización', description: 'htop++ en python: recursos, procesos, gráficos.' },
  { name: 'vnstat', category: 'Monitorización', description: 'Tráfico de red histórico/consolidado por interfaz.' },
  { name: 'nload', category: 'Monitorización', description: 'Gráfico en vivo de tráfico de red por interfaz.' },
  { name: 'iptraf-ng', category: 'Monitorización', description: 'Monitor IP LAN detallado por TCP/UDP/puerto/conexión.' },
  { name: 'sysstat', category: 'Monitorización', description: 'Sar/iostat/mpstat — estadísticas históricas de sistema.' },
  { name: 'ncdu', category: 'Utilidades', description: 'Uso de disco interactivo por directorio (TUI tipo du).' },
  { name: 'duf', category: 'Utilidades', description: 'df moderno con columnas, colores y devices ordenados.' },
  { name: 'tree', category: 'Utilidades', description: 'Listado recursivo de archivos como árbol ASCII.' },
  { name: 'fzf', category: 'Utilidades', description: 'Fuzzy finder generalista para shell, archivos, history.' },
  { name: 'ripgrep', category: 'Utilidades', description: 'grep ultra-rápido recursivo (comando `rg`).' },
  { name: 'fd-find', category: 'Utilidades', description: 'Alternativa rápida a `find` (comando `fdfind`/`fd`).' },
  { name: 'bat', category: 'Utilidades', description: 'cat con sintaxis highlighting y números de línea.' },
  { name: 'ranger', category: 'Utilidades', description: 'Explorador de archivos TUI con navegación por vi.' },
  { name: 'neofetch', category: 'Utilidades', description: 'Información de sistema ASCII-art en terminal.' },
  { name: 'jq', category: 'Utilidades', description: 'Procesador JSON CLI: filtros, formato, queries.' },
  { name: 'curl', category: 'Utilidades', description: 'Transferencia de URL CLI (HTTP(S)/FTP/etc.).' },
  { name: 'wget', category: 'Utilidades', description: 'Descarga archivos HTTP(S)/FTP por línea de comandos.' },
  { name: 'lsof', category: 'Utilidades', description: 'Lista archivos abiertos, sockets, procesos que los usan.' },
  { name: 'strace', category: 'Utilidades', description: 'Tracer syscalls de un proceso (depuración).' },
  { name: 'psmisc', category: 'Utilidades', description: 'Comandos pstree, fuser, killall por nombre de proceso.' },
  { name: 'mlocate', category: 'Utilidades', description: 'Buscar archivos rápidamente con índice `locate`.' },
  { name: 'acl', category: 'Utilidades', description: 'Soporte ACL extendido: `setfacl`, `getfacl`.' },
  { name: 'attr', category: 'Utilidades', description: 'Atributos extendidos de archivos: `setfattr`, `getfattr`.' },
  { name: 'chrony', category: 'Utilidades', description: 'Cliente NTP moderno para sincronizar hora del sistema.' },
  { name: 'tzdata', category: 'Utilidades', description: 'Datos timezone: `dpkg-reconfigure tzdata`.' },
  { name: 'locales', category: 'Utilidades', description: 'Generar locales UTF-8 (es_ES.UTF-8, etc.).' },
  { name: 'needrestart', category: 'Utilidades', description: 'Detecta qué servicios hay que reiniciar tras apt upgrade.' },
  { name: 'debsums', category: 'Utilidades', description: 'Comprobar MD5 de archivos instalados por dpkg.' },
  { name: 'etckeeper', category: 'Utilidades', description: 'Versionar /etc en Git (auto-commits en upgrades).' },
  { name: 'git', category: 'Herramientas', description: 'Sistema de control de versiones distribuido.' },
  { name: 'zip', category: 'Herramientas', description: 'Compresión y empaquetado en formato .zip.' },
  { name: 'unzip', category: 'Herramientas', description: 'Extraer archivos .zip.' },
  { name: 'tar', category: 'Herramientas', description: 'Archivador tar + gzip/bzip2/xz (viene normalmente instalado).' },
  { name: 'rsync', category: 'Herramientas', description: 'Sincronización de archivos remota/local eficiente delta.' },
  { name: 'pv', category: 'Herramientas', description: 'Monitorizar progreso de datos por tubería (pipe viewer).' },
  { name: 'dialog', category: 'Herramientas', description: 'Menús y cuadros diálogo en shell scripts.' },
  { name: 'nano', category: 'Editores', description: 'Editor de texto terminal sencillo y amigable.' },
  { name: 'vim', category: 'Editores', description: 'Editor de texto modal vi mejorado (potente).' },
  { name: 'micro', category: 'Editores', description: 'Editor terminal moderno estilo VSCode con atajos comunes.' },
  { name: 'tmux', category: 'Terminal', description: 'Multiplexor de terminal: ventanas/paneles/sesiones.' },
  { name: 'screen', category: 'Terminal', description: 'Multiplexor de terminal clásico (sesiones persistentes).' },
  { name: 'zsh', category: 'Terminal', description: 'Shell Z con autocompletado y temas (oh-my-zsh ready).' },
  { name: 'fish', category: 'Terminal', description: 'Shell friendly e interactivo, sugerencias smart.' },
  { name: 'bash-completion', category: 'Terminal', description: 'Autocompletado inteligente por tab en bash.' },
  { name: 'ufw', category: 'Seguridad', description: 'Firewall sin complicaciones (frontend a iptables).' },
  { name: 'fail2ban', category: 'Seguridad', description: 'Banea IPs tras intentos fallidos de login SSH.' },
  { name: 'certbot', category: 'Seguridad', description: 'Gestiona certificados Let\'s Encrypt SSL/TLS.' },
  { name: 'openssl', category: 'Seguridad', description: 'Herramienta TLS/SSL y crypto general.' },
  { name: 'ca-certificates', category: 'Seguridad', description: 'Autoridades de certificación comunes.' },
  { name: 'rkhunter', category: 'Seguridad', description: 'Rootkit hunter: escanea malware y rootkits.' },
  { name: 'chkrootkit', category: 'Seguridad', description: 'Otro detector de rootkits localmente.' },
  { name: 'apparmor', category: 'Seguridad', description: 'MAC AppArmor: perfiles por aplicación.' },
  { name: 'auditd', category: 'Seguridad', description: 'Subsistema de auditoría del kernel Linux.' },
  { name: 'caddy', category: 'Servidores', description: 'Servidor web/HTTPS moderno con auto-SSL por Caddyfile.' },
  { name: 'nginx', category: 'Servidores', description: 'Servidor web/proxy reverso high-performance.' },
  { name: 'apache2', category: 'Servidores', description: 'Servidor web Apache HTTP Server clásico.' },
  { name: 'apache2-utils', category: 'Servidores', description: 'Utilidades Apache: htpasswd, ab (benchmark).' },
  { name: 'redis-server', category: 'Bases de datos', description: 'Servidor Redis: datastore en memoria y disco.' },
  { name: 'postgresql', category: 'Bases de datos', description: 'Servidor PostgreSQL (completo + cliente).' },
  { name: 'mariadb-server', category: 'Bases de datos', description: 'Servidor MariaDB (fork compatible MySQL).' },
  { name: 'mongodb-org', category: 'Bases de datos', description: 'MongoDB server (necesita repo 10gen/MongoDB).' },
  { name: 'docker.io', category: 'Contenedores', description: 'Motor Docker Community Edition por apt.' },
  { name: 'docker-compose-v2', category: 'Contenedores', description: 'Plugin docker compose v2 oficial.' },
  { name: 'ctop', category: 'Contenedores', description: 'Top para containers Docker métricas en vivo.' },
  { name: 'lazydocker', category: 'Contenedores', description: 'TUI para gestionar Docker/containers/images.' },
  { name: 'podman', category: 'Contenedores', description: 'Motor containers sin daemon (Docker-compatible).' },
  { name: 'buildah', category: 'Contenedores', description: 'Construye imágenes OCI sin Docker daemon.' },
  { name: 'skopeo', category: 'Contenedores', description: 'Inspecciona/copia/mueve imágenes de registries OCI.' },
  { name: 'postgresql-client', category: 'Bases de datos', description: 'Cliente CLI psql para PostgreSQL.' },
  { name: 'mysql-client', category: 'Bases de datos', description: 'Cliente CLI mysql para MySQL/MariaDB.' },
  { name: 'redis-tools', category: 'Bases de datos', description: 'Herramientas CLI (redis-cli, etc.) para Redis.' },
  { name: 'sqlite3', category: 'Bases de datos', description: 'Motor SQL embebido + CLI sqlite3.' },
  { name: 'mongodb-clients', category: 'Bases de datos', description: 'Cliente CLI para MongoDB.' },
  { name: 'prometheus-node-exporter', category: 'Observabilidad', description: 'Exporta métricas de host para Prometheus.' },
  { name: 'net-tools', category: 'Red', description: 'Herramientas legacy: ifconfig, netstat, route, arp.' },
  { name: 'iproute2', category: 'Red', description: 'Herramientas modernas de red: ip, ss, tc.' },
  { name: 'dnsutils', category: 'Red', description: 'Utilidades DNS: dig, nslookup.' },
  { name: 'traceroute', category: 'Red', description: 'Rastro de ruta IP a destino.' },
  { name: 'tcpdump', category: 'Red', description: 'Capturador de paquetes/libpcap por consola.' },
  { name: 'mtr-tiny', category: 'Red', description: 'Combina ping + traceroute en TUI.' },
  { name: 'nmap', category: 'Red', description: 'Escáner de puertos y auditoría de red.' },
  { name: 'whois', category: 'Red', description: 'Consulta WHOIS de dominios y ASNs IP.' },
  { name: 'iputils-ping', category: 'Red', description: 'Ping/arping/tracepath (básico, normalmente instalado).' },
  { name: 'iperf3', category: 'Red', description: 'Medir ancho de banda LAN/WAN entre dos máquinas.' },
  { name: 'ethtool', category: 'Red', description: 'Configurar y ver estado de tarjetas Ethernet (driver/modos).' },
  { name: 'bridge-utils', category: 'Red', description: 'Crear puentes de red Linux (`brctl`).' },
  { name: 'netcat-openbsd', category: 'Red', description: 'Swiss army knife TCP/UDP: nc, debug sockets.' },
  { name: 'openssh-server', category: 'Sistema', description: 'Servidor OpenSSH (sshd).' },
  { name: 'openssh-client', category: 'Sistema', description: 'Cliente OpenSSH (ssh/scp/sftp), normalmente instalado.' },
  { name: 'build-essential', category: 'Sistema', description: 'GCC/G++/make y herramientas de compilación.' },
  { name: 'software-properties-common', category: 'Sistema', description: 'Añadir repositorios PPA/terceros.' },
  { name: 'lsb-release', category: 'Sistema', description: 'Información de release de distribución.' },
  { name: 'apt-transport-https', category: 'Sistema', description: 'Soporte HTTPS para repositorios APT.' },
  { name: 'unattended-upgrades', category: 'Sistema', description: 'Actualizaciones automáticas de seguridad.' },
  { name: 'sudo', category: 'Sistema', description: 'Escalado privilegios por usuario/grupo (`sudo`).' },
  { name: 'gnupg', category: 'Sistema', description: 'GPG: firmar/cifrar con clave pública/privada OpenPGP.' },
  { name: 'htpasswd', category: 'Sistema', description: 'Generar archivos htpasswd para Nginx/Apache BasicAuth.' },
  { name: 'lvm2', category: 'Almacenamiento', description: 'Logical Volume Manager: PV/VG/LV redimensionar discos.' },
  { name: 'mdadm', category: 'Almacenamiento', description: 'Gestionar arrays RAID software Linux.' },
  { name: 'smartmontools', category: 'Almacenamiento', description: 'SMART: predecir fallos de HDD/SSD.' },
  { name: 'xfsprogs', category: 'Almacenamiento', description: 'Herramientas mkfs.xfs, xfs_growfs, xfs_repair.' },
  { name: 'btrfs-progs', category: 'Almacenamiento', description: 'mkfs.btrfs y utilidades Btrfs (snapshots, scrub).' },
  { name: 'python3', category: 'Lenguajes', description: 'Intérprete Python 3 (base del sistema en Ubuntu).' },
  { name: 'python3-pip', category: 'Lenguajes', description: 'Gestor de paquetes Python (`pip3`).' },
  { name: 'python3-venv', category: 'Lenguajes', description: 'Crear entornos virtuales Python venv.' },
  { name: 'pipx', category: 'Lenguajes', description: 'Instalar CLIs Python en entornos aislados por app.' },
  { name: 'python3-dev', category: 'Lenguajes', description: 'Headers Python 3 para compilar extensiones C.' },
  { name: 'nodejs', category: 'Lenguajes', description: 'Runtime JavaScript V8 en servidor (versión Ubuntu).' },
  { name: 'npm', category: 'Lenguajes', description: 'Gestor de paquetes Node.js / npm.' },
  { name: 'yarn', category: 'Lenguajes', description: 'Gestor alternativo de paquetes Node.js, paralelizado.' },
  { name: 'golang-go', category: 'Lenguajes', description: 'Go toolchain completo (compilador `go`).' },
  { name: 'ruby-full', category: 'Lenguajes', description: 'Ruby + gems y herramientas de desarrollo.' },
  { name: 'rustc', category: 'Lenguajes', description: 'Compilador Rust (rustc + std).' },
  { name: 'php-cli', category: 'Lenguajes', description: 'PHP CLI + FPM típico (cron scripts, artisan, etc.).' },
  { name: 'php-fpm', category: 'Lenguajes', description: 'PHP-FPM: procesador FastCGI para Nginx/Apache.' },
  { name: 'composer', category: 'Lenguajes', description: 'Gestor de dependencias PHP (Equivalente npm/pip).' },
  { name: 'default-jdk', category: 'Lenguajes', description: 'OpenJDK JDK completo Java (último disponible).' },
  { name: 'default-jre', category: 'Lenguajes', description: 'JRE para ejecutar .jar (más ligero que JDK).' },
  { name: 'ansible', category: 'DevOps', description: 'Gestión config/orquestación sin agentes vía SSH/Playbooks YAML.' },
  { name: 'ansible-lint', category: 'DevOps', description: 'Linter de buenas prácticas para playbooks Ansible.' },
  { name: 'terraform', category: 'DevOps', description: 'IaC multi-provider (HashiCorp repo extra).' },
  { name: 'kubectl', category: 'DevOps', description: 'CLI para Kubernetes (gestiona clusters K8s).' },
  { name: 'helm', category: 'DevOps', description: 'Gestor de charts paquetes de aplicaciones Kubernetes.' },
  { name: 'certbot-dns-cloudflare', category: 'DevOps', description: 'Plugin Certbot DNS-01 con Cloudflare API (wildcards).' },
  { name: 'msmtp', category: 'Correo', description: 'SMTP cliente ligero, envía mails desde la VPS por relay.' },
  { name: 's-nail', category: 'Correo', description: 'Cliente mailx compatible para mandar correos por CLI.' },
  { name: 'postfix', category: 'Correo', description: 'MTA servidor Postfix para envío/recepción SMTP.' },
  { name: 'mailutils', category: 'Correo', description: 'Conjunto mail utilities (mbox/imap/pop3/mail).' },
];

function sanitizePkg(name) {
  return String(name || '').replace(/[^a-zA-Z0-9._+\-]/g, '').slice(0, 128);
}

async function streamCommand(conn, command, res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Accel-Buffering', 'no');
  return new Promise((resolve, reject) => {
    let exited = false;
    conn.exec(command, { pty: false }, (err, stream) => {
      if (err) {
        if (!res.headersSent) res.status(500);
        try { res.write(`exec error: ${err.message}\n`); } catch {}
        try { res.end(); } catch {}
        return reject(err);
      }
      stream.on('close', (code) => {
        if (exited) return;
        exited = true;
        try { res.write(`\n[Exit code ${code ?? 0}]\n`); } catch {}
        try { res.end(); } catch {}
        resolve(code ?? 0);
      });
      stream.on('error', (e) => {
        if (exited) return;
        exited = true;
        try { res.write(`stream error: ${e.message}\n`); } catch {}
        try { res.end(); } catch {}
        reject(e);
      });
      stream.stdout.on('data', (d) => {
        try { res.write(d.toString()); } catch {}
      });
      stream.stderr.on('data', (d) => {
        try { res.write(d.toString()); } catch {}
      });
    });
  });
}

async function queryInstalled(conn, names) {
  const list = names.map(sanitizePkg).filter(Boolean);
  if (list.length === 0) return {};
  const expr = list.join('\\|');
  const r = await execCommand(
    conn,
    `dpkg-query -W -f='\\${Package}\\t\\${Version}\\t\\${Status}\\n' ${list.map(s => `'${s}'`).join(' ')} 2>/dev/null | grep -E "^(${expr})\\t" || true`
  );
  const installed = {};
  for (const line of r.stdout.trim().split('\n')) {
    if (!line) continue;
    const [name, version, status] = line.split('\t');
    if (!name) continue;
    const ok = status && status.toLowerCase().includes('install ok installed');
    if (ok) installed[name] = { installed: true, version: version || '' };
  }
  return installed;
}

router.get('/catalog', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    const installed = await queryInstalled(conn, COMMON_PACKAGES.map(p => p.name));
    res.json({
      ok: true,
      packages: COMMON_PACKAGES.map(p => ({
        name: p.name,
        category: p.category,
        description: p.description,
        installed: !!installed[p.name],
        version: installed[p.name]?.version || '',
      })),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.post('/status', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    const names = Array.isArray(req.body?.names) ? req.body.names : [req.body?.name].filter(Boolean);
    const installed = await queryInstalled(conn, names);
    const out = names.map(n => ({
      name: n,
      installed: !!installed[n],
      version: installed[n]?.version || '',
    }));
    res.json({ ok: true, items: out });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.post('/install', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    const names = Array.isArray(req.body?.names) ? req.body.names : [req.body?.name].filter(Boolean);
    const safe = names.map(sanitizePkg).filter(Boolean);
    if (safe.length === 0) return res.status(400).json({ ok: false, error: 'No se especificaron paquetes.' });
    const cmd = `DEBIAN_FRONTEND=noninteractive apt-get update -y && DEBIAN_FRONTEND=noninteractive apt-get install -y ${safe.map(s => `'${s}'`).join(' ')}`;
    await streamCommand(conn, cmd, res);
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.post('/uninstall', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    const names = Array.isArray(req.body?.names) ? req.body.names : [req.body?.name].filter(Boolean);
    const safe = names.map(sanitizePkg).filter(Boolean);
    if (safe.length === 0) return res.status(400).json({ ok: false, error: 'No se especificaron paquetes.' });
    const purge = !!req.body?.purge;
    const cmd = `DEBIAN_FRONTEND=noninteractive apt-get ${purge ? 'purge' : 'remove'} -y ${safe.map(s => `'${s}'`).join(' ')} && DEBIAN_FRONTEND=noninteractive apt-get autoremove -y || true`;
    await streamCommand(conn, cmd, res);
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.post('/update', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    const cmd = `DEBIAN_FRONTEND=noninteractive apt-get update -y`;
    await streamCommand(conn, cmd, res);
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.post('/upgrade', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    const full = !!req.body?.full;
    const cmd = `DEBIAN_FRONTEND=noninteractive apt-get update -y && DEBIAN_FRONTEND=noninteractive apt-get ${full ? 'dist-upgrade' : 'upgrade'} -y`;
    await streamCommand(conn, cmd, res);
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.post('/autoremove', async (req, res) => {
  try {
    const conn = await ensureSshClient(req, process.env);
    const cmd = `DEBIAN_FRONTEND=noninteractive apt-get autoremove -y && DEBIAN_FRONTEND=noninteractive apt-get clean`;
    await streamCommand(conn, cmd, res);
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

export default router;
