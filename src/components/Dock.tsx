import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Folder, 
  Terminal, 
  Settings as SettingsIcon,
  Trash2,
  LucideIcon,
  Activity,
  Cpu,
  Container,
  Server,
  Package,
} from 'lucide-react';
import { AppId, WindowState } from '../types';
import { APP_REGISTRY } from '../data/systemData';
import { playClickSound, playOpenSound } from '../utils/sound';

interface DockProps {
  openWindows: WindowState[];
  activeWindowId: string | null;
  onLaunchApp: (appId: AppId) => void;
  onRestoreWindow: (windowId: string) => void;
  soundEnabled: boolean;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Folder,
  Terminal,
  Settings: SettingsIcon,
  Activity,
  Cpu,
  Container,
  Server,
  Package,
};

// Modern gradients for each VPS app icon
const ICON_STYLES: Record<AppId, { bg: string; iconColor: string }> = {
  dashboard: { bg: 'bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400', iconColor: 'text-white' },
  packages: { bg: 'bg-gradient-to-tr from-fuchsia-700 via-pink-600 to-rose-500', iconColor: 'text-white' },
  terminal: { bg: 'bg-gradient-to-tr from-slate-900 via-zinc-900 to-slate-800 border border-white/20', iconColor: 'text-emerald-400' },
  processes: { bg: 'bg-gradient-to-tr from-violet-700 via-purple-600 to-indigo-500', iconColor: 'text-white' },
  docker: { bg: 'bg-gradient-to-tr from-sky-700 via-blue-600 to-cyan-500', iconColor: 'text-white' },
  services: { bg: 'bg-gradient-to-tr from-amber-700 via-orange-600 to-red-500', iconColor: 'text-white' },
  files: { bg: 'bg-gradient-to-tr from-sky-600 via-blue-500 to-indigo-400', iconColor: 'text-white' },
  settings: { bg: 'bg-gradient-to-tr from-slate-700 via-gray-600 to-slate-500', iconColor: 'text-slate-100' },
};

const DOCK_APPS: AppId[] = [
  'dashboard',
  'packages',
  'files',
  'processes',
  'docker',
  'services',
  'terminal',
  'settings',
];

export const Dock: React.FC<DockProps> = ({
  openWindows,
  activeWindowId,
  onLaunchApp,
  onRestoreWindow,
  soundEnabled,
}) => {
  const [hoveredApp, setHoveredApp] = useState<AppId | null>(null);
  const [bouncingApp, setBouncingApp] = useState<AppId | null>(null);
  const [mouseX, setMouseX] = useState<number | null>(null);

  const handleAppClick = (appId: AppId) => {
    playOpenSound(soundEnabled);
    setBouncingApp(appId);
    setTimeout(() => setBouncingApp(null), 1000);
    onLaunchApp(appId);
  };

  const isAppOpen = (appId: AppId) => openWindows.some((w) => w.appId === appId);

  return (
    <div
      id="dock-container"
      className="fixed bottom-3 left-0 right-0 flex justify-center z-[8000] pointer-events-none"
    >
      <motion.div
        id="dock-bar"
        onMouseMove={(e) => setMouseX(e.clientX)}
        onMouseLeave={() => {
          setMouseX(null);
          setHoveredApp(null);
        }}
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="pointer-events-auto flex items-end gap-2 px-3 py-2 rounded-3xl bg-white/10 dark:bg-slate-950/40 backdrop-blur-3xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-white/10"
      >
        {DOCK_APPS.map((appId) => {
          const appDef = APP_REGISTRY[appId];
          const IconComponent = ICON_MAP[appDef.iconName] || Folder;
          const style = ICON_STYLES[appId];
          const isOpen = isAppOpen(appId);
          const isBouncing = bouncingApp === appId;

          return (
            <div
              key={appId}
              className="relative flex flex-col items-center group"
              onMouseEnter={() => setHoveredApp(appId)}
            >
              {/* Tooltip */}
              {hoveredApp === appId && (
                <div className="absolute -top-10 px-2.5 py-1 rounded-lg bg-slate-900/90 backdrop-blur-xl border border-white/15 text-white text-[11px] font-medium shadow-xl pointer-events-none whitespace-nowrap animate-in fade-in duration-150">
                  {appDef.name}
                </div>
              )}

              {/* App Icon Button with macOS squircle styling */}
              <motion.button
                id={`dock-app-${appId}`}
                onClick={() => handleAppClick(appId)}
                whileHover={{ scale: 1.18, y: -8 }}
                whileTap={{ scale: 0.94 }}
                animate={isBouncing ? { y: [-6, 0, -6, 0] } : {}}
                transition={{ duration: 0.3 }}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg relative overflow-hidden transition-all duration-200 ${style.bg}`}
              >
                {/* Gloss reflection overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-transparent to-black/20 pointer-events-none rounded-2xl" />
                <IconComponent size={24} className={`${style.iconColor} relative z-10 drop-shadow-md`} />
              </motion.button>

              {/* Running indicator dot */}
              <div className="h-1.5 flex items-center justify-center mt-1">
                {isOpen && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                )}
              </div>
            </div>
          );
        })}

        {/* Separator */}
        <div className="w-px h-8 bg-white/20 self-center mx-1" />

        {/* Trash */}
        <div
          className="relative flex flex-col items-center group"
          onMouseEnter={() => setHoveredApp('trash' as any)}
        >
          {hoveredApp === ('trash' as any) && (
            <div className="absolute -top-10 px-2.5 py-1 rounded-lg bg-slate-900/90 backdrop-blur-xl border border-white/15 text-white text-[11px] font-medium shadow-xl pointer-events-none whitespace-nowrap">
              Papelera
            </div>
          )}
          <motion.button
            id="dock-trash"
            whileHover={{ scale: 1.15, y: -6 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => playClickSound(soundEnabled)}
            className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-700/80 to-slate-500/80 border border-white/15 flex items-center justify-center shadow-lg"
          >
            <Trash2 size={22} className="text-slate-200 drop-shadow" />
          </motion.button>
          <div className="h-1.5" />
        </div>
      </motion.div>
    </div>
  );
};
