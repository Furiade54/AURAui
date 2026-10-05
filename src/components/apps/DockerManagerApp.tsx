import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Container,
  Box,
  Database,
  Play,
  Square,
  RotateCcw,
  FileText,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  Filter,
  ExternalLink,
  Globe,
  Download,
  Upload,
  HardDrive,
  Activity,
  Cpu,
  MemoryStick,
} from 'lucide-react';
import {
  api,
  DockerContainer,
  DockerImage,
  DockerVolume,
  DockerStats,
} from '../../lib/api';

type Tab = 'ps' | 'images' | 'volumes';

export const DockerManagerApp: React.FC = () => {
  const [tab, setTab] = useState<Tab>('ps');
  const [showAll, setShowAll] = useState(true);
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [stats, setStats] = useState<Record<string, DockerStats>>({});
  const [statsAt, setStatsAt] = useState<number | null>(null);
  const [images, setImages] = useState<DockerImage[]>([]);
  const [volumes, setVolumes] = useState<DockerVolume[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logsId, setLogsId] = useState<DockerContainer | null>(null);
  const [logsContent, setLogsContent] = useState('');
  const [logsLoading, setLogsLoading] = useState(false);
  const statsTimer = useRef<number | null>(null);

  const loadAll = async () => {
    try {
      setError(null);
      const [ps, img, vol] = await Promise.all([
        api.dockerPs(showAll),
        api.dockerImages(),
        api.dockerVolumes(),
      ]);
      setContainers(ps.containers || []);
      setImages(img.images || []);
      setVolumes(vol.volumes || []);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const r = await api.dockerStats();
      const map: Record<string, DockerStats> = {};
      for (const s of r.stats || []) {
        map[s.id] = s;
        if (s.name) map[s.name] = s;
      }
      setStats(map);
      setStatsAt(Date.now());
    } catch {
      // silencioso: no tapar otros errores de la UI
    }
  };

  const findStats = (c: DockerContainer): DockerStats | undefined => {
    if (stats[c.id]) return stats[c.id];
    if (c.names && stats[c.names]) return stats[c.names];
    const cidPrefix = c.id?.slice(0, 12);
    if (cidPrefix && stats[cidPrefix]) return stats[cidPrefix];
    return undefined;
  };

  useEffect(() => {
    loadAll();
    const psTimer = window.setInterval(() => {
      if (tab === 'ps') api.dockerPs(showAll).then((r) => setContainers(r.containers || []));
    }, 8000);
    loadStats();
    statsTimer.current = window.setInterval(() => {
      if (tab === 'ps') loadStats();
    }, 3000);
    return () => {
      clearInterval(psTimer);
      if (statsTimer.current) clearInterval(statsTimer.current);
    };
  }, [showAll, tab]);

  const showLogs = async (c: DockerContainer) => {
    setLogsId(c);
    setLogsLoading(true);
    try {
      const r = await api.dockerLogs(c.id, 150);
      setLogsContent(r.logs || '(sin logs)');
    } catch (e: any) {
      setLogsContent(`ERROR: ${e?.message || String(e)}`);
    } finally {
      setLogsLoading(false);
    }
  };

  const runAction = async (
    fn: (id: string) => Promise<{ ok: boolean; output: string }>,
    c: DockerContainer
  ) => {
    try {
      const r = await fn(c.id);
      if (!r.ok) setError(r.output || 'Acción fallida');
      await loadAll();
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-slate-950/40 backdrop-blur-xl text-slate-100 overflow-hidden">
      <div className="flex items-center gap-3 p-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Container size={18} className="text-sky-400" />
          <div className="text-sm font-semibold">Gestor Docker</div>
        </div>
        <div className="ml-3 flex gap-1 rounded-xl bg-white/5 border border-white/10 p-1 text-xs">
          <TabBtn active={tab === 'ps'} onClick={() => setTab('ps')} label="Contenedores" Icon={Container} badge={containers.filter((c) => c.status.toLowerCase().includes('up')).length} />
          <TabBtn active={tab === 'images'} onClick={() => setTab('images')} label="Imágenes" Icon={Box} badge={images.length} />
          <TabBtn active={tab === 'volumes'} onClick={() => setTab('volumes')} label="Volúmenes" Icon={Database} badge={volumes.length} />
        </div>
        {tab === 'ps' && (
          <label className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-300 bg-white/5 border border-white/10 rounded-lg px-2 py-1 cursor-pointer">
            <Filter size={12} />
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="accent-sky-500"
            />
            Mostrar todos
          </label>
        )}
        <button
          onClick={loadAll}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Recargar
        </button>
      </div>

      {error && (
        <div className="mx-3 mt-3 rounded-xl p-3 bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <div className="break-all">{error}</div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-3 flex flex-col gap-3">
        {loading && <div className="text-center text-slate-400 text-xs py-10">Cargando...</div>}

        {tab === 'ps' && (
          <div className="flex flex-col gap-2">
            {containers.length === 0 && !loading && (
              <Empty label="No hay contenedores." />
            )}
            {containers.map((c) => (
              <ContainerCard
                key={c.id}
                c={c}
                stats={findStats(c)}
                statsReady={statsAt !== null}
                onStart={() => runAction(api.dockerStart, c)}
                onStop={() => runAction(api.dockerStop, c)}
                onRestart={() => runAction(api.dockerRestart, c)}
                onLogs={() => showLogs(c)}
              />
            ))}
          </div>
        )}

        {tab === 'images' && (
          <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900/50 text-[11px] text-slate-400 uppercase tracking-wide">
                <tr>
                  <th className="py-2 px-3 font-medium">Repositorio</th>
                  <th className="py-2 px-3 font-medium">Tag</th>
                  <th className="py-2 px-3 font-medium">Image ID</th>
                  <th className="py-2 px-3 font-medium">Creado</th>
                  <th className="py-2 px-3 font-medium">Tamaño</th>
                </tr>
              </thead>
              <tbody>
                {images.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-500 text-xs">
                      Sin imágenes.
                    </td>
                  </tr>
                )}
                {images.map((i) => (
                  <tr key={i.image_id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-2 px-3 font-mono text-slate-200">{i.repository}</td>
                    <td className="py-2 px-3 font-mono text-sky-300">{i.tag}</td>
                    <td className="py-2 px-3 font-mono text-slate-400">{i.image_id}</td>
                    <td className="py-2 px-3 text-slate-400">{i.created}</td>
                    <td className="py-2 px-3 text-slate-300">{i.size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'volumes' && (
          <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900/50 text-[11px] text-slate-400 uppercase tracking-wide">
                <tr>
                  <th className="py-2 px-3 font-medium">Nombre</th>
                  <th className="py-2 px-3 font-medium">Driver</th>
                  <th className="py-2 px-3 font-medium">Scope</th>
                </tr>
              </thead>
              <tbody>
                {volumes.length === 0 && !loading && (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-slate-500 text-xs">
                      Sin volúmenes.
                    </td>
                  </tr>
                )}
                {volumes.map((v) => (
                  <tr key={v.name} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-2 px-3 font-mono text-slate-200">{v.name}</td>
                    <td className="py-2 px-3 font-mono text-amber-300">{v.driver}</td>
                    <td className="py-2 px-3 text-slate-400">{v.scope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {logsId && (
        <div className="absolute inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[85vh] rounded-2xl bg-slate-900 border border-white/15 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 p-3 border-b border-white/10">
              <FileText size={16} className="text-amber-300" />
              <div>
                <div className="text-sm font-semibold">
                  Logs · <span className="font-mono text-emerald-300">{logsId.names || logsId.id}</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  {logsId.image} · {logsId.status}
                </div>
              </div>
              <button
                onClick={() => setLogsId(null)}
                className="ml-auto w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-3 bg-black/60 font-mono text-[11px] leading-relaxed text-slate-200 whitespace-pre-wrap break-all">
              {logsLoading && <div className="text-slate-400">Cargando logs...</div>}
              {!logsLoading && logsContent}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const TabBtn: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
  Icon: any;
  badge?: number;
}> = ({ active, onClick, label, Icon, badge }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
      active ? 'bg-sky-500/20 text-sky-200 shadow-inner shadow-sky-500/10' : 'text-slate-300 hover:text-white'
    }`}
  >
    <Icon size={13} />
    <span>{label}</span>
    {badge !== undefined && (
      <span
        className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
          active ? 'bg-sky-500/30 text-sky-100' : 'bg-white/10 text-slate-300'
        }`}
      >
        {badge}
      </span>
    )}
  </button>
);

const PRIMARY_PORTS = [
  80, 443, 8080, 8085, 8081, 8082, 3000, 3001, 5173, 4173, 8000, 8008,
  9000, 9090, 5000, 5050, 8888, 8443, 8001, 3030, 5432, 3306, 1433, 50271,
  81, 8090, 80-81,
];

const HTTPS_PORTS = new Set([443, 8443, 4443, 9443]);

function buildUrl(vpsHost: string | null | undefined, hostPort: number) {
  if (!vpsHost) return null;
  const scheme = HTTPS_PORTS.has(hostPort) ? 'https' : 'http';
  const portPart =
    (scheme === 'http' && hostPort === 80) || (scheme === 'https' && hostPort === 443) ? '' : `:${hostPort}`;
  return `${scheme}://${vpsHost}${portPart}`;
}

function pickPrimaryPort(c: DockerContainer) {
  if (!c.published_ports?.length) return null;
  for (const p of PRIMARY_PORTS) {
    const found = c.published_ports.find((x) => x.host_port === p && x.proto === 'tcp');
    if (found) return found;
  }
  const tcp = c.published_ports.find((x) => x.proto === 'tcp');
  return tcp ?? c.published_ports[0];
}

function fmtBytes(b: number): string {
  if (!Number.isFinite(b) || b <= 0) return '0 B';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let i = 0;
  let n = b;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

const RACK_SEGMENTS = 8;
const RACK_COLORS = ['emerald', 'sky', 'amber', 'rose'] as const;
type RackColor = (typeof RACK_COLORS)[number];
function isRackColor(x: string): x is RackColor {
  return RACK_COLORS.includes(x as RackColor);
}
const RackMeter: React.FC<{
  label: string;
  pct: number;
  ready: boolean;
  Icon?: any;
  color?: RackColor;
  title?: string;
}> = ({ label, pct, ready, Icon, color = 'emerald', title }) => {
  const safePct = !ready || !Number.isFinite(pct) ? -1 : Math.max(0, Math.min(100, pct));
  const lit = safePct < 0 ? 0 : Math.max(0, Math.round((safePct / 100) * RACK_SEGMENTS));
  const colorMap: Record<RackColor, { bg: string; glow: string }> = {
    emerald: { bg: 'bg-emerald-400', glow: 'shadow-[0_0_6px_rgba(16,185,129,0.8)]' },
    sky: { bg: 'bg-sky-400', glow: 'shadow-[0_0_6px_rgba(56,189,248,0.8)]' },
    amber: { bg: 'bg-amber-400', glow: 'shadow-[0_0_6px_rgba(251,191,36,0.8)]' },
    rose: { bg: 'bg-rose-500', glow: 'shadow-[0_0_6px_rgba(244,63,94,0.8)]' },
  };
  const segColors = (i: number) => {
    if (!ready) return 'bg-white/10 animate-pulse';
    if (safePct < 0) return 'bg-white/5';
    const bottomIdx = RACK_SEGMENTS - i; // segment 1 = top, 8 = bottom
    const isLit = bottomIdx <= lit;
    if (!isLit) return 'bg-white/5';
    const zone = bottomIdx / RACK_SEGMENTS;
    let c: RackColor = isRackColor(color) ? color : 'emerald';
    if (zone > 0.85) c = 'rose';
    else if (zone > 0.65) c = 'amber';
    else if (c !== 'sky' && color === 'sky') c = 'sky';
    const { bg, glow } = colorMap[c];
    return `${bg} ${glow}`;
  };
  const pctText = !ready ? '—' : safePct < 0 ? '—' : `${safePct.toFixed(safePct >= 10 ? 0 : 1)}%`;
  return (
    <div className="flex flex-col items-center gap-1 select-none" title={title}>
      <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-300">
        {Icon && <Icon size={9} />}
        <span>{label}</span>
      </div>
      <div
        className="w-5 rounded-md bg-slate-900/80 border border-white/10 p-[2px] shadow-inner"
        style={{ height: 56 }}
      >
        <div className="w-full h-full flex flex-col justify-between gap-[2px]">
          {Array.from({ length: RACK_SEGMENTS }).map((_, i) => (
            <div
              key={i}
              className={`w-full rounded-[1px] transition-all duration-300 ${segColors(i)}`}
              style={{ height: '11%' }}
            />
          ))}
        </div>
      </div>
      <div className={`text-[9px] font-mono ${ready ? 'text-slate-200' : 'text-slate-500'}`}>{pctText}</div>
    </div>
  );
};

const MetricChip: React.FC<{
  label: string;
  value: string;
  Icon: any;
  tone?: 'emerald' | 'sky' | 'amber' | 'violet' | 'slate';
  ready: boolean;
  title?: string;
}> = ({ label, value, Icon, tone = 'slate', ready, title }) => {
  const tones: Record<string, string> = {
    emerald: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200',
    sky: 'bg-sky-500/10 border-sky-500/25 text-sky-200',
    amber: 'bg-amber-500/10 border-amber-500/25 text-amber-200',
    violet: 'bg-violet-500/10 border-violet-500/25 text-violet-200',
    slate: 'bg-white/5 border-white/10 text-slate-300',
  };
  return (
    <div
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] ${ready ? tones[tone] : 'bg-white/5 border-white/10 text-slate-500'} transition-colors`}
      title={title}
    >
      <Icon size={10} className={ready ? '' : 'opacity-60'} />
      <span className="font-semibold opacity-80">{label}</span>
      <span className="font-mono">{ready ? value : '…'}</span>
    </div>
  );
};

const ContainerCard: React.FC<{
  c: DockerContainer;
  stats?: DockerStats;
  statsReady: boolean;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onLogs: () => void;
}> = ({ c, stats, statsReady, onStart, onStop, onRestart, onLogs }) => {
  const isUp = c.status.toLowerCase().includes('up');
  const tcpPorts = useMemo(
    () => (c.published_ports || []).filter((p) => p.proto === 'tcp'),
    [c.published_ports]
  );
  const primary = pickPrimaryPort(c);
  const primaryUrl = primary ? buildUrl(c.vps_host, primary.host_port) : null;
  const cpuPct = isUp ? (stats?.cpu_pct ?? NaN) : NaN;
  const memPct = isUp ? (stats?.mem_pct ?? NaN) : NaN;

  return (
    <div className="rounded-2xl p-3 bg-white/5 border border-white/10 hover:border-white/20 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div
          className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
            isUp
              ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
              : 'bg-slate-700/60 border border-white/10 text-slate-400'
          }`}
        >
          {isUp ? <CheckCircle2 size={18} /> : <Square size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-sm font-semibold truncate">{c.names || c.id}</div>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                isUp
                  ? 'bg-emerald-500/20 text-emerald-200'
                  : 'bg-slate-500/30 text-slate-300'
              }`}
            >
              {c.status}
            </span>
            {primaryUrl && isUp && (
              <a
                href={primaryUrl}
                target="_blank"
                rel="noreferrer noopener"
                title={`Abrir ${primaryUrl}`}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-200 border border-sky-500/30 hover:bg-sky-500/35 font-semibold"
              >
                <Globe size={11} />
                Abrir web
                <ExternalLink size={10} className="opacity-70" />
              </a>
            )}
          </div>
          <div className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
            {c.image} · {c.command}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-1.5">
            <span>Creado: {c.created}</span>
            {(tcpPorts.length > 0 || c.ports) && <span className="ml-1">· Puertos:</span>}
            {tcpPorts.length === 0 && c.ports && (
              <span className="font-mono text-[10px]">{c.ports}</span>
            )}
            {tcpPorts.map((p) => {
              const url = buildUrl(c.vps_host, p.host_port);
              if (!url) {
                return (
                  <span
                    key={`${p.host_port}-${p.container_port}`}
                    className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 font-mono text-[10px] text-slate-300"
                  >
                    {p.host_port}→{p.container_port}
                  </span>
                );
              }
              return (
                <a
                  key={`${p.host_port}-${p.container_port}`}
                  href={url}
                  target="_blank"
                  rel="noreferrer noopener"
                  title={url}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-500/10 hover:bg-sky-500/25 border border-sky-500/20 font-mono text-[10px] text-sky-200"
                >
                  <span className="opacity-60">:</span>
                  {p.host_port}
                  <ExternalLink size={9} className="opacity-60" />
                </a>
              );
            })}
          </div>

          {isUp && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <MetricChip
                label="NET ↓"
                value={fmtBytes(stats?.net_rx_bytes ?? 0)}
                Icon={Download}
                tone="sky"
                ready={statsReady}
                title="Tráfico de red RX (descarga hacia el contenedor) desde arranque"
              />
              <MetricChip
                label="NET ↑"
                value={fmtBytes(stats?.net_tx_bytes ?? 0)}
                Icon={Upload}
                tone="violet"
                ready={statsReady}
                title="Tráfico de red TX (subida desde el contenedor) desde arranque"
              />
              <MetricChip
                label="I/O R"
                value={fmtBytes(stats?.block_read_bytes ?? 0)}
                Icon={HardDrive}
                tone="amber"
                ready={statsReady}
                title="Bloques leídos desde disco"
              />
              <MetricChip
                label="I/O W"
                value={fmtBytes(stats?.block_write_bytes ?? 0)}
                Icon={HardDrive}
                tone="emerald"
                ready={statsReady}
                title="Bloques escritos a disco"
              />
              {statsReady && stats?.pids != null && (
                <MetricChip
                  label="PID"
                  value={String(stats.pids)}
                  Icon={Activity}
                  tone="slate"
                  ready
                  title="Número de procesos dentro del contenedor"
                />
              )}
              {statsReady && stats?.mem_limit_bytes && stats.mem_used_bytes > 0 && (
                <MetricChip
                  label="RAM"
                  value={`${fmtBytes(stats.mem_used_bytes)} / ${fmtBytes(stats.mem_limit_bytes)}`}
                  Icon={MemoryStick}
                  tone="slate"
                  ready
                  title="Memoria usada / límite reportado por cgroup"
                />
              )}
            </div>
          )}
        </div>

        {isUp ? (
          <div
            className="flex shrink-0 items-start gap-2 px-2 py-1 rounded-xl bg-slate-900/60 border border-white/10"
            title="Métricas en tiempo real (refresco cada 3s)"
          >
            <RackMeter
              label="CPU"
              pct={cpuPct}
              ready={statsReady}
              Icon={Cpu}
              color="emerald"
              title={statsReady && stats ? `CPU: ${stats.cpu_pct.toFixed(1)}%` : 'Cargando métricas CPU…'}
            />
            <div className="w-px bg-white/10 my-1 self-stretch" aria-hidden />
            <RackMeter
              label="RAM"
              pct={memPct}
              ready={statsReady}
              Icon={MemoryStick}
              color="sky"
              title={statsReady && stats ? `RAM: ${stats.mem_pct.toFixed(1)}% (${fmtBytes(stats.mem_used_bytes)} / ${fmtBytes(stats.mem_limit_bytes)})` : 'Cargando métricas memoria…'}
            />
          </div>
        ) : (
          <div className="shrink-0 px-3 py-2 rounded-xl bg-slate-900/60 border border-white/10 text-[10px] text-slate-500 uppercase tracking-wider flex items-center">
            Offline
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <BtnGroup>
            {!isUp && (
              <ActionBtn onClick={onStart} label="Start" Icon={Play} cls="bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/40" />
            )}
            {isUp && (
              <ActionBtn onClick={onStop} label="Stop" Icon={Square} cls="bg-rose-500/20 text-rose-200 hover:bg-rose-500/40" />
            )}
            <ActionBtn onClick={onRestart} label="Restart" Icon={RotateCcw} cls="bg-amber-500/20 text-amber-200 hover:bg-amber-500/40" />
            <ActionBtn onClick={onLogs} label="Logs" Icon={FileText} cls="bg-sky-500/20 text-sky-200 hover:bg-sky-500/40" />
          </BtnGroup>
        </div>
      </div>
    </div>
  );
};

const BtnGroup: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-wrap gap-1.5 justify-end">{children}</div>
);

const ActionBtn: React.FC<{
  onClick: () => void;
  label: string;
  Icon: any;
  cls: string;
}> = ({ onClick, label, Icon, cls }) => (
  <button
    onClick={onClick}
    className={`px-2 py-1 rounded-md flex items-center gap-1 text-[11px] ${cls}`}
  >
    <Icon size={12} />
    {label}
  </button>
);

const Empty: React.FC<{ label: string }> = ({ label }) => (
  <div className="text-center text-slate-500 text-xs py-10 bg-white/5 rounded-2xl border border-dashed border-white/10">
    {label}
  </div>
);
