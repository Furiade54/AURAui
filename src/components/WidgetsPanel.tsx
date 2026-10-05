import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Cpu,
  HardDrive,
  Calendar as CalendarIcon,
  Clock,
  Activity,
  X,
  Sparkles,
  Server,
  RefreshCw,
  AlertCircle,
  Network,
} from 'lucide-react';
import { api, MetricsResponse } from '../lib/api';

function useMetrics(pollMs = 5000) {
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    try {
      setError(null);
      const d = await api.getMetrics();
      setData(d);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    const t = setInterval(load, pollMs);
    return () => clearInterval(t);
  }, [pollMs]);
  return { data, error, loading, reload: load };
}

interface WidgetsPanelProps {
  onClose: () => void;
}

export const WidgetsPanel: React.FC<WidgetsPanelProps> = ({ onClose }) => {
  const { data, error, loading, reload } = useMetrics(6000);
  const [stickyText, setStickyText] = useState(
    'Revisa primero "Ajustes → Conexión VPS", configura host/usuario/contraseña y pulsa "Probar conexión SSH".'
  );

  const today = new Date();
  const currentDay = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const firstWeekday = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
  const offset = (firstWeekday + 6) % 7;

  const cpuUsed = data?.cpu.used ?? 0;
  const ramPct = data?.memory.percent ?? 0;
  const load1 = data?.uptime.load_1m ?? 0;

  const totalDiskBytes = data?.disk.reduce((s, d) => s + d.total_bytes, 0) ?? 0;
  const usedDiskBytes = data?.disk.reduce((s, d) => s + d.used_bytes, 0) ?? 0;
  const diskPct = totalDiskBytes ? (usedDiskBytes / totalDiskBytes) * 100 : 0;

  return (
    <motion.div
      id="widgets-panel"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="fixed top-9 right-3 bottom-20 w-80 max-w-[calc(100vw-24px)] rounded-3xl p-4 bg-slate-950/60 backdrop-blur-3xl border border-white/15 shadow-2xl text-slate-100 z-[9400] flex flex-col gap-3.5 overflow-y-auto"
    >
      <div className="flex items-center justify-between pb-1 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-indigo-400" />
          <span className="font-semibold text-xs tracking-wider text-white">WIDGETS VPS</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={reload}
            className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300"
            title="Recargar"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Widget Host */}
      <div className="rounded-2xl p-3.5 bg-gradient-to-br from-indigo-900/40 to-sky-900/40 border border-white/10 shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold text-sky-200 flex items-center gap-1.5">
              <Server size={13} />
              {data?.hostname || 'VPS Ubuntu'}
            </div>
            <div className="text-[11px] text-slate-300 mt-0.5">{data?.uname?.release || 'Kernel --'}</div>
          </div>
          {error ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/30 text-rose-200 flex items-center gap-1">
              <AlertCircle size={10} /> Error
            </span>
          ) : data ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/25 text-emerald-200">
              ONLINE
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-500/30 text-slate-200">
              Conectando...
            </span>
          )}
        </div>
        <div className="mt-2 text-[11px] text-slate-300">
          Uptime: <span className="font-mono">{data?.uptime?.uptime || '--'}</span>
        </div>
        <div className="text-[11px] text-slate-300">
          Load:{' '}
          <span className="font-mono">
            {load1.toFixed(2)} · {data?.uptime.load_5m.toFixed(2) || 0} ·{' '}
            {data?.uptime.load_15m.toFixed(2) || 0}
          </span>
        </div>
      </div>

      {/* Widget metrics */}
      <div className="rounded-2xl p-3.5 bg-white/10 border border-white/10 shadow-lg flex flex-col gap-2.5">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
          <span className="flex items-center gap-1.5">
            <Activity size={14} className="text-emerald-400" /> Recursos del sistema
          </span>
          <span className="text-[10px] text-slate-400 bg-white/10 px-1.5 py-0.5 rounded-full font-mono">
            refresh 6s
          </span>
        </div>

        <MetricRow
          label="CPU"
          sub={`${data?.cpu.cores || 1} cores`}
          value={`${cpuUsed.toFixed(1)}%`}
          percent={cpuUsed}
          color="from-emerald-500 to-teal-400"
          Icon={Cpu}
        />
        <MetricRow
          label="Memoria RAM"
          sub={data ? `${data.memory.used_mb}/${data.memory.total_mb} MB` : '--'}
          value={`${ramPct.toFixed(1)}%`}
          percent={ramPct}
          color="from-sky-500 to-indigo-500"
          Icon={HardDrive}
        />
        <MetricRow
          label="Disco"
          sub={
            totalDiskBytes
              ? `${(usedDiskBytes / 1024 / 1024 / 1024).toFixed(1)} / ${(totalDiskBytes / 1024 / 1024 / 1024).toFixed(1)} GB`
              : '--'
          }
          value={`${diskPct.toFixed(0)}%`}
          percent={diskPct}
          color="from-amber-500 to-orange-500"
          Icon={HardDrive}
        />

        {data?.network && data.network.length > 0 && (
          <div className="pt-1 mt-1 border-t border-white/10">
            <div className="text-[10px] text-slate-400 mb-1 flex items-center gap-1.5">
              <Network size={11} /> Interfaces
            </div>
            <div className="flex flex-col gap-1">
              {data.network.slice(0, 3).map((i) => (
                <div key={i.name} className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-sky-300">{i.name}</span>
                  <span className="text-slate-300">
                    ↓ {(i.rx_bytes / 1024 / 1024).toFixed(1)} MB · ↑ {(i.tx_bytes / 1024 / 1024).toFixed(1)} MB
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Calendar */}
      <div className="rounded-2xl p-3 bg-white/10 border border-white/10 shadow-lg flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
          <span className="flex items-center gap-1.5 text-rose-400">
            <CalendarIcon size={13} />{' '}
            {today.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
          </span>
          <span className="text-[11px] text-slate-400 font-normal">
            Sem. {Math.ceil((currentDay + offset) / 7)}
          </span>
        </div>

        <div className="grid grid-cols-7 text-center text-[10px] text-slate-400 font-medium">
          <span>L</span>
          <span>M</span>
          <span>X</span>
          <span>J</span>
          <span>V</span>
          <span>S</span>
          <span>D</span>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-200 font-medium">
          {[...Array(offset)].map((_, i) => (
            <div key={'o' + i} />
          ))}
          {[...Array(daysInMonth)].map((_, i) => {
            const day = i + 1;
            const isCurrent = day === currentDay;
            return (
              <div
                key={day}
                className={`py-1 rounded-full text-[11px] transition-colors ${
                  isCurrent
                    ? 'bg-rose-500 text-white font-bold shadow-md shadow-rose-500/30'
                    : 'hover:bg-white/10'
                }`}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sticky note */}
      <div className="rounded-2xl p-3 bg-amber-500/20 border border-amber-400/30 text-amber-100 shadow-lg flex flex-col gap-1.5">
        <div className="text-[11px] font-semibold text-amber-300 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Clock size={12} /> Nota rápida
          </span>
          <span className="text-[9px] opacity-70">Auto-guardado</span>
        </div>
        <textarea
          value={stickyText}
          onChange={(e) => setStickyText(e.target.value)}
          className="w-full h-16 bg-transparent resize-none border-none outline-none text-xs text-amber-50 leading-relaxed placeholder-amber-200/50"
          placeholder="Escribe algo rápido..."
        />
      </div>
    </motion.div>
  );
};

const MetricRow: React.FC<{
  label: string;
  sub?: string;
  value: string;
  percent: number;
  color: string;
  Icon: any;
}> = ({ label, sub, value, percent, color, Icon }) => (
  <div className="flex flex-col gap-1">
    <div className="flex justify-between text-[10px] text-slate-300">
      <span className="flex items-center gap-1">
        <Icon size={11} /> {label}
        {sub && <span className="text-slate-400">· {sub}</span>}
      </span>
      <span className="font-mono">{value}</span>
    </div>
    <div className="h-2 w-full bg-white/15 rounded-full overflow-hidden">
      <div
        className={`h-full bg-gradient-to-r ${color} transition-all duration-700`}
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  </div>
);
