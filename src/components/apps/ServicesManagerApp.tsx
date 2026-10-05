import React, { useState, useEffect } from 'react';
import {
  Server,
  Play,
  Square,
  RotateCcw,
  Power,
  PowerOff,
  FileText,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  Search,
  Filter,
} from 'lucide-react';
import { api, SystemService, ServiceFile } from '../../lib/api';

type Filter = 'running' | 'exited' | 'failed' | 'all';

export const ServicesManagerApp: React.FC = () => {
  const [services, setServices] = useState<SystemService[]>([]);
  const [allFiles, setAllFiles] = useState<ServiceFile[]>([]);
  const [filter, setFilter] = useState<Filter>('running');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'units' | 'files'>('units');
  const [statusUnit, setStatusUnit] = useState<null | { name: string; content: string }>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const stateParam = filter === 'all' ? '' : filter;

  const load = async () => {
    try {
      setError(null);
      const r = await api.listServices(stateParam || 'running');
      setServices(r.services || []);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadFiles = async () => {
    try {
      setError(null);
      const r = await api.listAllServices();
      setAllFiles(r.files || []);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'units') load();
    else loadFiles();
    const t = setInterval(() => {
      if (view === 'units') load();
    }, 8000);
    return () => clearInterval(t);
  }, [filter, view]);

  const filteredUnits = services.filter(
    (s) =>
      !query ||
      s.unit.toLowerCase().includes(query.toLowerCase()) ||
      s.description.toLowerCase().includes(query.toLowerCase())
  );

  const filteredFiles = allFiles.filter(
    (s) =>
      !query ||
      s.unit_file.toLowerCase().includes(query.toLowerCase()) ||
      s.state.toLowerCase().includes(query.toLowerCase())
  );

  const runAction = async (
    fn: (name: string) => Promise<{ ok: boolean; output: string }>,
    name: string
  ) => {
    try {
      const r = await fn(name);
      if (!r.ok) setError(r.output || 'Acción fallida');
      await Promise.all([load(), loadFiles()]);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  const showStatus = async (name: string) => {
    setStatusUnit({ name, content: '' });
    setStatusLoading(true);
    try {
      const r = await api.serviceStatus(name);
      setStatusUnit({ name, content: r.output });
    } catch (e: any) {
      setStatusUnit({ name, content: `ERROR: ${e?.message || String(e)}` });
    } finally {
      setStatusLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-slate-950/40 backdrop-blur-xl text-slate-100 overflow-hidden">
      <div className="flex items-center gap-3 p-3 border-b border-white/10 flex-wrap">
        <div className="flex items-center gap-2">
          <Server size={18} className="text-indigo-400" />
          <div className="text-sm font-semibold">Servicios systemd</div>
        </div>
        <div className="ml-2 flex gap-1 rounded-xl bg-white/5 border border-white/10 p-1 text-xs">
          <SmallBtn active={view === 'units'} onClick={() => setView('units')} label="Unidades activas" />
          <SmallBtn active={view === 'files'} onClick={() => setView('files')} label="Unit files" />
        </div>

        {view === 'units' && (
          <div className="flex items-center gap-1 rounded-xl bg-white/5 border border-white/10 p-1 text-xs">
            {(['running', 'exited', 'failed', 'all'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-md capitalize transition-colors ${
                  filter === f ? 'bg-indigo-500/25 text-indigo-100' : 'text-slate-300 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 max-w-sm ml-auto relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={view === 'units' ? 'Buscar servicio...' : 'Buscar unit file...'}
            className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg bg-white/10 border border-white/10 focus:border-indigo-500/50 focus:outline-none placeholder:text-slate-500"
          />
        </div>

        <button
          onClick={view === 'units' ? load : loadFiles}
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

      <div className="flex-1 overflow-auto p-3">
        {view === 'units' ? (
          <UnitsList
            units={filteredUnits}
            onStart={(name) => runAction(api.serviceStart, name)}
            onStop={(name) => runAction(api.serviceStop, name)}
            onRestart={(name) => runAction(api.serviceRestart, name)}
            onStatus={showStatus}
            loading={loading}
          />
        ) : (
          <FilesList
            files={filteredFiles}
            onEnable={(name) => runAction(api.serviceEnable, name)}
            onDisable={(name) => runAction(api.serviceDisable, name)}
            onStart={(name) => runAction(api.serviceStart, name)}
            onStop={(name) => runAction(api.serviceStop, name)}
            onStatus={showStatus}
            loading={loading}
          />
        )}
      </div>

      {statusUnit && (
        <div className="absolute inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[85vh] rounded-2xl bg-slate-900 border border-white/15 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 p-3 border-b border-white/10">
              <FileText size={16} className="text-indigo-300" />
              <div>
                <div className="text-sm font-semibold">
                  Estado · <span className="font-mono text-emerald-300">{statusUnit.name}</span>
                </div>
              </div>
              <button
                onClick={() => setStatusUnit(null)}
                className="ml-auto w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-3 bg-black/60 font-mono text-[11px] leading-relaxed text-slate-200 whitespace-pre-wrap break-all">
              {statusLoading && <div className="text-slate-400">Cargando estado...</div>}
              {!statusLoading && (statusUnit.content || '(sin salida)')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SmallBtn: React.FC<{ active: boolean; onClick: () => void; label: string }> = ({
  active,
  onClick,
  label,
}) => (
  <button
    onClick={onClick}
    className={`px-2.5 py-1 rounded-md transition-colors ${
      active ? 'bg-sky-500/20 text-sky-200' : 'text-slate-300 hover:text-white'
    }`}
  >
    {label}
  </button>
);

const UnitsList: React.FC<{
  units: SystemService[];
  onStart: (name: string) => void;
  onStop: (name: string) => void;
  onRestart: (name: string) => void;
  onStatus: (name: string) => void;
  loading: boolean;
}> = ({ units, onStart, onStop, onRestart, onStatus, loading }) => {
  if (units.length === 0) {
    return (
      <div className="text-center text-slate-500 text-xs py-10 bg-white/5 rounded-2xl border border-dashed border-white/10">
        {loading ? 'Cargando servicios...' : 'Sin servicios.'}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {units.map((s) => {
        const isActive = s.active === 'active';
        return (
          <div key={s.unit} className="rounded-2xl p-3 bg-white/5 border border-white/10 hover:border-white/20 flex items-center gap-3">
            <div
              className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                s.active === 'failed'
                  ? 'bg-rose-500/20 border border-rose-500/30 text-rose-300'
                  : isActive
                  ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
                  : 'bg-slate-700/60 border border-white/10 text-slate-400'
              }`}
            >
              {s.active === 'failed' ? (
                <AlertCircle size={18} />
              ) : isActive ? (
                <CheckCircle2 size={18} />
              ) : (
                <Server size={18} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-sm font-semibold font-mono truncate">{s.unit}</div>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                    s.active === 'failed'
                      ? 'bg-rose-500/20 text-rose-200'
                      : isActive
                      ? 'bg-emerald-500/20 text-emerald-200'
                      : 'bg-slate-500/30 text-slate-300'
                  }`}
                >
                  {s.active}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold bg-white/10 text-slate-200">
                  {s.sub}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1 truncate">
                {s.load} · {s.description}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-end">
              {!isActive && (
                <Action onClick={() => onStart(s.unit)} label="Start" Icon={Play} cls="bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/40" />
              )}
              {isActive && (
                <Action onClick={() => onStop(s.unit)} label="Stop" Icon={Square} cls="bg-rose-500/20 text-rose-200 hover:bg-rose-500/40" />
              )}
              <Action onClick={() => onRestart(s.unit)} label="Restart" Icon={RotateCcw} cls="bg-amber-500/20 text-amber-200 hover:bg-amber-500/40" />
              <Action onClick={() => onStatus(s.unit)} label="Status" Icon={FileText} cls="bg-sky-500/20 text-sky-200 hover:bg-sky-500/40" />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const FilesList: React.FC<{
  files: ServiceFile[];
  onEnable: (name: string) => void;
  onDisable: (name: string) => void;
  onStart: (name: string) => void;
  onStop: (name: string) => void;
  onStatus: (name: string) => void;
  loading: boolean;
}> = ({ files, onEnable, onDisable, onStart, onStop, onStatus, loading }) => {
  if (files.length === 0) {
    return (
      <div className="text-center text-slate-500 text-xs py-10 bg-white/5 rounded-2xl border border-dashed border-white/10">
        {loading ? 'Cargando unit files...' : 'Sin datos.'}
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
      <table className="w-full text-xs text-left">
        <thead className="bg-slate-900/50 text-[11px] text-slate-400 uppercase tracking-wide sticky top-0">
          <tr>
            <th className="py-2 px-3 font-medium">Unit file</th>
            <th className="py-2 px-3 font-medium">Estado</th>
            <th className="py-2 px-3 font-medium">Preset</th>
            <th className="py-2 px-3 font-medium text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {files.map((f) => {
            const enabled = f.state === 'enabled' || f.state === 'enabled-runtime';
            const masked = f.state === 'masked';
            return (
              <tr key={f.unit_file} className="border-b border-white/5 hover:bg-white/5 align-middle">
                <td className="py-2 px-3 font-mono text-slate-200">{f.unit_file}</td>
                <td className="py-2 px-3">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                      enabled
                        ? 'bg-emerald-500/20 text-emerald-200'
                        : masked
                        ? 'bg-rose-500/20 text-rose-200'
                        : 'bg-slate-500/30 text-slate-300'
                    }`}
                  >
                    {f.state}
                  </span>
                </td>
                <td className="py-2 px-3 text-slate-400">{f.preset}</td>
                <td className="py-2 px-3 text-right">
                  <div className="inline-flex gap-1">
                    {!enabled ? (
                      <Action onClick={() => onEnable(f.unit_file)} label="Enable" Icon={Power} cls="bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/40" />
                    ) : (
                      <Action onClick={() => onDisable(f.unit_file)} label="Disable" Icon={PowerOff} cls="bg-slate-500/30 text-slate-200 hover:bg-slate-500/50" />
                    )}
                    <Action onClick={() => onStart(f.unit_file)} label="Start" Icon={Play} cls="bg-sky-500/20 text-sky-200 hover:bg-sky-500/40" />
                    <Action onClick={() => onStop(f.unit_file)} label="Stop" Icon={Square} cls="bg-rose-500/20 text-rose-200 hover:bg-rose-500/40" />
                    <Action onClick={() => onStatus(f.unit_file)} label="Status" Icon={FileText} cls="bg-amber-500/20 text-amber-200 hover:bg-amber-500/40" />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const Action: React.FC<{
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
