import React from 'react';
import { motion } from 'motion/react';
import { 
  Wifi, 
  Bluetooth, 
  Share2, 
  Moon, 
  Sun, 
  Volume2, 
  SunMedium, 
  VolumeX, 
  BellOff, 
  Music,
  Check
} from 'lucide-react';
import { SystemSettings } from '../types';

interface ControlCenterProps {
  settings: SystemSettings;
  onUpdateSettings: (newSettings: Partial<SystemSettings>) => void;
  onClose: () => void;
}

export const ControlCenter: React.FC<ControlCenterProps> = ({
  settings,
  onUpdateSettings,
  onClose,
}) => {
  return (
    <motion.div
      id="control-center-panel"
      initial={{ opacity: 0, y: -10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.96 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="fixed top-9 right-3 w-80 rounded-2xl p-3.5 bg-slate-900/70 backdrop-blur-3xl border border-white/15 shadow-2xl text-slate-100 z-[9500] select-none flex flex-col gap-3 ring-1 ring-black/20"
    >
      {/* Top 2-column block */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Left Column: Connectivity toggles */}
        <div className="rounded-xl p-2.5 bg-white/10 border border-white/10 flex flex-col gap-2.5">
          {/* Wi-Fi */}
          <button
            onClick={() => onUpdateSettings({ wifiEnabled: !settings.wifiEnabled })}
            className="flex items-center gap-2.5 text-left w-full group"
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                settings.wifiEnabled ? 'bg-blue-500 text-white' : 'bg-white/10 text-slate-400'
              }`}
            >
              <Wifi size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold leading-tight text-white">Wi-Fi</div>
              <div className="text-[10px] text-slate-400 truncate">
                {settings.wifiEnabled ? 'Aura-Fiber 5G' : 'Desactivado'}
              </div>
            </div>
          </button>

          {/* Bluetooth */}
          <button
            onClick={() => onUpdateSettings({ bluetoothEnabled: !settings.bluetoothEnabled })}
            className="flex items-center gap-2.5 text-left w-full group"
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                settings.bluetoothEnabled ? 'bg-blue-500 text-white' : 'bg-white/10 text-slate-400'
              }`}
            >
              <Bluetooth size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold leading-tight text-white">Bluetooth</div>
              <div className="text-[10px] text-slate-400 truncate">
                {settings.bluetoothEnabled ? 'AirPods Pro 2' : 'Desactivado'}
              </div>
            </div>
          </button>

          {/* AirDrop */}
          <button
            onClick={() => onUpdateSettings({ airDropEnabled: !settings.airDropEnabled })}
            className="flex items-center gap-2.5 text-left w-full group"
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                settings.airDropEnabled ? 'bg-blue-500 text-white' : 'bg-white/10 text-slate-400'
              }`}
            >
              <Share2 size={13} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold leading-tight text-white">AirDrop</div>
              <div className="text-[10px] text-slate-400 truncate">
                {settings.airDropEnabled ? 'Solo contactos' : 'Desactivado'}
              </div>
            </div>
          </button>
        </div>

        {/* Right Column: Focus & Dark Mode */}
        <div className="flex flex-col gap-2.5">
          {/* Focus / No Molestar */}
          <button
            onClick={() => onUpdateSettings({ dndEnabled: !settings.dndEnabled })}
            className={`flex-1 rounded-xl p-2.5 border transition-all text-left flex items-center gap-2.5 ${
              settings.dndEnabled
                ? 'bg-purple-600/30 border-purple-500/40 text-purple-200'
                : 'bg-white/10 border-white/10 text-slate-200 hover:bg-white/15'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center ${
                settings.dndEnabled ? 'bg-purple-500 text-white' : 'bg-white/10 text-slate-400'
              }`}
            >
              <BellOff size={13} />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Concentración</div>
              <div className="text-[10px] text-slate-400">
                {settings.dndEnabled ? 'No molestar' : 'Inactivo'}
              </div>
            </div>
          </button>

          {/* Dark/Light Mode */}
          <button
            onClick={() => onUpdateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
            className="flex-1 rounded-xl p-2.5 bg-white/10 border border-white/10 hover:bg-white/15 transition-all text-left flex items-center gap-2.5"
          >
            <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center">
              {settings.theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Aspecto</div>
              <div className="text-[10px] text-slate-400 capitalize">Modo {settings.theme}</div>
            </div>
          </button>
        </div>
      </div>

      {/* Brightness Slider */}
      <div className="rounded-xl p-2.5 bg-white/10 border border-white/10 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px] font-medium text-slate-300">
          <span className="flex items-center gap-1.5">
            <SunMedium size={13} /> Brillo de Pantalla
          </span>
          <span>{settings.brightness}%</span>
        </div>
        <input
          type="range"
          min="20"
          max="100"
          value={settings.brightness}
          onChange={(e) => onUpdateSettings({ brightness: Number(e.target.value) })}
          className="w-full accent-blue-500 cursor-pointer h-2 bg-white/20 rounded-lg appearance-none"
        />
      </div>

      {/* Volume Slider */}
      <div className="rounded-xl p-2.5 bg-white/10 border border-white/10 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px] font-medium text-slate-300">
          <span className="flex items-center gap-1.5">
            {settings.volume > 0 ? <Volume2 size={13} /> : <VolumeX size={13} />} Volumen
          </span>
          <span>{settings.volume}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={settings.volume}
          onChange={(e) => onUpdateSettings({ volume: Number(e.target.value) })}
          className="w-full accent-blue-500 cursor-pointer h-2 bg-white/20 rounded-lg appearance-none"
        />
      </div>

      {/* Tactile Sound FX switch */}
      <div className="flex items-center justify-between px-2 text-xs text-slate-300">
        <span>Efectos de sonido hápticos</span>
        <button
          onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
          className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
            settings.soundEnabled ? 'bg-emerald-500' : 'bg-slate-600'
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-white transition-transform ${
              settings.soundEnabled ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </motion.div>
  );
};
