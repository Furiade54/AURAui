import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  Cpu,
  HardDrive,
  Network,
  Server,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Server as ServerIcon,
  ThermometerSun,
} from 'lucide-react';
import {
  api,
  MetricsResponse,
  NetworkIface,
  DiskMount,
} from '../../lib/api';

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
}

const Sparkline: React.FC<SparklineProps> = ({ data, color = '#10b981', height = 40 }) => {
  const max = Math.max(1, ...data);
  const min = Math.min(0, ...data);
  const range = max - min || 1;
  const w = 200;
  const points = data
    .map((v, i) => {
      const x = (i / Math.max(1, data.length - 1)) * w;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');
  const area = `0,${height} ${points} ${w},${height}`;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`g-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#g-${color})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.6" />
    </svg>
  );
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function useRefreshLoop<T>(fn: () => Promise<T>, intervalMs = 5000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setError(null);
      const d = await fn();
      setData(d);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);

  return { data, error, loading, reload: load };
}

const NetSpeedRow: React.FC<{ iface: NetworkIface; prev?: NetworkIface; seconds: number }> = ({
  iface,
  prev,
  seconds,
}) => {
  const rxSpeed = prev ? Math.max(0, (iface.rx_bytes - prev.rx_bytes) / seconds) : 0;
  const txSpeed = prev ? prev : 0;
  return (
    <div className="flex items-center justify-between text-xs text-slate-200 py-1 border-b border-white/5 last:border-0">
      <span className="font-mono text-sky-300 w-20">{iface.name}</span>
      <span className="text-emerald-300 font-mono">↓ {formatBytes(rxSpeed)}/s</span>
      <span className="text-amber-300 font-mono">↑ {formatBytes(txSpeed)}/s</span>
    </div>
  );
};

export const MonitorDashboardApp: React.FC = () => {
  const { data, error, loading, reload } = useRefreshLoop(() => api.getMetrics(), 5000);
  const [cpuHist, setCpuHist] = useState<number[]>([]);
  const [ramHist, setRamHist] = useState<number[]>([]);
  const [prevNet, setPrevNet] = useState<Record<string, NetworkIface>>({});

  useEffect(() => {
    if (!data) return;
    setCpuHist((prev) => [...prev.slice(-39), data.cpu.used]);
    setRamHist((prev) => [...prev.slice(-39), data.memory.percent]);

    const nowMap: Record<string, NetworkIface> = {};
    for (const iface of data.network) nowMap[iface.name] = iface;
    setPrevNet(nowMap);
  }, [data]);

  const totalDisk = useMemo(() => {
    if (!data) return { total: 0, used: 0 };
    let total = 0;
    let used = 0;
    for (const d of data.disk) {
      total += d.total_bytes;
      used += d.used_bytes;
    }
    return { total, used };
  }, [data]);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950/40 backdrop-blur-xl p-4 text-slate-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-emerald-400" />
          <div>
            <div className="text-sm font-semibold">Monitor del Sistema</div>
            <div className="text-[11px] text-slate-400">
              Actualización cada 5s ·{' '}
              {data ? new Date(data.timestamp).toLocaleTimeString() : '--:--:--'}
            </div>
          </div>
        </div>
        <button
          onClick={reload}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Recargar
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl p-3 bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Error al obtener métricas:</div>
            <div className="opacity-90 break-all">{error}</div>
          </div>
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
            {/* Host info */}
            <div className="rounded-2xl p-3.5 bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-white/10 shadow-lg">
              <div className="flex items-center gap-1.5 text-xs text-sky-300 font-semibold mb-1.5">
                <ServerIcon size={13} /> Host
              </div>
              <div className="text-base font-bold truncate">{data.hostname || '---'}</div>
              <div className="text-[11px] text-slate-400 truncate mt-1">{data.uname?.full || '---'}</div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-300">
                <CheckCircle2 size={11} /> Conectado
              </div>
            </div>

            {/* Uptime */}
            <div className="rounded-2xl p-3.5 bg-gradient-to-br from-indigo-900/60 to-violet-900/60 border border-white/10 shadow-lg">
              <div className="flex items-center gap-1.5 text-xs text-violet-300 font-semibold mb-1.5">
                <Clock size={13} /> Uptime
              </div>
              <div className="text-base font-bold truncate">{data.uptime?.uptime || '---'}</div>
              <div className="text-[11px] text-slate-400 mt-1">
                Load: {data.uptime?.load_1m?.toFixed(2)} / {data.uptime?.load_5m?.toFixed(2)} /{' '}
                {data.uptime?.load_15m?.toFixed(2)}
              </div>
            </div>

            {/* CPU */}
            <div className="rounded-2xl p-3.5 bg-gradient-to-br from-emerald-900/50 to-teal-900/50 border border-white/10 shadow-lg">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-semibold">
                  <Cpu size={13} /> CPU ({data.cpu.cores || 1}c)
                </div>
                <span className="text-xs font-mono text-emerald-200">{data.cpu.used.toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700"
                  style={{ width: `${Math.min(100, data.cpu.used)}%` }}
                />
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                user {data.cpu.user}% · sys {data.cpu.system}% · idle {data.cpu.idle}%
              </div>
              <div className="mt-2 -mx-1">
                <Sparkline data={cpuHist} color="#34d399" height={34} />
              </div>
            </div>

            {/* RAM */}
            <div className="rounded-2xl p-3.5 bg-gradient-to-br from-sky-900/50 to-blue-900/50 border border-white/10 shadow-lg">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 text-xs text-sky-300 font-semibold">
                  <HardDrive size={13} /> Memoria
                </div>
                <span className="text-xs font-mono text-sky-200">
                  {data.memory.used_mb}/{data.memory.total_mb} MB
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-blue-500 transition-all duration-700"
                  style={{ width: `${Math.min(100, data.memory.percent)}%` }}
                />
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                buffers {(data.memory.buffers_kb / 1024).toFixed(0)}MB · cached{' '}
                {(data.memory.cached_kb / 1024).toFixed(0)}MB
              </div>
              <div className="mt-2 -mx-1">
                <Sparkline data={ramHist} color="#38bdf8" height={34} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
            {/* Disk */}
            <div className="rounded-2xl p-3.5 bg-white/5 border border-white/10 shadow-lg">
              <div className="flex items-center gap-1.5 text-xs text-amber-300 font-semibold mb-2.5">
                <Server size={13} />
                <span>Almacenamiento</span>
                <span className="ml-auto text-slate-300">
                  {formatBytes(totalDisk.used)} / {formatBytes(totalDisk.total)}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {data.disk.length === 0 && (
                  <div className="text-[11px] text-slate-400">Sin volúmenes detectados.</div>
                )}
                {data.disk.map((d: DiskMount) => {
                  const usePct = Math.min(100, d.use_percent || 0);
                  const color =
                    usePct > 90
                      ? 'from-rose-500 to-red-500'
                      : usePct > 75
                      ? 'from-amber-500 to-orange-500'
                      : 'from-emerald-500 to-teal-400';
                  return (
                    <div key={d.filesystem + d.mount_point}>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-mono text-slate-200 truncate">
                          {d.mount_point} <span className="text-slate-500">({d.filesystem})</span>
                        </span>
                        <span className="font-mono text-slate-300">{usePct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${color}`}
                          style={{ width: `${usePct}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {formatBytes(d.used_bytes)} usado · {formatBytes(d.available_bytes)} libre
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Network */}
            <div className="rounded-2xl p-3.5 bg-white/5 border border-white/10 shadow-lg">
              <div className="flex items-center gap-1.5 text-xs text-cyan-300 font-semibold mb-2">
                <Network size={13} />
                <span>Interfaces de Red</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center justify-between text-[10px] text-slate-400 pb-1 border-b border-white/10 mb-1">
                  <span className="w-20">Interfaz</span>
                  <span>Descarga</span>
                  <span>Subida</span>
                </div>
                {data.network.length === 0 && (
                  <div className="text-[11px] text-slate-400">Sin interfaces detectadas.</div>
                )}
                {data.network.map((iface) => (
                  <NetSpeedRow
                    key={iface.name}
                    iface={iface}
                    prev={prevNet[iface.name]}
                    seconds={5}
                  />
                ))}
                <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-400 pt-1 border-t border-white/10">
                  {data.network.map((iface) => (
                    <div key={iface.name} className="flex items-center gap-1.5">
                      <span className="font-mono text-sky-300">{iface.name}</span>
                      <span>
                        RX {formatBytes(iface.rx_bytes)} · TX {formatBytes(iface.tx_bytes)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl p-3.5 bg-white/5 border border-white/10 shadow-lg">
            <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold mb-2">
              <ThermometerSun size={13} />
              <span>Resumen del sistema</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <Info label="Kernel" value={data.uname?.release || '---'} />
              <Info label="Arquitectura" value={data.uname?.arch || '---'} />
              <Info
                label="Load 1m / 5m / 15m"
                value={`${data.uptime?.load_1m?.toFixed(2) || 0} / ${data.uptime?.load_5m?.toFixed(2) || 0} / ${
                  data.uptime?.load_15m?.toFixed(2) || 0
                }`}
              />
              <Info
                label="Tiempo activo"
                value={data.uptime?.uptime || '---'}
              />
            </div>
          </div>
        </>
      )}

      {!data && !error && loading && (
        <div className="text-center text-slate-400 text-xs py-10">Cargando métricas...</div>
      )}
    </div>
  );
};

const Info: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl p-2.5 bg-slate-900/40 border border-white/5">
    <div className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</div>
    <div className="text-xs font-mono text-slate-100 mt-1 truncate">{value}</div>
  </div>
);
