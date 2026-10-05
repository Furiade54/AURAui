import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  Battery, 
  BatteryCharging, 
  Search, 
  Sliders, 
  Volume2, 
  VolumeX, 
  Sparkles,
  Command
} from 'lucide-react';
import { AppId, SystemSettings } from '../types';
import { APP_REGISTRY } from '../data/systemData';

interface MenuBarProps {
  activeAppId: AppId | null;
  settings: SystemSettings;
  onOpenApp: (appId: AppId) => void;
  onToggleControlCenter: () => void;
  onToggleSpotlight: () => void;
  onToggleWidgets: () => void;
  isControlCenterOpen: boolean;
  isWidgetsOpen: boolean;
  onShutdown: () => void;
}

export const MenuBar: React.FC<MenuBarProps> = ({
  activeAppId,
  settings,
  onOpenApp,
  onToggleControlCenter,
  onToggleSpotlight,
  onToggleWidgets,
  isControlCenterOpen,
  isWidgetsOpen,
  onShutdown,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
      );
      setCurrentDate(
        now.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.menu-dropdown-container')) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeAppName = activeAppId ? APP_REGISTRY[activeAppId].name : 'Finder';

  return (
    <div
      id="top-menu-bar"
      className="fixed top-0 left-0 right-0 h-7 z-[9000] flex items-center justify-between px-3 text-xs font-medium bg-slate-950/40 backdrop-blur-xl border-b border-white/10 text-white/90 shadow-sm select-none"
    >
      {/* Left items: Apple Logo & App Menus */}
      <div className="flex items-center space-x-1">
        {/* Apple/Aura OS Logo */}
        <div className="relative menu-dropdown-container">
          <button
            id="aura-system-menu-btn"
            onClick={() => setOpenDropdown(openDropdown === 'apple' ? null : 'apple')}
            className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1.5 ${
              openDropdown === 'apple' ? 'bg-white/20' : 'hover:bg-white/10'
            }`}
          >
            <Sparkles size={13} className="text-indigo-300" />
            <span className="font-semibold tracking-wider text-[11px] text-white">Aura</span>
          </button>

          {openDropdown === 'apple' && (
            <div className="absolute top-7 left-0 w-56 rounded-xl py-1.5 bg-slate-900/90 backdrop-blur-2xl border border-white/15 shadow-2xl text-slate-200 z-[9999] animate-in fade-in duration-100">
              <button
                onClick={() => {
                  onOpenApp('settings');
                  setOpenDropdown(null);
                }}
                className="w-full text-left px-4 py-1.5 hover:bg-indigo-600 hover:text-white flex items-center justify-between text-xs"
              >
                <span>Acerca de este AuraOS</span>
                <span className="text-[10px] opacity-60">15.4</span>
              </button>
              <button
                onClick={() => {
                  onOpenApp('settings');
                  setOpenDropdown(null);
                }}
                className="w-full text-left px-4 py-1.5 hover:bg-indigo-600 hover:text-white flex items-center justify-between text-xs"
              >
                <span>Ajustes del Sistema...</span>
                <span className="text-[10px] opacity-60">⌘,</span>
              </button>
              <div className="h-px bg-white/10 my-1 mx-2" />
              <button
                onClick={() => {
                  onOpenApp('finder');
                  setOpenDropdown(null);
                }}
                className="w-full text-left px-4 py-1.5 hover:bg-indigo-600 hover:text-white text-xs"
              >
                Abrir Finder
              </button>
              <button
                onClick={() => {
                  onOpenApp('terminal');
                  setOpenDropdown(null);
                }}
                className="w-full text-left px-4 py-1.5 hover:bg-indigo-600 hover:text-white text-xs"
              >
                Lanzar Terminal
              </button>
              <div className="h-px bg-white/10 my-1 mx-2" />
              <button
                onClick={() => {
                  onShutdown();
                  setOpenDropdown(null);
                }}
                className="w-full text-left px-4 py-1.5 hover:bg-red-600/80 hover:text-white text-xs text-red-300 flex items-center justify-between"
              >
                <span>Reiniciar sesión...</span>
                <span className="text-[10px] opacity-60">⏻</span>
              </button>
            </div>
          )}
        </div>

        {/* Current Active App Name */}
        <span className="font-bold px-2 py-0.5 text-white tracking-wide">
          {activeAppName}
        </span>

        {/* Standard macOS Menu Items */}
        {['Archivo', 'Edición', 'Ver', 'Ventana', 'Ayuda'].map((menuName) => (
          <div key={menuName} className="relative menu-dropdown-container hidden sm:block">
            <button
              onClick={() => setOpenDropdown(openDropdown === menuName ? null : menuName)}
              className={`px-2.5 py-0.5 rounded transition-colors text-slate-200 text-xs ${
                openDropdown === menuName ? 'bg-white/20 text-white' : 'hover:bg-white/10'
              }`}
            >
              {menuName}
            </button>
            {openDropdown === menuName && (
              <div className="absolute top-7 left-0 w-48 rounded-xl py-1.5 bg-slate-900/90 backdrop-blur-2xl border border-white/15 shadow-2xl text-slate-200 z-[9999]">
                <div className="px-4 py-1.5 text-[11px] text-slate-400 font-medium">
                  {activeAppName} — {menuName}
                </div>
                <div className="h-px bg-white/10 my-1 mx-2" />
                <button
                  onClick={() => setOpenDropdown(null)}
                  className="w-full text-left px-4 py-1.5 hover:bg-indigo-600 hover:text-white text-xs flex justify-between"
                >
                  <span>Nueva Ventana</span>
                  <span className="text-[10px] opacity-60">⌘N</span>
                </button>
                <button
                  onClick={() => setOpenDropdown(null)}
                  className="w-full text-left px-4 py-1.5 hover:bg-indigo-600 hover:text-white text-xs flex justify-between"
                >
                  <span>Buscar</span>
                  <span className="text-[10px] opacity-60">⌘F</span>
                </button>
                <button
                  onClick={() => setOpenDropdown(null)}
                  className="w-full text-left px-4 py-1.5 hover:bg-indigo-600 hover:text-white text-xs flex justify-between"
                >
                  <span>Cerrar</span>
                  <span className="text-[10px] opacity-60">⌘W</span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Right items: System Status & Controls */}
      <div className="flex items-center space-x-1.5 sm:space-x-2">
        {/* Sound Indicator */}
        <div className="px-1.5 py-0.5 text-slate-300">
          {settings.volume > 0 ? <Volume2 size={13} /> : <VolumeX size={13} className="text-red-400" />}
        </div>

        {/* Wi-Fi */}
        <div className="px-1.5 py-0.5 text-slate-300">
          {settings.wifiEnabled ? <Wifi size={13} /> : <WifiOff size={13} className="text-slate-500" />}
        </div>

        {/* Battery */}
        <div className="flex items-center space-x-1 text-slate-300 text-[11px] px-1.5 py-0.5">
          <span>98%</span>
          <BatteryCharging size={14} className="text-emerald-400" />
        </div>

        {/* Spotlight Trigger */}
        <button
          id="btn-spotlight-trigger"
          onClick={onToggleSpotlight}
          className="p-1 rounded hover:bg-white/15 transition-colors text-slate-200"
          title="Spotlight Search (Cmd+K)"
        >
          <Search size={13} />
        </button>

        {/* Control Center Toggle */}
        <button
          id="btn-control-center-trigger"
          onClick={onToggleControlCenter}
          className={`p-1 rounded transition-colors ${
            isControlCenterOpen ? 'bg-white/25 text-white' : 'hover:bg-white/15 text-slate-200'
          }`}
          title="Centro de Control"
        >
          <Sliders size={13} />
        </button>

        {/* Clock & Widgets Panel Trigger */}
        <button
          id="btn-clock-widgets-trigger"
          onClick={onToggleWidgets}
          className={`px-2 py-0.5 rounded transition-colors text-slate-100 flex items-center space-x-1.5 ${
            isWidgetsOpen ? 'bg-white/20' : 'hover:bg-white/10'
          }`}
          title="Notificaciones y Widgets"
        >
          <span className="hidden md:inline font-normal text-slate-300">{currentDate}</span>
          <span className="font-semibold">{currentTime || '12:00'}</span>
        </button>
      </div>
    </div>
  );
};
