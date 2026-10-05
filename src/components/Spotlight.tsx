import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Search, Calculator, ArrowRight, CornerDownLeft, Sparkles } from 'lucide-react';
import { AppId, FileItem, NoteItem } from '../types';
import { APP_REGISTRY } from '../data/systemData';

interface SpotlightProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenApp: (appId: AppId) => void;
  files: FileItem[];
  notes: NoteItem[];
}

export const Spotlight: React.FC<SpotlightProps> = ({
  isOpen,
  onClose,
  onOpenApp,
  files,
  notes,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Evaluate math expression if query contains operators
  let mathResult: string | null = null;
  if (/^[\d\s+\-*/().%^]+$/.test(query.trim()) && /[+\-*/%]/.test(query)) {
    try {
      // Safe math evaluation
      const sanitized = query.replace(/[^0-9+\-*/().%]/g, '');
      // eslint-disable-next-line no-new-func
      const res = Function(`'use strict'; return (${sanitized})`)();
      if (typeof res === 'number' && !isNaN(res) && isFinite(res)) {
        mathResult = String(res);
      }
    } catch {
      mathResult = null;
    }
  }

  // Filter apps
  const matchedApps = Object.values(APP_REGISTRY).filter((app) =>
    app.name.toLowerCase().includes(query.toLowerCase()) ||
    app.category.toLowerCase().includes(query.toLowerCase())
  );

  // Filter files
  const matchedFiles = files.filter((f) =>
    f.name.toLowerCase().includes(query.toLowerCase())
  );

  // Filter notes
  const matchedNotes = notes.filter((n) =>
    n.title.toLowerCase().includes(query.toLowerCase()) ||
    n.content.toLowerCase().includes(query.toLowerCase())
  );

  const allResults = [
    ...(mathResult !== null ? [{ type: 'math', value: mathResult }] : []),
    ...matchedApps.map((app) => ({ type: 'app', data: app })),
    ...matchedFiles.map((file) => ({ type: 'file', data: file })),
    ...matchedNotes.map((note) => ({ type: 'note', data: note })),
  ];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, allResults.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + allResults.length) % Math.max(1, allResults.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = allResults[selectedIndex];
      if (!current) return;
      if (current.type === 'app') {
        onOpenApp(current.data.id as AppId);
        onClose();
      } else if (current.type === 'file') {
        onOpenApp('finder');
        onClose();
      } else if (current.type === 'note') {
        onOpenApp('notes');
        onClose();
      } else if (current.type === 'math') {
        onOpenApp('calculator');
        onClose();
      }
    }
  };

  return (
    <div
      id="spotlight-overlay"
      onClick={onClose}
      className="fixed inset-0 z-[9990] bg-black/40 backdrop-blur-sm flex justify-center pt-[15vh] px-4"
    >
      <motion.div
        id="spotlight-modal"
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        transition={{ duration: 0.16 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-2xl bg-slate-900/80 backdrop-blur-3xl border border-white/20 shadow-2xl overflow-hidden flex flex-col ring-1 ring-white/10"
      >
        {/* Search input line */}
        <div className="flex items-center px-4 py-3.5 border-b border-white/10 gap-3">
          <Search size={20} className="text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Buscar apps, archivos, notas o cálculos..."
            className="flex-1 bg-transparent border-none outline-none text-base text-white placeholder-slate-400/80"
          />
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-slate-300 font-mono">
            <span>ESC</span>
          </div>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 flex flex-col gap-1">
          {mathResult !== null && (
            <div
              onClick={() => {
                onOpenApp('calculator');
                onClose();
              }}
              className="px-3 py-2.5 rounded-xl bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-between cursor-pointer text-indigo-200"
            >
              <div className="flex items-center gap-3">
                <Calculator size={18} className="text-indigo-400" />
                <div>
                  <div className="text-xs text-slate-300 font-mono">{query} =</div>
                  <div className="text-lg font-bold text-white font-mono">{mathResult}</div>
                </div>
              </div>
              <span className="text-xs text-indigo-300 flex items-center gap-1">
                Abrir en Calculadora <CornerDownLeft size={13} />
              </span>
            </div>
          )}

          {/* Section: Apps */}
          {matchedApps.length > 0 && (
            <div className="flex flex-col gap-1">
              <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Aplicaciones
              </div>
              {matchedApps.slice(0, 5).map((app, index) => {
                const isSelected = selectedIndex === (mathResult ? index + 1 : index);
                return (
                  <button
                    key={app.id}
                    onClick={() => {
                      onOpenApp(app.id);
                      onClose();
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-colors ${
                      isSelected ? 'bg-blue-600 text-white' : 'hover:bg-white/10 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center font-medium text-xs">
                        {app.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-xs font-medium">{app.name}</div>
                        <div className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                          {app.category}
                        </div>
                      </div>
                    </div>
                    <ArrowRight size={14} className="opacity-40" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Section: Files */}
          {matchedFiles.length > 0 && (
            <div className="flex flex-col gap-1 mt-1">
              <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Archivos
              </div>
              {matchedFiles.slice(0, 4).map((file) => (
                <button
                  key={file.id}
                  onClick={() => {
                    onOpenApp('finder');
                    onClose();
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 text-slate-200 flex items-center justify-between text-xs"
                >
                  <span className="truncate">{file.name}</span>
                  <span className="text-[10px] text-slate-400">{file.size}</span>
                </button>
              ))}
            </div>
          )}

          {/* Empty state */}
          {allResults.length === 0 && (
            <div className="py-8 text-center text-slate-400 text-xs">
              No se encontraron resultados para &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
