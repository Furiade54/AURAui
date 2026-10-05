/// <reference types="vite/client" />

const DEFAULT_BASE = import.meta.env.VITE_API_BASE_URL || '';

export interface VpsConfig {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface CpuMetrics {
  user: number;
  system: number;
  used: number;
  idle: number;
  cores: number;
}

export interface MemoryMetrics {
  total_kb: number;
  used_kb: number;
  free_kb: number;
  buffers_kb: number;
  cached_kb: number;
  used_real_kb: number;
  total_mb: number;
  used_mb: number;
  percent: number;
}

export interface DiskMount {
  filesystem: string;
  total_bytes: number;
  used_bytes: number;
  available_bytes: number;
  use_percent: number;
  mount_point: string;
}

export interface NetworkIface {
  name: string;
  rx_bytes: number;
  rx_packets: number;
  tx_bytes: number;
  tx_packets: number;
}

export interface UptimeInfo {
  raw: string;
  uptime: string;
  load_1m: number;
  load_5m: number;
  load_15m: number;
}

export interface UnameInfo {
  kernel: string;
  release: string;
  arch: string;
  full: string;
}

export interface MetricsResponse {
  ok: boolean;
  hostname: string;
  uname: UnameInfo;
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  disk: DiskMount[];
  network: NetworkIface[];
  uptime: UptimeInfo;
  timestamp: string;
}

export interface ProcessInfo {
  user: string;
  pid: number;
  cpu: number;
  mem: number;
  vsz_kb: number;
  rss_kb: number;
  tty: string;
  stat: string;
  start: string;
  time: string;
  command: string;
}

export interface DockerPublishedPort {
  host_ip: string | null;
  host_port: number;
  container_port: number;
  proto: 'tcp' | 'udp';
}

export interface DockerContainer {
  id: string;
  image: string;
  command: string;
  created: string;
  status: string;
  ports: string;
  names: string;
  published_ports?: DockerPublishedPort[];
  vps_host?: string | null;
}

export interface DockerStats {
  id: string;
  name: string;
  cpu_pct: number;
  mem_used_bytes: number;
  mem_limit_bytes: number;
  mem_pct: number;
  net_rx_bytes: number;
  net_tx_bytes: number;
  block_read_bytes: number;
  block_write_bytes: number;
  pids: number | null;
}

export interface DockerImage {
  repository: string;
  tag: string;
  image_id: string;
  created: string;
  size: string;
}

export interface DockerVolume {
  name: string;
  driver: string;
  scope: string;
}

export interface SystemService {
  unit: string;
  load: string;
  active: string;
  sub: string;
  description: string;
}

export interface ServiceFile {
  unit_file: string;
  state: string;
  preset: string;
}

export interface FileEntry {
  name: string;
  type: 'directory' | 'file' | 'symlink';
  size: number;
  perms: string;
  links: string;
  owner: string;
  group: string;
  modified: string;
  path: string;
}

export interface ListFilesResponse {
  ok: boolean;
  path: string;
  parent: string | null;
  entries: FileEntry[];
}

export interface ReadFileResponse {
  ok: boolean;
  path: string;
  content: string;
  truncated: boolean;
  line_count: number;
}

export interface PackageInfo {
  name: string;
  category: string;
  description: string;
  installed: boolean;
  version: string;
}

export interface PackagesCatalogResponse {
  ok: boolean;
  packages: PackageInfo[];
}

export interface PackageStatusItem {
  name: string;
  installed: boolean;
  version: string;
}

export interface PackageStatusResponse {
  ok: boolean;
  items: PackageStatusItem[];
}

let cachedConfig: VpsConfig = {};

export function setVpsConfig(cfg: VpsConfig) {
  cachedConfig = { ...cfg };
}

export function getVpsConfig(): VpsConfig {
  const fromStorage = typeof window !== 'undefined' ? window.localStorage.getItem('vps_config') : null;
  if (fromStorage) {
    try {
      cachedConfig = { ...cachedConfig, ...JSON.parse(fromStorage) };
    } catch {}
  }
  return { ...cachedConfig };
}

function withBody(body: any): any {
  const cfg = getVpsConfig();
  return {
    ...(cfg || {}),
    ...(body || {}),
  };
}

function withVpsHeaders(headers: Record<string, string>): Record<string, string> {
  const cfg = getVpsConfig();
  if (!cfg) return headers;
  const out: Record<string, string> = { ...headers };
  const set = (k: string, v: any) => {
    if (v !== undefined && v !== null && v !== '') out[k] = String(v);
  };
  set('x-vps-host', cfg.host);
  set('x-vps-port', cfg.port);
  set('x-vps-username', cfg.username);
  set('x-vps-password', cfg.password);
  set('x-vps-privatekey', cfg.privateKey);
  set('x-vps-passphrase', cfg.passphrase);
  return out;
}

async function request<T = any>(
  method: 'GET' | 'POST',
  path: string,
  body?: any,
  query?: Record<string, any>
): Promise<T> {
  const qs = query
    ? '?' +
      Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as any)}`)
        .join('&')
    : '';
  const url = `${DEFAULT_BASE}${path}${qs}`;
  const opts: RequestInit = {
    method,
    headers: withVpsHeaders({ 'Content-Type': 'application/json' }),
  };
  if (method === 'POST' || body !== undefined) {
    opts.body = JSON.stringify(withBody(body || {}));
  }
  const res = await fetch(url, opts);
  if (!res.ok) {
    let text = await res.text().catch(() => '');
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {}
    throw new Error(parsed?.error || text || `HTTP ${res.status}`);
  }
  return res.json();
}

async function requestStream(
  method: 'POST',
  path: string,
  body?: any,
  opts?: {
    onChunk?: (data: string) => void;
  }
): Promise<{ ok: boolean; status: number; fullText: string }> {
  const url = `${DEFAULT_BASE}${path}`;
  const fetchOpts: RequestInit = {
    method,
    headers: withVpsHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(withBody(body || {})),
  };
  const res = await fetch(url, fetchOpts);
  let fullText = '';
  if (res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let done = false;
    while (!done) {
      const r = await reader.read().catch(() => ({ done: true as const, value: undefined }));
      done = !!r.done;
      const chunk = r.value;
      if (chunk) {
        const s = decoder.decode(chunk, { stream: !done });
        fullText += s;
        opts?.onChunk?.(s);
      }
    }
  } else {
    fullText = await res.text().catch(() => '');
    if (fullText) opts?.onChunk?.(fullText);
  }
  return { ok: res.ok, status: res.status, fullText };
}

export const api = {
  health: () => request<any>('GET', '/api/health'),
  testVps: (cfg?: VpsConfig) => request<any>('POST', '/api/vps/test', cfg || {}),
  disconnectVps: () => request<any>('POST', '/api/vps/disconnect', {}),

  getMetrics: () => request<MetricsResponse>('GET', '/api/metrics'),

  listProcesses: (limit = 80) =>
    request<{ ok: boolean; processes: ProcessInfo[]; count: number }>('GET', '/api/processes', undefined, { limit }),
  killProcess: (pid: number, signal = 15) =>
    request<{ ok: boolean; code: number; output: string }>('POST', `/api/processes/${pid}/kill`, { signal }),

  dockerPs: async (all = false) => {
    const r = await request<{ ok: boolean; vps_host?: string | null; containers: DockerContainer[] }>(
      'GET',
      '/api/docker/ps',
      undefined,
      { all: all ? '1' : '0' }
    );
    if (r.vps_host && r.containers) {
      r.containers = r.containers.map((c) => ({ ...c, vps_host: c.vps_host ?? r.vps_host }));
    }
    return r;
  },
  dockerStats: () =>
    request<{ ok: boolean; stats: DockerStats[]; error?: string }>('GET', '/api/docker/stats'),
  dockerImages: () => request<{ ok: boolean; images: DockerImage[] }>('GET', '/api/docker/images'),
  dockerVolumes: () => request<{ ok: boolean; volumes: DockerVolume[] }>('GET', '/api/docker/volumes'),
  dockerStart: (id: string) => request<{ ok: boolean; output: string }>('POST', `/api/docker/${id}/start`),
  dockerStop: (id: string) => request<{ ok: boolean; output: string }>('POST', `/api/docker/${id}/stop`),
  dockerRestart: (id: string) => request<{ ok: boolean; output: string }>('POST', `/api/docker/${id}/restart`),
  dockerLogs: (id: string, tail = 100) =>
    request<{ ok: boolean; logs: string }>('GET', `/api/docker/${id}/logs`, undefined, { tail }),

  listServices: (state = 'running', type = 'service') =>
    request<{ ok: boolean; services: SystemService[] }>('GET', '/api/services', undefined, { state, type }),
  listAllServices: () => request<{ ok: boolean; files: ServiceFile[] }>('GET', '/api/services/all'),
  serviceStatus: (name: string) => request<{ ok: boolean; output: string }>('GET', `/api/services/${name}/status`),
  serviceStart: (name: string) => request<{ ok: boolean; output: string }>('POST', `/api/services/${name}/start`),
  serviceStop: (name: string) => request<{ ok: boolean; output: string }>('POST', `/api/services/${name}/stop`),
  serviceRestart: (name: string) => request<{ ok: boolean; output: string }>('POST', `/api/services/${name}/restart`),
  serviceEnable: (name: string) => request<{ ok: boolean; output: string }>('POST', `/api/services/${name}/enable`),
  serviceDisable: (name: string) => request<{ ok: boolean; output: string }>('POST', `/api/services/${name}/disable`),

  listFiles: (path = '/') =>
    request<ListFilesResponse>('GET', '/api/files', undefined, { path }),
  readFile: (path: string, limit = 200) =>
    request<ReadFileResponse>('GET', '/api/files/read', undefined, { path, limit }),
  buildDownloadUrl: (path: string, name?: string): string => {
    const cfg = getVpsConfig();
    const q = new URLSearchParams({ path });
    if (name) q.set('name', name);
    if (cfg.host) q.set('__h', cfg.host);
    if (cfg.port) q.set('__p', String(cfg.port));
    if (cfg.username) q.set('__u', cfg.username);
    if (cfg.password) q.set('__pw', cfg.password);
    if (cfg.privateKey) q.set('__pk', cfg.privateKey);
    if (cfg.passphrase) q.set('__pp', cfg.passphrase);
    return `${DEFAULT_BASE}/api/files/download?${q.toString()}`;
  },
  mkdir: (dir: string, name: string) =>
    request<{ ok: boolean; path: string }>('POST', '/api/files/mkdir', { dir, name }),
  uploadFile: (dir: string, name: string, contentBase64: string, mode = '0644') =>
    request<{ ok: boolean; path: string }>('POST', '/api/files/upload', {
      dir,
      name,
      mode,
      content_base64: contentBase64,
    }),
  deleteFile: (path: string, recursive = false) =>
    request<{ ok: boolean }>('POST', '/api/files/delete', { path, recursive }),
  renameFile: (path: string, name: string) =>
    request<{ ok: boolean; path: string }>('POST', '/api/files/rename', { path, name }),
  copyFile: (source: string, destDir: string, name?: string) =>
    request<{ ok: boolean; path: string }>('POST', '/api/files/copy', { source, dest_dir: destDir, name }),
  moveFile: (source: string, destDir: string, name?: string) =>
    request<{ ok: boolean; path: string }>('POST', '/api/files/move', { source, dest_dir: destDir, name }),

  listPackages: () => request<PackagesCatalogResponse>('GET', '/api/packages/catalog'),
  packageStatus: (names: string[]) =>
    request<PackageStatusResponse>('POST', '/api/packages/status', { names }),
  installPackages: (
    names: string | string[],
    opts?: { onChunk?: (chunk: string) => void }
  ) =>
    requestStream('POST', '/api/packages/install', {
      names: Array.isArray(names) ? names : [names],
    }, opts),
  uninstallPackages: (
    names: string | string[],
    opts?: { onChunk?: (chunk: string) => void; purge?: boolean }
  ) =>
    requestStream('POST', '/api/packages/uninstall', {
      names: Array.isArray(names) ? names : [names],
      purge: opts?.purge ?? false,
    }, opts),
  aptUpdate: (opts?: { onChunk?: (chunk: string) => void }) =>
    requestStream('POST', '/api/packages/update', {}, opts),
  aptUpgrade: (opts?: { onChunk?: (chunk: string) => void; full?: boolean }) =>
    requestStream('POST', '/api/packages/upgrade', { full: opts?.full ?? false }, opts),
  aptAutoremove: (opts?: { onChunk?: (chunk: string) => void }) =>
    requestStream('POST', '/api/packages/autoremove', {}, opts),
};

export interface TerminalWSClientOpts {
  onOutput?: (data: string) => void;
  onReady?: () => void;
  onClose?: (code: number, reason: string) => void;
  onError?: (err: any) => void;
}

export function createTerminalWS(opts: TerminalWSClientOpts = {}) {
  const wsBase = DEFAULT_BASE.replace(/^http/, 'ws');
  const url = `${wsBase}/ws/terminal`;
  const ws = new WebSocket(url);

  ws.addEventListener('message', (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (msg.type === 'output') opts.onOutput?.(msg.data);
    else if (msg.type === 'ready') opts.onReady?.();
  });
  ws.addEventListener('close', (e) => opts.onClose?.(e.code, e.reason));
  ws.addEventListener('error', (e) => opts.onError?.(e));

  return {
    ws,
    init: (cfg: VpsConfig & { cols?: number; rows?: number; term?: string }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'init', data: { ...getVpsConfig(), ...cfg } }));
      } else {
        ws.addEventListener(
          'open',
          () => {
            ws.send(JSON.stringify({ type: 'init', data: { ...getVpsConfig(), ...cfg } }));
          },
          { once: true }
        );
      }
    },
    input: (data: string) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'input', data }));
    },
    resize: (cols: number, rows: number) => {
      if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ type: 'resize', data: { cols, rows } }));
    },
    close: () => {
      try {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'close' }));
        ws.close();
      } catch {}
    },
  };
}
