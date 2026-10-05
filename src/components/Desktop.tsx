import React, { useState } from 'react';
import { Folder, FileText, Image as ImageIcon, Code2, Sparkles, Terminal, Settings } from 'lucide-react';
import { FileItem, AppId, Wallpaper } from '../types';

interface DesktopProps {
  files: FileItem[];
  wallpaper: Wallpaper;
  brightness: number;
  onOpenApp: (appId: AppId) => void;
  onOpenFile: (file: FileItem) => void;
  onOpenSettings: () => void;
  onOpenTerminal: () => void;
}

export const Desktop: React.FC<DesktopProps> = ({
  files,
  wallpaper,
  brightness,
  onOpenApp,
  onOpenFile,
  onOpenSettings,
  onOpenTerminal,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const desktopFiles = files.filter((f) => !f.parentId);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  return (
    <div
      id="desktop-canvas"
      onContextMenu={handleContextMenu}
      onClick={() => {
        setSelectedId(null);
        closeContextMenu();
      }}
      style={{
        background: wallpaper.gradient,
        filter: `brightness(${brightness}%)`,
      }}
      className="fixed inset-0 w-full h-full overflow-hidden transition-all duration-700 bg-cover bg-center select-none"
    >
      {/* Dynamic desktop ambient mesh glow */}
      <div className="absolute inset-0 bg-black/15 pointer-events-none" />

      {/* Desktop items column (top right or top left) */}
      <div className="absolute top-10 right-4 flex flex-col gap-3 z-10 w-24">
        {/* Macintosh HD / AuraOS Drive */}
        <div
          id="desktop-item-aura-drive"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedId('aura-hd');
            closeContextMenu();
          }}
          onDoubleClick={() => onOpenApp('finder')}
          className={`flex flex-col items-center p-2 rounded-xl text-center cursor-pointer transition-colors ${
            selectedId === 'aura-hd' ? 'bg-blue-600/40 backdrop-blur-md ring-1 ring-white/30' : 'hover:bg-white/10'
          }`}
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-slate-400 via-slate-300 to-slate-100 flex items-center justify-center shadow-lg border border-white/40 mb-1">
            <Sparkles size={22} className="text-slate-800" />
          </div>
          <span className="text-[11px] font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] line-clamp-2 px-1">
            Aura HD
          </span>
        </div>

        {/* Files and Folders on desktop */}
        {desktopFiles.map((file) => {
          const isSelected = selectedId === file.id;
          return (
            <div
              key={file.id}
              id={`desktop-item-${file.id}`}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedId(file.id);
                closeContextMenu();
              }}
              onDoubleClick={() => onOpenFile(file)}
              className={`flex flex-col items-center p-2 rounded-xl text-center cursor-pointer transition-colors ${
                isSelected ? 'bg-blue-600/40 backdrop-blur-md ring-1 ring-white/30' : 'hover:bg-white/10'
              }`}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-1">
                {file.type === 'folder' && (
                  <div className="w-12 h-10 rounded-lg bg-gradient-to-b from-sky-400 to-blue-600 flex items-center justify-center shadow-lg border-t border-sky-300">
                    <Folder size={22} className="text-white fill-white/20" />
                  </div>
                )}
                {file.type === 'text' && (
                  <div className="w-10 h-12 rounded-md bg-white/90 border border-white/60 shadow-md flex items-center justify-center text-slate-800">
                    <FileText size={20} className="text-blue-600" />
                  </div>
                )}
                {file.type === 'image' && (
                  <div className="w-11 h-11 rounded-lg bg-amber-500/80 border border-white/40 shadow-md flex items-center justify-center text-white">
                    <ImageIcon size={22} />
                  </div>
                )}
                {file.type === 'code' && (
                  <div className="w-11 h-11 rounded-lg bg-violet-600/90 border border-white/40 shadow-md flex items-center justify-center text-white">
                    <Code2 size={22} />
                  </div>
                )}
              </div>
              <span className="text-[11px] font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] line-clamp-2 px-1">
                {file.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Desktop Context Menu */}
      {contextMenu && (
        <div
          id="desktop-context-menu"
          style={{ top: contextMenu.y, left: Math.min(contextMenu.x, window.innerWidth - 220) }}
          onClick={(e) => e.stopPropagation()}
          className="fixed w-52 rounded-xl py-1.5 bg-slate-900/90 backdrop-blur-3xl border border-white/20 shadow-2xl text-slate-200 z-[9995] animate-in fade-in duration-100"
        >
          <button
            onClick={() => {
              onOpenApp('finder');
              closeContextMenu();
            }}
            className="w-full text-left px-3.5 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 text-xs"
          >
            <Folder size={14} /> Nueva Carpeta
          </button>
          <button
            onClick={() => {
              onOpenSettings();
              closeContextMenu();
            }}
            className="w-full text-left px-3.5 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 text-xs"
          >
            <Settings size={14} /> Cambiar Fondo de Pantalla...
          </button>
          <button
            onClick={() => {
              onOpenTerminal();
              closeContextMenu();
            }}
            className="w-full text-left px-3.5 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 text-xs"
          >
            <Terminal size={14} /> Abrir en Terminal
          </button>
          <div className="h-px bg-white/10 my-1 mx-2" />
          <button
            onClick={() => {
              onOpenSettings();
              closeContextMenu();
            }}
            className="w-full text-left px-3.5 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 text-xs"
          >
            <Sparkles size={14} /> Información del Sistema
          </button>
        </div>
      )}
    </div>
  );
};
