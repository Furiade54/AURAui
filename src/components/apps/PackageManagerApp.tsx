import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Package as PackageIcon,
  Search,
  RefreshCw,
  Play,
  Loader2,
  Check,
  X,
  Download,
  Trash2,
  RotateCcw,
  ArrowUpRight,
  Filter,
  AlertCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  api,
  PackageInfo,
} from '../../lib/api';

type StatusFilter = 'all' | 'installed' | 'available';

const STREAM_LOG_LIMIT = 4000;

const OperationModal: React.FC<{
  title: string;
  isOpen: boolean;
  onClose: () => void;
  output: string;
  running: boolean;
  ok?: boolean;
}> = ({ title, isOpen, onClose, output, running, ok }) => {
  const scrollRef = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [output, isOpen]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl h-[70vh] flex flex-col rounded-2xl overflow-hidden bg-slate-950/90 border border-white/15 shadow-2xl">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-black/40">
          <div className={`w-2 h-2 rounded-full ${running ? 'bg-amber-400 animate-pulse' : ok === undefined ? 'bg-slate-400' : ok ? 'bg-emerald-400' : 'bg-rose-400'}`} />
          <div className="text-sm font-semibold text-white flex-1 truncate">{title}</div>
          <button
            onClick={onClose}
            disabled={running}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 flex items-center justify-center text-slate-200"
          >
            <X size={14} />
          </button>
        </div>
        <pre
          ref={scrollRef}
          className="flex-1 overflow-auto p-4 text-[12px] leading-relaxed font-mono text-slate-100 whitespace-pre-wrap break-words bg-black/50"
        >
          {output || '(esperando salida...)\n'}
        </pre>
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-white/10 bg-black/40">
          <div className="text-[11px] text-slate-400 truncate flex-1">
            {running ? 'Operación en curso, no cierres esta ventana.' : output ? 'Operación finalizada.' : ''}
          </div>
          <button
            onClick={onClose}
            disabled={running}
            className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 disabled:opacity-40 text-white text-xs font-medium"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export const PackageManagerApp: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [packages, setPackages] = useState<PackageInfo[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<'name' | 'category'>('name');
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [logModal, setLogModal] = useState<{
    open: boolean;
    title: string;
    output: string;
    running: boolean;
    ok?: boolean;
  }>({ open: false, title: '', output: '', running: false });

  const logAccRef = useRef('');

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of packages) set.add(p.category);
    return ['all', ...Array.from(set).sort()];
  }, [packages]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = packages.slice();
    if (category !== 'all') out = out.filter((p) => p.category === category);
    if (statusFilter === 'installed') out = out.filter((p) => p.installed);
    if (statusFilter === 'available') out = out.filter((p) => !p.installed);
    if (q) {
      out = out.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }
    out.sort((a, b) => {
      if (sortBy === 'category') {
        const c = a.category.localeCompare(b.category);
        if (c !== 0) return c;
        return a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
    return out;
  }, [packages, category, statusFilter, search, sortBy]);

  const installedCount = useMemo(() => packages.filter((p) => p.installed).length, [packages]);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await api.listPackages();
      if (!r?.ok) throw new Error('Respuesta inválida del servidor');
      setPackages(r.packages || []);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const startModal = (title: string) => {
    logAccRef.current = '';
    setLogModal({ open: true, title, output: '', running: true });
  };

  const pushChunk = (chunk: string) => {
    logAccRef.current = (logAccRef.current + chunk).slice(-STREAM_LOG_LIMIT);
    setLogModal((s) => ({ ...s, output: logAccRef.current }));
  };

  const finishModal = (ok: boolean) => {
    setLogModal((s) => ({ ...s, running: false, ok }));
  };

  const markBusy = (names: string[], isBusy: boolean) => {
    setBusy((prev) => {
      const next = new Set(prev);
      names.forEach((n) => (isBusy ? next.add(n) : next.delete(n)));
      return next;
    });
  };

  const withBusy = async <T,>(names: string[], fn: () => Promise<T>) => {
    markBusy(names, true);
    try {
      return await fn();
    } finally {
      markBusy(names, false);
    }
  };

  const refreshStatusAfter = async (names?: string[]) => {
    try {
      if (!names || names.length === 0) {
        await loadCatalog();
        return;
      }
      const fresh = await api.listPackages();
      if (fresh?.ok) setPackages(fresh.packages || []);
    } catch {}
  };

  const doInstall = async (pkg: PackageInfo) => {
    startModal(`Instalando: ${pkg.name}`);
    try {
      const r = await withBusy([pkg.name], () =>
        api.installPackages(pkg.name, { onChunk: (c) => pushChunk(c) })
      );
      finishModal(r.ok && (r.fullText.includes('[Exit code 0]') || r.ok));
      await refreshStatusAfter([pkg.name]);
    } catch (e: any) {
      pushChunk(`\n[Error: ${e?.message || String(e)}]\n`);
      finishModal(false);
    }
  };

  const doUninstall = async (pkg: PackageInfo, purge = false) => {
    startModal(`${purge ? 'Purgar' : 'Desinstalando'}: ${pkg.name}`);
    try {
      const r = await withBusy([pkg.name], () =>
        api.uninstallPackages(pkg.name, { onChunk: (c) => pushChunk(c), purge })
      );
      finishModal(r.ok && (r.fullText.includes('[Exit code 0]') || r.ok));
      await refreshStatusAfter([pkg.name]);
    } catch (e: any) {
      pushChunk(`\n[Error: ${e?.message || String(e)}]\n`);
      finishModal(false);
    }
  };

  const doAptUpdate = async () => {
    startModal('apt update — Actualizar índices de paquetes');
    try {
      const r = await api.aptUpdate({ onChunk: (c) => pushChunk(c) });
      finishModal(r.ok);
    } catch (e: any) {
      pushChunk(`\n[Error: ${e?.message || String(e)}]\n`);
      finishModal(false);
    }
  };

  const doAptUpgrade = async (full = false) => {
    startModal(full ? 'apt dist-upgrade — Actualización completa' : 'apt upgrade — Actualizar paquetes');
    try {
      const r = await api.aptUpgrade({ onChunk: (c) => pushChunk(c), full });
      finishModal(r.ok);
      await refreshStatusAfter();
    } catch (e: any) {
      pushChunk(`\n[Error: ${e?.message || String(e)}]\n`);
      finishModal(false);
    }
  };

  const doAutoremove = async () => {
    startModal('apt autoremove + clean — Limpiar paquetes huérfanos');
    try {
      const r = await api.aptAutoremove({ onChunk: (c) => pushChunk(c) });
      finishModal(r.ok);
      await refreshStatusAfter();
    } catch (e: any) {
      pushChunk(`\n[Error: ${e?.message || String(e)}]\n`);
      finishModal(false);
    }
  };

  const isAnyBusy = busy.size > 0;

  return (
    <div className="flex flex-col h-full bg-slate-950/70 backdrop-blur-xl text-slate-100">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-black/30">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-fuchsia-700 via-pink-600 to-rose-500 flex items-center justify-center shadow-lg shrink-0">
          <PackageIcon size={18} className="text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">Instalador APT</div>
          <div className="text-[11px] text-slate-400 truncate">
            {packages.length} paquetes en catálogo · {installedCount} instalados · {packages.length - installedCount} disponibles
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={doAptUpdate}
            className="px-2.5 py-1.5 rounded-lg bg-sky-500/20 text-sky-200 hover:bg-sky-500/30 flex items-center gap-1.5 text-[11px] font-medium"
            title="Actualiza los índices de paquetes APT"
          >
            <RefreshCw size={12} /> apt update
          </button>
          <button
            onClick={() => doAptUpgrade(false)}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 flex items-center gap-1.5 text-[11px] font-medium"
            title="Actualiza paquetes sin eliminar ninguno"
          >
            <ArrowUpRight size={12} /> apt upgrade
          </button>
          <button
            onClick={() => doAptUpgrade(true)}
            className="px-2.5 py-1.5 rounded-lg bg-violet-500/20 text-violet-200 hover:bg-violet-500/30 flex items-center gap-1.5 text-[11px] font-medium"
            title="dist-upgrade: puede eliminar paquetes de ser necesario"
          >
            <RotateCcw size={12} /> dist-upgrade
          </button>
          <button
            onClick={doAutoremove}
            className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 text-rose-200 hover:bg-rose-500/25 flex items-center gap-1.5 text-[11px] font-medium"
            title="Eliminar paquetes huérfanos y cache .deb"
          >
            <Trash2 size={12} /> limpiar
          </button>
          <button
            onClick={loadCatalog}
            disabled={loading}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 flex items-center justify-center"
            title="Refrescar catálogo"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-black/20 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar paquete, descripción o categoría..."
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
          />
        </div>

        <div className="flex items-center gap-1 px-2 h-8 rounded-lg bg-white/5 border border-white/10 text-[11px]">
          <Filter size={12} className="text-slate-400 shrink-0" />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-transparent outline-none text-slate-200 h-8 pr-1"
          >
            {categories.map((c) => (
              <option key={c} value={c} className="bg-slate-900 text-white">
                {c === 'all' ? 'Categoría: todas' : c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-white/5 border border-white/10 overflow-hidden p-0.5">
          {(['all', 'installed', 'available'] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-2.5 h-7 rounded-md text-[11px] font-medium transition ${
                statusFilter === f
                  ? 'bg-white/15 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'installed' ? 'Instalados' : 'Disponibles'}
            </button>
          ))}
        </div>

        <button
          onClick={() => setSortBy((s) => (s === 'name' ? 'category' : 'name'))}
          className="h-8 px-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-slate-200 flex items-center gap-1"
        >
          Orden: {sortBy === 'name' ? 'Nombre' : 'Categoría'}
          {sortBy === 'name' ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {loading && packages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 size={22} className="animate-spin text-fuchsia-400" />
            <div className="text-xs">Cargando catálogo de paquetes...</div>
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-rose-300 p-6 text-center">
            <AlertCircle size={22} />
            <div className="text-sm font-medium">No se pudo cargar el catálogo</div>
            <div className="text-xs text-rose-400/80 max-w-xl break-words">{error}</div>
            <button
              onClick={loadCatalog}
              className="mt-2 px-3 py-1.5 rounded-md bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs"
            >
              Reintentar
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400 p-6 text-center">
            <XCircle size={22} className="text-slate-500" />
            <div className="text-sm font-medium">No hay paquetes que coincidan</div>
            <div className="text-xs text-slate-500">Prueba con otro filtro o elimina la búsqueda.</div>
          </div>
        ) : (
          <div className="p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {filtered.map((p) => {
              const pkgBusy = busy.has(p.name);
              return (
                <div
                  key={p.name}
                  className="group rounded-xl border border-white/10 bg-white/5 hover:bg-white/[0.07] transition flex flex-col gap-2 p-3 min-h-[120px]"
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow ${
                        p.installed
                          ? 'bg-gradient-to-tr from-emerald-600 to-teal-500'
                          : 'bg-gradient-to-tr from-slate-700 to-slate-600'
                      }`}
                    >
                      {p.installed ? (
                        <Check size={16} className="text-white" />
                      ) : (
                        <Download size={16} className="text-white" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="font-semibold text-sm text-white truncate">{p.name}</div>
                        {p.version && (
                          <div className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 border border-white/10 text-slate-300 shrink-0">
                            {p.version}
                          </div>
                        )}
                        {p.installed && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 shrink-0">
                            instalado
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 mt-0.5">{p.category}</div>
                    </div>
                  </div>
                  <div className="text-[11.5px] leading-snug text-slate-300 line-clamp-3 min-h-[2.8em]">
                    {p.description}
                  </div>
                  <div className="mt-auto flex items-center gap-1.5 pt-1">
                    {p.installed ? (
                      <>
                        <button
                          onClick={() => doUninstall(p, false)}
                          disabled={pkgBusy || isAnyBusy}
                          className="flex-1 h-8 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 disabled:opacity-40 text-rose-200 text-[11px] font-medium flex items-center justify-center gap-1.5 border border-rose-500/20"
                        >
                          <Trash2 size={12} />
                          Desinstalar
                        </button>
                        <button
                          onClick={() => doUninstall(p, true)}
                          disabled={pkgBusy || isAnyBusy}
                          title="Purgar: también elimina archivos de configuración"
                          className="h-8 w-8 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-40 text-rose-300 flex items-center justify-center border border-rose-500/10"
                        >
                          <X size={12} />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => doInstall(p)}
                        disabled={pkgBusy || isAnyBusy}
                        className="flex-1 h-8 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-40 text-emerald-200 text-[11px] font-medium flex items-center justify-center gap-1.5 border border-emerald-500/20"
                      >
                        {pkgBusy ? (
                          <>
                            <Loader2 size={12} className="animate-spin" /> Instalando...
                          </>
                        ) : (
                          <>
                            <Play size={12} /> Instalar
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <OperationModal
        title={logModal.title}
        isOpen={logModal.open}
        onClose={() => setLogModal((s) => ({ ...s, open: false }))}
        output={logModal.output}
        running={logModal.running}
        ok={logModal.ok}
      />
    </div>
  );
};
