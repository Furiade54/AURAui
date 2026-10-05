import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Folder,
  FileText,
  ChevronRight,
  ChevronLeft,
  Home,
  RefreshCw,
  AlertCircle,
  ArrowUpRight,
  FileCode,
  FileImage,
  FileAudio,
  Binary,
  ChevronDown,
  X,
  Search,
  FolderPlus,
  Upload,
  Download,
  Trash2,
  Pencil,
  Plus,
  Check,
  AlertTriangle,
  Copy,
  Scissors,
  ClipboardPaste,
  Layers,
  Edit3,
  CornerDownLeft,
} from 'lucide-react';
import { api, FileEntry, ReadFileResponse } from '../../lib/api';

function pickIcon(e: FileEntry) {
  if (e.type === 'directory') return Folder;
  const lower = e.name.toLowerCase();
  if (/\.(tsx?|jsx?|c|h|cpp|cs|rs|go|py|rb|sh|bash|zsh|fish|yml|yaml|toml|json|xml|html|css|scss|vue|svelte|sql|ini|conf|cfg)$/.test(lower))
    return FileCode;
  if (/\.(png|jpe?g|gif|webp|svg|ico|bmp|tiff)$/.test(lower)) return FileImage;
  if (/\.(mp3|wav|flac|ogg|m4a|aac)$/.test(lower)) return FileAudio;
  if (/\.(so|dll|exe|bin|deb|rpm|appimage|tar|gz|bz2|xz|zip|rar|7z)$/.test(lower)) return Binary;
  return FileText;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export const FileExplorerApp: React.FC = () => {
  const [path, setPath] = useState('/');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [parent, setParent] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>(['/']);
  const [historyIdx, setHistoryIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'icons'>('list');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'modified' | 'type'>('name');
  const [asc, setAsc] = useState(true);
  const [query, setQuery] = useState('');
  const [viewingFile, setViewingFile] = useState<null | ReadFileResponse>(null);
  const [viewingLoading, setViewingLoading] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<null | { path: string; name: string }>(null);
  const [renamingInput, setRenamingInput] = useState('');
  const [mkdirOpen, setMkdirOpen] = useState(false);
  const [mkdirName, setMkdirName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | { title: string; desc: string; ok: () => Promise<void> | void; danger?: boolean }>(null);
  const [dragOver, setDragOver] = useState(false);
  const [clipboard, setClipboard] = useState<null | { mode: 'copy' | 'cut'; source: string; name: string }>(null);
  const [editingPath, setEditingPath] = useState(false);
  const [pathInput, setPathInput] = useState('/');
  const [pathError, setPathError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const mkdirInputRef = useRef<HTMLInputElement | null>(null);
  const pathInputRef = useRef<HTMLInputElement | null>(null);

  const listFiles = async (p: string) => {
    try {
      setError(null);
      setPathError(null);
      setLoading(true);
      setSelectedPath(null);
      const r = await api.listFiles(p);
      setEntries(r.entries || []);
      setParent(r.parent);
      setPath(r.path);
    } catch (e: any) {
      const m = e?.message || String(e);
      setEntries([]);
      setParent(null);
      if (/No such file|cannot access|not a directory|Permission denied|impossible|ENOENT/i.test(m)) {
        setPathError(m);
        throw e;
      }
      setError(m);
      setPath(p);
    } finally {
      setLoading(false);
    }
  };

  const normalizePath = (raw: string): string => {
    let s = String(raw || '').trim();
    if (!s) return '/';
    if (s.startsWith('~/')) {
      s = (s.length === 2 ? '/home' : '/home/' + s.slice(2));
    } else if (s === '~') {
      s = '/home';
    }
    if (!s.startsWith('/')) s = path.replace(/\/?$/, '/') + s;
    const parts = s.split('/').filter(Boolean);
    const stack: string[] = [];
    for (const p of parts) {
      if (p === '.' || p === '') continue;
      if (p === '..') { stack.pop(); continue; }
      stack.push(p);
    }
    return '/' + stack.join('/');
  };

  const startEditPath = () => {
    setPathInput(path);
    setPathError(null);
    setEditingPath(true);
    setTimeout(() => {
      pathInputRef.current?.focus();
      pathInputRef.current?.select();
    }, 0);
  };

  const cancelEditPath = () => {
    setEditingPath(false);
    setPathError(null);
  };

  const commitPath = async () => {
    const target = normalizePath(pathInput);
    try {
      await listFiles(target);
      const newHistory = history.slice(0, historyIdx + 1).concat([target]);
      setHistory(newHistory);
      setHistoryIdx(newHistory.length - 1);
      setEditingPath(false);
    } catch {
      setEditingPath(true);
      setTimeout(() => pathInputRef.current?.focus(), 0);
    }
  };

  useEffect(() => {
    listFiles(path);
  }, []);

  const go = (p: string) => {
    if (busy) return;
    const newHistory = history.slice(0, historyIdx + 1).concat([p]);
    setHistory(newHistory);
    setHistoryIdx(newHistory.length - 1);
    listFiles(p);
  };

  const back = () => {
    if (historyIdx > 0) {
      const ni = historyIdx - 1;
      setHistoryIdx(ni);
      listFiles(history[ni]);
    }
  };

  const forward = () => {
    if (historyIdx < history.length - 1) {
      const ni = historyIdx + 1;
      setHistoryIdx(ni);
      listFiles(history[ni]);
    }
  };

  const up = () => {
    if (parent !== null) go(parent);
  };

  const openEntry = async (e: FileEntry) => {
    if (busy) return;
    if (e.type === 'directory') {
      go(e.path);
    } else {
      setViewingLoading(true);
      setViewingFile(null);
      try {
        const r = await api.readFile(e.path, 400);
        setViewingFile(r);
      } catch (e2: any) {
        setError(e2?.message || String(e2));
      } finally {
        setViewingLoading(false);
      }
    }
  };

  const selectEntry = (p: string, ev?: React.MouseEvent) => {
    ev?.stopPropagation?.();
    setSelectedPath(p);
  };

  const selectedEntry = entries.find((e) => e.path === selectedPath) || null;

  const display = useMemo(() => {
    return entries
      .filter((e) => !query || e.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => {
        const dirA = a.type === 'directory' ? 0 : 1;
        const dirB = b.type === 'directory' ? 0 : 1;
        if (dirA !== dirB) return dirA - dirB;
        let cmp = 0;
        if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
        else if (sortBy === 'size') cmp = a.size - b.size;
        else if (sortBy === 'type') cmp = (a.type || '').localeCompare(b.type || '');
        else cmp = a.modified.localeCompare(b.modified);
        return asc ? cmp : -cmp;
      });
  }, [entries, query, sortBy, asc]);

  const pathParts = path.split('/').filter(Boolean);

  const BROWSER_BLOCKED_KEYS = new Set([
    't','w','n','l','r','p','d','q','o','e','u','s','g','h','i','j','k','b','m',
    'Tab','+','-','_','=',
  ]);
  const BROWSER_SAFE_ALONE = new Set([
    'Enter','Backspace','Delete','F2','F5','ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ',
  ]);

  const doPaste = async () => {
    if (!clipboard) return;
    try {
      setBusy(clipboard.mode === 'copy' ? `copiando:${clipboard.name}` : `moviendo:${clipboard.name}`);
      const r = clipboard.mode === 'copy'
        ? await api.copyFile(clipboard.source, path, clipboard.name)
        : await api.moveFile(clipboard.source, path, clipboard.name);
      if (r.ok) {
        if (clipboard.mode === 'cut') setClipboard(null);
        await listFiles(path);
      } else {
        setError(`No se pudo ${clipboard.mode === 'copy' ? 'copiar' : 'mover'} "${clipboard.name}".`);
      }
    } catch (e: any) { setError(e?.message || String(e)); }
    finally { setBusy(null); }
  };

  const onKeyDown = useCallback((ev: React.KeyboardEvent) => {
    if (viewingFile) return;
    const target = ev.target as HTMLElement | null;
    const isInput = !!target && (
      target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
    );
    if (isInput) return;

    const mod = ev.ctrlKey || ev.metaKey;
    const k = ev.key;
    const kLow = k.toLowerCase();

    if (mod) {
      if (BROWSER_BLOCKED_KEYS.has(kLow)) return;
      if (BROWSER_BLOCKED_KEYS.has(k)) return;
    }

    if (mod && kLow === 'a') {
      ev.preventDefault();
      const first = display[0];
      if (first) setSelectedPath(first.path);
      return;
    }
    if (mod && kLow === 'c') {
      if (!selectedEntry) return;
      ev.preventDefault();
      setClipboard({ mode: 'copy', source: selectedEntry.path, name: selectedEntry.name });
      return;
    }
    if (mod && kLow === 'x') {
      if (!selectedEntry) return;
      ev.preventDefault();
      setClipboard({ mode: 'cut', source: selectedEntry.path, name: selectedEntry.name });
      return;
    }
    if (mod && kLow === 'v') {
      ev.preventDefault();
      void doPaste();
      return;
    }
    if (mod && (kLow === 'f' || k === '/')) {
      ev.preventDefault();
      return;
    }
    if (!mod && k === 'F4') {
      ev.preventDefault();
      startEditPath();
      return;
    }
    if (ev.altKey && !mod && kLow === 'd') {
      ev.preventDefault();
      startEditPath();
      return;
    }
    if (!mod && (k === 'Escape')) {
      if (editingPath) {
        cancelEditPath();
        ev.preventDefault();
      }
      return;
    }

    if (renaming || mkdirOpen) return;
    if (!mod && !BROWSER_SAFE_ALONE.has(k) && !k.startsWith('Arrow') && k !== ' ') return;

    if (k === 'F5' || (mod && (kLow === 'r'))) return;
    if (k === 'Enter') {
      if (selectedEntry) openEntry(selectedEntry);
      ev.preventDefault();
    } else if (k === 'Backspace') {
      up();
      ev.preventDefault();
    } else if (k === 'Delete' || k === 'Del') {
      if (selectedEntry) {
        ev.preventDefault();
        handleDelete(selectedEntry);
      }
    } else if (k === 'F2') {
      if (selectedEntry) {
        ev.preventDefault();
        startRename(selectedEntry);
      }
    } else if (k === 'ArrowDown' || k === 'ArrowRight') {
      const i = display.findIndex((e) => e.path === selectedPath);
      const next = display[i + 1] || display[0];
      if (next) { setSelectedPath(next.path); ev.preventDefault(); }
    } else if (k === 'ArrowUp' || k === 'ArrowLeft') {
      const i = display.findIndex((e) => e.path === selectedPath);
      const prev = display[i - 1] || display[display.length - 1];
      if (prev) { setSelectedPath(prev.path); ev.preventDefault(); }
    } else if (k === ' ') {
      if (selectedEntry && selectedEntry.type !== 'directory') {
        ev.preventDefault();
        void openEntry(selectedEntry);
      }
    }
  }, [viewingFile, display, selectedPath, selectedEntry, renaming, mkdirOpen]);

  const handleEmptyClick = () => setSelectedPath(null);

  const doMkdir = async () => {
    const name = mkdirName.trim();
    if (!name) return;
    try {
      setBusy('mkdir');
      const r = await api.mkdir(path, name);
      setMkdirOpen(false); setMkdirName('');
      if (r.ok) await listFiles(path);
      else setError('No se pudo crear la carpeta.');
    } catch (e: any) { setError(e?.message || String(e)); }
    finally { setBusy(null); setTimeout(() => mkdirInputRef.current?.focus(), 0); }
  };

  const startRename = (e: FileEntry) => {
    setRenaming({ path: e.path, name: e.name });
    setRenamingInput(e.name);
    setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 0);
  };

  const doRename = async () => {
    if (!renaming) return;
    const name = renamingInput.trim();
    if (!name || name === renaming.name) { setRenaming(null); return; }
    try {
      setBusy('rename');
      const r = await api.renameFile(renaming.path, name);
      setRenaming(null); setRenamingInput('');
      if (r.ok) await listFiles(path);
      else setError('No se pudo renombrar.');
    } catch (e: any) { setError(e?.message || String(e)); }
    finally { setBusy(null); }
  };

  const handleDelete = (e: FileEntry) => {
    const isDir = e.type === 'directory';
    setConfirm({
      title: isDir ? `Eliminar carpeta "${e.name}"?` : `Eliminar archivo "${e.name}"?`,
      desc: isDir ? `Se eliminará recursivamente todo el contenido de ${e.path}. Esta acción no se puede deshacer.` : `Se eliminará ${e.path}. Esta acción no se puede deshacer.`,
      danger: true,
      ok: async () => {
        try {
          setBusy('delete');
          const r = await api.deleteFile(e.path, isDir);
          if (r.ok) { setSelectedPath(null); await listFiles(path); }
          else setError('No se pudo eliminar.');
        } catch (e2: any) { setError(e2?.message || String(e2)); }
        finally { setBusy(null); setConfirm(null); }
      },
    });
  };

  const handleDownload = (e: FileEntry) => {
    if (e.type === 'directory') {
      setError('Descarga de carpetas no soportada aún (solo archivos).');
      return;
    }
    const url = api.buildDownloadUrl(e.path, e.name);
    const a = document.createElement('a');
    a.href = url;
    a.download = e.name;
    a.target = '_blank';
    a.rel = 'noreferrer noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const startCopy = (e: FileEntry) =>
    setClipboard({ mode: 'copy', source: e.path, name: e.name });
  const startCut = (e: FileEntry) =>
    setClipboard({ mode: 'cut', source: e.path, name: e.name });

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(r.error || new Error('FileReader error'));
      r.onload = () => {
        const dataUrl = String(r.result || '');
        const i = dataUrl.indexOf(',');
        resolve(i >= 0 ? dataUrl.slice(i + 1) : '');
      };
      r.readAsDataURL(file);
    });

  const doUploadFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (!files.length) return;
    for (const f of files) {
      try {
        setBusy(`upload:${f.name}`);
        if (f.size > 8 * 1024 * 1024) {
          setError(`Archivo "${f.name}" demasiado grande (máx 8 MB).`);
          continue;
        }
        const b64 = await readFileAsBase64(f);
        const r = await api.uploadFile(path, f.name, b64, '0644');
        if (!r.ok) {
          setError(`No se pudo subir "${f.name}".`);
        }
      } catch (e: any) {
        setError(`Error subiendo "${f.name}": ${e?.message || String(e)}`);
      } finally {
        setBusy(null);
      }
    }
    await listFiles(path);
  };

  const onFilesPicked = (ev: React.ChangeEvent<HTMLInputElement>) => {
    if (ev.target.files?.length) doUploadFiles(ev.target.files);
    ev.target.value = '';
  };

  const onDrop = (ev: React.DragEvent) => {
    ev.preventDefault(); setDragOver(false);
    if (ev.dataTransfer.files?.length) doUploadFiles(ev.dataTransfer.files);
  };

  useEffect(() => {
    if (mkdirOpen) setTimeout(() => mkdirInputRef.current?.focus(), 0);
  }, [mkdirOpen]);

  const isSelected = (p: string) => selectedPath === p;
  const isRenaming = (p: string) => renaming?.path === p;

  return (
    <div
      className="flex flex-col flex-1 bg-slate-950/40 backdrop-blur-xl text-slate-100 overflow-hidden"
      onKeyDown={onKeyDown}
      tabIndex={0}
      ref={listRef}
      onClick={handleEmptyClick}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-white/10 flex-wrap" onClick={(e) => e.stopPropagation()}>
        <button onClick={back} disabled={historyIdx === 0 || !!busy}
          className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center" title="Atrás">
          <ChevronLeft size={16} />
        </button>
        <button onClick={forward} disabled={historyIdx === history.length - 1 || !!busy}
          className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center" title="Adelante">
          <ChevronRight size={16} />
        </button>
        <button onClick={up} disabled={parent === null || !!busy}
          className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center" title="Subir carpeta (Backspace)">
          <ArrowUpRight size={15} />
        </button>
        <button onClick={() => listFiles(path)} disabled={!!busy}
          className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center" title="Refrescar">
          <RefreshCw size={14} className={(loading || busy) ? 'animate-spin' : ''} />
        </button>
        <button onClick={() => go('/')} disabled={!!busy}
          className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center" title="Raíz /">
          <Home size={14} />
        </button>

        <div className="w-px h-6 bg-white/10 mx-1" />

        <button onClick={() => { setMkdirOpen(true); setMkdirName('Nueva carpeta'); }} disabled={!!busy}
          className="h-8 px-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-200 border border-emerald-500/25 flex items-center gap-1 text-[11px]">
          <FolderPlus size={14} /> Nueva carpeta
        </button>

        <button onClick={() => fileInputRef.current?.click()} disabled={!!busy}
          className="h-8 px-2 rounded-lg bg-sky-500/20 hover:bg-sky-500/35 text-sky-200 border border-sky-500/25 flex items-center gap-1 text-[11px]">
          <Upload size={14} /> Subir archivos
        </button>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onFilesPicked} />

        {clipboard && (
          <>
            <div className="w-px h-6 bg-white/10 mx-1" />
            <div className="h-8 px-2 rounded-lg bg-amber-500/15 text-amber-200 border border-amber-500/25 flex items-center gap-2 text-[11px] select-none max-w-[260px]">
              {clipboard.mode === 'copy' ? <Copy size={12} /> : <Scissors size={12} />}
              <span className="truncate font-mono">
                {clipboard.mode === 'copy' ? 'Copiado' : 'Cortado'}: {clipboard.name}
              </span>
              <button onClick={() => setClipboard(null)} className="text-amber-200/70 hover:text-amber-100" title="Limpiar portapapeles">
                <X size={12} />
              </button>
            </div>
            <button onClick={() => void doPaste()} disabled={!!busy || clipboard.source === path + '/' + clipboard.name}
              className="h-8 px-2 rounded-lg bg-teal-500/20 hover:bg-teal-500/35 text-teal-200 border border-teal-500/25 flex items-center gap-1 text-[11px]" title="Pegar (Ctrl+V)">
              <ClipboardPaste size={13} /> Pegar
            </button>
          </>
        )}

        {selectedEntry && (
          <>
            <div className="w-px h-6 bg-white/10 mx-1" />
            <button onClick={() => startCopy(selectedEntry)} disabled={!!busy}
              className="h-8 px-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 flex items-center gap-1 text-[11px]" title="Copiar (Ctrl+C)">
              <Copy size={13} /> Copiar
            </button>
            <button onClick={() => startCut(selectedEntry)} disabled={!!busy}
              className="h-8 px-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 flex items-center gap-1 text-[11px]" title="Cortar (Ctrl+X)">
              <Scissors size={13} /> Cortar
            </button>
            <button onClick={() => startRename(selectedEntry)} disabled={!!busy}
              className="h-8 px-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 flex items-center gap-1 text-[11px]" title="Renombrar (F2)">
              <Pencil size={13} /> Renombrar
            </button>
            <button onClick={() => handleDownload(selectedEntry)} disabled={!!busy || selectedEntry.type === 'directory'}
              className="h-8 px-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/35 text-indigo-200 border border-indigo-500/25 disabled:opacity-40 flex items-center gap-1 text-[11px]" title="Descargar">
              <Download size={13} /> Descargar
            </button>
            <button onClick={() => handleDelete(selectedEntry)} disabled={!!busy}
              className="h-8 px-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 border border-rose-500/25 flex items-center gap-1 text-[11px]" title="Eliminar (Del)">
              <Trash2 size={13} /> Eliminar
            </button>
          </>
        )}

        {/* Breadcrumbs / Editable path bar */}
        <div className="flex-1 mx-2 min-w-[120px] flex items-center gap-1 overflow-hidden text-xs font-mono">
          <button onClick={(e) => { e.stopPropagation(); startEditPath(); }}
            className="shrink-0 w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-200"
            title="Editar ruta (F4 o Alt+D). Ctrl+L lo tiene el navegador.">
            <Edit3 size={13} />
          </button>
          {editingPath ? (
            <form
              className="flex-1 flex items-center gap-1"
              onSubmit={(e) => { e.preventDefault(); void commitPath(); }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex-1 relative">
                <input
                  ref={pathInputRef}
                  value={pathInput}
                  onChange={(e) => setPathInput(e.target.value)}
                  onBlur={() => setTimeout(() => { if (editingPath) void commitPath(); }, 120)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      e.stopPropagation();
                      cancelEditPath();
                    }
                  }}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="Escribe la ruta (ej: /var/www/html o ~/.config)"
                  className={`w-full px-2 py-1.5 rounded-lg border bg-slate-950/70 backdrop-blur text-slate-100 focus:outline-none text-[12px] font-mono ${
                    pathError ? 'border-rose-500/60 focus:border-rose-500' : 'border-sky-500/40 focus:border-sky-400'
                  }`}
                />
                {pathError && (
                  <div className="absolute left-0 top-full mt-1 px-2 py-1 rounded-md bg-rose-500/20 border border-rose-500/30 text-[10px] text-rose-200 whitespace-nowrap z-10 flex items-center gap-1">
                    <AlertTriangle size={11} /> Ruta inválida: {String(pathError).slice(0, 140)}
                  </div>
                )}
              </div>
              <button type="submit"
                className="w-7 h-7 rounded-lg bg-sky-500/30 hover:bg-sky-500/50 border border-sky-500/40 flex items-center justify-center text-sky-100"
                title="Ir (Enter)">
                <CornerDownLeft size={13} />
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); cancelEditPath(); }}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-200"
                title="Cancelar (Esc)">
                <X size={13} />
              </button>
            </form>
          ) : (
            <div
              onDoubleClick={(e) => { e.stopPropagation(); startEditPath(); }}
              className="flex-1 flex items-center gap-1 px-1 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10 cursor-text overflow-hidden"
              title="Doble clic para editar la ruta (F4 / Alt+D)"
            >
              <button onClick={(e) => { e.stopPropagation(); go('/'); }}
                className="shrink-0 px-2 py-1 rounded-md hover:bg-white/10 text-slate-200"> / </button>
              <ChevronRight size={12} className="text-slate-500 shrink-0" />
              {pathParts.map((p, i) => (
                <React.Fragment key={p + i}>
                  <button onClick={(e) => { e.stopPropagation(); go('/' + pathParts.slice(0, i + 1).join('/')); }}
                    className="shrink-0 px-2 py-1 rounded-md hover:bg-white/10 text-slate-200 truncate"> {p} </button>
                  {i < pathParts.length - 1 && <ChevronRight size={12} className="text-slate-500 shrink-0" />}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrar..."
            className="pl-6 pr-3 py-1.5 text-[11px] rounded-lg bg-white/10 border border-white/10 focus:border-sky-500/50 focus:outline-none placeholder:text-slate-500 w-40" />
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-white/5 border border-white/10 p-0.5 text-[11px]">
          <button onClick={() => setView('icons')} className={`px-2 py-1 rounded-md ${view === 'icons' ? 'bg-white/15 text-white' : 'text-slate-300'}`}>Iconos</button>
          <button onClick={() => setView('list')} className={`px-2 py-1 rounded-md ${view === 'list' ? 'bg-white/15 text-white' : 'text-slate-300'}`}>Lista</button>
        </div>

        <div className="flex items-center gap-1 text-[11px]">
          <div className="flex items-center gap-1 rounded-md bg-white/5 border border-white/10 p-0.5">
            {(['name', 'size', 'type', 'modified'] as const).map((k) => (
              <button key={k} onClick={() => { if (sortBy === k) setAsc(!asc); else { setSortBy(k); setAsc(true); } }}
                className={`px-1.5 py-0.5 rounded capitalize ${sortBy === k ? 'bg-white/15 text-white' : 'text-slate-400'}`}>
                {k === 'modified' ? 'Fecha' : k} {sortBy === k && <span>{asc ? '↑' : '↓'}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {busy && (
        <div className="mx-2 mt-2 rounded-xl px-3 py-1.5 bg-sky-500/15 border border-sky-500/30 text-sky-200 text-[11px] flex items-center gap-2">
          <RefreshCw size={12} className="animate-spin" /> <span>{busy}</span>
        </div>
      )}

      {error && (
        <div className="mx-2 mt-2 rounded-xl p-2.5 bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <div className="break-all flex-1">{error}</div>
          <button onClick={() => setError(null)} className="ml-2 text-rose-300 hover:text-white"><X size={12} /></button>
        </div>
      )}

      <div
        className={`flex-1 overflow-auto p-3 relative ${dragOver ? 'ring-2 ring-sky-400/60 bg-sky-500/5' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={handleEmptyClick}
      >
        {dragOver && (
          <div className="absolute inset-3 pointer-events-none border-2 border-dashed border-sky-400/60 rounded-2xl flex items-center justify-center text-sky-200 text-sm font-semibold bg-sky-500/5 z-20">
            <Plus size={18} className="mr-2" /> Soltar archivos aquí para subir a {path}
          </div>
        )}

        {loading && <div className="text-center text-slate-400 text-xs py-10">Cargando {path}...</div>}

        {!loading && display.length === 0 && (
          <div className="text-center text-slate-500 text-xs py-10 bg-white/5 rounded-2xl border border-dashed border-white/10">
            {query ? 'Sin coincidencias.' : 'Carpeta vacía. Arrastra archivos aquí o usa "Subir archivos".'}
          </div>
        )}

        {view === 'list' ? (
          <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900/60 text-[10px] text-slate-400 uppercase tracking-wide sticky top-0">
                <tr>
                  <th className="py-2 px-3 font-medium">Nombre</th>
                  <th className="py-2 px-3 font-medium">Tipo</th>
                  <th className="py-2 px-3 font-medium text-right">Tamaño</th>
                  <th className="py-2 px-3 font-medium text-right">Modificado</th>
                  <th className="py-2 px-3 font-medium">Permisos</th>
                  <th className="py-2 px-3 font-medium">Usuario / Grupo</th>
                </tr>
              </thead>
              <tbody>
                {display.map((e) => {
                  const Icon = pickIcon(e);
                  const sel = isSelected(e.path);
                  const ren = isRenaming(e.path);
                  return (
                    <tr
                      key={e.path}
                      onClick={(ev) => selectEntry(e.path, ev)}
                      onDoubleClick={() => openEntry(e)}
                      className={`border-b border-white/5 hover:bg-white/5 cursor-pointer ${sel ? 'bg-sky-500/15' : ''}`}
                    >
                      <td className="py-2 px-3 flex items-center gap-2 min-w-0">
                        <div className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center ${e.type === 'directory' ? 'bg-sky-500/25 text-sky-200' : 'bg-slate-700/40 text-slate-200'}`}>
                          <Icon size={14} />
                        </div>
                        {ren ? (
                          <input ref={renameInputRef} value={renamingInput} onChange={(ev) => setRenamingInput(ev.target.value)}
                            onBlur={doRename} onKeyDown={(ev) => { if (ev.key === 'Enter') doRename(); if (ev.key === 'Escape') setRenaming(null); }}
                            onMouseDown={(ev) => ev.stopPropagation()} onClick={(ev) => ev.stopPropagation()}
                            className="flex-1 min-w-0 px-2 py-1 rounded-md bg-slate-900 border border-sky-500/50 text-slate-100 text-xs font-mono outline-none" />
                        ) : (
                          <span className="truncate font-mono text-slate-100">{e.name}</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-400 capitalize">{e.type}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-300">{e.type === 'directory' ? '--' : fmtSize(e.size)}</td>
                      <td className="py-2 px-3 text-right text-slate-400 whitespace-nowrap">{e.modified}</td>
                      <td className="py-2 px-3 font-mono text-slate-400">{e.perms}</td>
                      <td className="py-2 px-3 font-mono text-slate-400">{e.owner}:{e.group}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3" onClick={(e) => e.stopPropagation()}>
            {display.map((e) => {
              const Icon = pickIcon(e);
              const sel = isSelected(e.path);
              const ren = isRenaming(e.path);
              return (
                <button
                  key={e.path}
                  onClick={(ev) => selectEntry(e.path, ev)}
                  onDoubleClick={() => openEntry(e)}
                  className={`flex flex-col items-center gap-2 rounded-xl p-3 hover:bg-white/10 border transition-colors ${sel ? 'bg-sky-500/15 border-sky-500/40' : 'border-transparent hover:border-white/10'}`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${e.type === 'directory' ? 'bg-gradient-to-br from-sky-500 to-indigo-600 text-white' : 'bg-gradient-to-br from-slate-600 to-slate-800 text-white'}`}>
                    <Icon size={24} />
                  </div>
                  {ren ? (
                    <input ref={renameInputRef} value={renamingInput} onChange={(ev) => setRenamingInput(ev.target.value)}
                      onBlur={doRename} onKeyDown={(ev) => { if (ev.key === 'Enter') doRename(); if (ev.key === 'Escape') setRenaming(null); }}
                      onMouseDown={(ev) => ev.stopPropagation()}
                      className="w-full px-2 py-1 rounded-md bg-slate-900 border border-sky-500/50 text-[11px] text-slate-100 font-mono outline-none" />
                  ) : (
                    <div className="text-[11px] text-slate-100 text-center line-clamp-2 w-full break-all">{e.name}</div>
                  )}
                  <div className="text-[10px] text-slate-400">{e.type === 'directory' ? 'Carpeta' : fmtSize(e.size)}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {mkdirOpen && (
        <ModalShell title="Nueva carpeta" onClose={() => setMkdirOpen(false)}>
          <div className="flex flex-col gap-3">
            <div className="text-xs text-slate-300">En la carpeta <span className="font-mono text-sky-200">{path}</span>:</div>
            <input ref={mkdirInputRef} value={mkdirName} onChange={(e) => setMkdirName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') doMkdir(); if (e.key === 'Escape') setMkdirOpen(false); }}
              placeholder="Nombre de la carpeta" className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-sm outline-none focus:border-sky-500/60" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setMkdirOpen(false)} className="px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20">Cancelar</button>
              <button onClick={doMkdir} disabled={!mkdirName.trim() || !!busy} className="px-3 py-1.5 text-xs rounded-lg bg-emerald-500/80 hover:bg-emerald-500 text-white flex items-center gap-1 disabled:opacity-40">
                <Check size={13} /> Crear
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {confirm && (
        <ModalShell title={confirm.title} onClose={() => setConfirm(null)}>
          <div className="flex flex-col gap-3">
            <div className="flex gap-3 items-start">
              <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${confirm.danger ? 'bg-rose-500/20 text-rose-200 border border-rose-500/30' : 'bg-sky-500/20 text-sky-200 border border-sky-500/30'}`}>
                {confirm.danger ? <AlertTriangle size={18} /> : <AlertCircle size={18} />}
              </div>
              <div className="text-xs text-slate-300">{confirm.desc}</div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirm(null)} className="px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20">Cancelar</button>
              <button onClick={confirm.ok} className={`px-3 py-1.5 text-xs rounded-lg text-white flex items-center gap-1 ${confirm.danger ? 'bg-rose-500 hover:bg-rose-600' : 'bg-sky-500 hover:bg-sky-600'}`}>
                <Check size={13} /> Confirmar
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {viewingFile && (
        <div className="absolute inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[85vh] rounded-2xl bg-slate-900 border border-white/15 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 p-3 border-b border-white/10">
              <FileText size={16} className="text-amber-300" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{viewingFile.path}</div>
                <div className="text-[11px] text-slate-400">
                  {viewingFile.line_count} líneas · {viewingFile.truncated ? ' (primeros ~1MB)' : ''}
                </div>
              </div>
              <a href={api.buildDownloadUrl(viewingFile.path, viewingFile.path.split('/').pop() || 'file')}
                target="_blank" rel="noreferrer noopener" download
                className="mr-1 h-7 px-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/35 text-indigo-200 border border-indigo-500/25 flex items-center gap-1 text-[11px]">
                <Download size={12} /> Descargar
              </a>
              <button onClick={() => setViewingFile(null)} className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center">
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-3 bg-black/60 font-mono text-[11px] leading-relaxed text-slate-200 whitespace-pre-wrap break-all">
              {viewingLoading ? 'Cargando...' : viewingFile.content || '(vacío)'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ModalShell: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="absolute inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
    <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-white/15 shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2 p-3 border-b border-white/10">
        <div className="text-sm font-semibold">{title}</div>
        <button onClick={onClose} className="ml-auto w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"><X size={14} /></button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  </div>
);
