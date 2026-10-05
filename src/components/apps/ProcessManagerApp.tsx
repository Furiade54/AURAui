import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Search,
  RefreshCw,
  AlertCircle,
  OctagonX,
  Skull,
  CircleSlash,
} from 'lucide-react';
import { api, ProcessInfo } from '../../lib/api';

interface ActionButton {
  label: string;
  signal: number;
  icon: React.FC<any>;
  cls: string;
  confirm?: boolean;
}

const ACTIONS: ActionButton[] = [
  { label: 'SIGTERM (15)', signal: 15, icon: CircleSlash, cls: 'bg-amber-500/20 text-amber-200 hover:bg-amber-500/40', confirm: true },
  { label: 'SIGKILL (9)', signal: 9, icon: Skull, cls: 'bg-rose-500/20 text-rose-200 hover:bg-rose-500/40', confirm: true },
  { label: 'SIGSTOP (19)', signal: 19, icon: OctagonX, cls: 'bg-sky-500/20 text-sky-200 hover:bg-sky-500/40' },
];

export const ProcessManagerApp: React.FC = () => {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'cpu' | 'mem' | 'pid'>('cpu');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const load = async () => {
    try {
      setError(null);
      const r = await api.listProcesses(150);
      setProcesses(r.processes || []);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, []);

  const filtered = processes
    .filter(
      (p) =>
        !query ||
        p.command.toLowerCase().includes(query.toLowerCase()) ||
        p.user.toLowerCase().includes(query.toLowerCase()) ||
        String(p.pid).includes(query)
    )
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'pid') return (a.pid - b.pid) * dir;
      return (a[sortBy] - b[sortBy]) * dir;
    });

  const killProc = async (pid: number, signal: number, confirm = false) => {
    if (confirm) {
      const ok = window.confirm(`¿Enviar señal ${signal} al PID ${pid}?`);
      if (!ok) return;
    }
    try {
      const r = await api.killProcess(pid, signal);
      if (!r.ok) setError(`Error: ${r.output}`);
      await load();
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-slate-950/40 backdrop-blur-xl text-slate-100 overflow-hidden">
      <div className="flex items-center gap-3 p-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Cpu size={18} className="text-emerald-400" />
          <div className="text-sm font-semibold">Procesos</div>
          <div className="text-[11px] text-slate-400">
            {filtered.length} / {processes.length}
          </div>
        </div>
        <div className="flex-1 max-w-md ml-auto">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por PID / usuario / comando..."
              className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg bg-white/10 border border-white/10 focus:border-emerald-500/50 focus:outline-none placeholder:text-slate-500"
            />
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="mx-3 mt-3 rounded-xl p-3 bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <div className="break-all">{error}</div>
        </div>
      )}

      {selected !== null && (
        <div className="mx-3 mt-3 rounded-xl p-3 bg-slate-900/70 border border-emerald-500/20 text-xs flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-emerald-300 font-mono">PID {selected}</span>
            <span className="text-slate-400">
              {processes.find((p) => p.pid === selected)?.command}
            </span>
          </div>
          <div className="ml-auto flex gap-2">
            {ACTIONS.map((a) => (
              <button
                key={a.signal}
                onClick={() => killProc(selected, a.signal, !!a.confirm)}
                className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 text-[11px] ${a.cls}`}
              >
                <a.icon size={12} />
                {a.label}
              </button>
            ))}
            <button
              onClick={() => setSelected(null)}
              className="px-2.5 py-1 rounded-md bg-white/10 text-slate-200 hover:bg-white/20 text-[11px]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur">
            <tr className="text-[11px] text-slate-400 uppercase tracking-wide">
              <Th label="PID" sort="pid" sortBy={sortBy} sortDir={sortDir} onClick={() => toggleSort('pid')} />
              <Th label="User" />
              <Th label="CPU%" sort="cpu" sortBy={sortBy} sortDir={sortDir} onClick={() => toggleSort('cpu')} />
              <Th label="MEM%" sort="mem" sortBy={sortBy} sortDir={sortDir} onClick={() => toggleSort('mem')} />
              <th className="py-2 px-3 font-medium">VSZ KB</th>
              <th className="py-2 px-3 font-medium">RSS KB</th>
              <th className="py-2 px-3 font-medium">Stat</th>
              <th className="py-2 px-3 font-medium">Time</th>
              <th className="py-2 px-3 font-medium">Command</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="text-center py-10 text-slate-500 text-xs"
                >
                  {loading ? 'Cargando procesos...' : 'Sin resultados.'}
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const cpuClass = p.cpu > 80 ? 'text-rose-300' : p.cpu > 50 ? 'text-amber-300' : 'text-emerald-300';
              const memClass = p.mem > 70 ? 'text-rose-300' : p.mem > 40 ? 'text-amber-300' : 'text-sky-300';
              const isSel = selected === p.pid;
              return (
                <tr
                  key={p.pid}
                  onClick={() => setSelected(p.pid)}
                  className={`cursor-pointer border-b border-white/5 hover:bg-white/5 ${
                    isSel ? 'bg-emerald-500/10' : ''
                  }`}
                >
                  <td className="py-1.5 px-3 font-mono text-slate-200">{p.pid}</td>
                  <td className="py-1.5 px-3 font-mono text-slate-300">{p.user}</td>
                  <td className={`py-1.5 px-3 font-mono font-semibold ${cpuClass}`}>{p.cpu.toFixed(1)}</td>
                  <td className={`py-1.5 px-3 font-mono font-semibold ${memClass}`}>{p.mem.toFixed(1)}</td>
                  <td className="py-1.5 px-3 font-mono text-slate-400">{p.vsz_kb.toLocaleString()}</td>
                  <td className="py-1.5 px-3 font-mono text-slate-400">{p.rss_kb.toLocaleString()}</td>
                  <td className="py-1.5 px-3 font-mono text-slate-300">{p.stat}</td>
                  <td className="py-1.5 px-3 font-mono text-slate-300">{p.time}</td>
                  <td className="py-1.5 px-3 font-mono text-slate-200 truncate max-w-sm" title={p.command}>
                    {p.command}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  function toggleSort(key: 'cpu' | 'mem' | 'pid') {
    if (sortBy === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('desc');
    }
  }
};

const Th: React.FC<{
  label: string;
  sort?: 'cpu' | 'mem' | 'pid';
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onClick?: () => void;
}> = ({ label, sort, sortBy, sortDir, onClick }) => {
  const active = sort && sort === sortBy;
  return (
    <th
      onClick={onClick}
      className={`py-2 px-3 font-medium select-none ${onClick ? 'cursor-pointer hover:text-slate-200' : ''}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
      </span>
    </th>
  );
};
