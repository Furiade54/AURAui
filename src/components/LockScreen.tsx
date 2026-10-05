import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sparkles, ArrowRight, User } from 'lucide-react';
import { Wallpaper } from '../types';

interface LockScreenProps {
  wallpaper: Wallpaper;
  onUnlock: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ wallpaper, onUnlock }) => {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
      setDate(now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      id="lock-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.3 }}
      style={{ background: wallpaper.gradient }}
      className="fixed inset-0 z-[10000] flex flex-col items-center justify-between py-16 px-4 select-none backdrop-blur-xl"
    >
      {/* Dynamic backdrop darkener */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-2xl pointer-events-none" />

      {/* Top Clock */}
      <div className="relative z-10 flex flex-col items-center text-center mt-6">
        <h1 className="text-7xl sm:text-8xl font-extralight tracking-tight text-white drop-shadow-lg font-sans">
          {time}
        </h1>
        <p className="text-base font-medium text-slate-200 capitalize mt-2 drop-shadow">
          {date}
        </p>
      </div>

      {/* User Login Card */}
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-500 to-rose-500 p-0.5 shadow-2xl flex items-center justify-center">
          <div className="w-full h-full rounded-full bg-slate-900/80 backdrop-blur-md flex items-center justify-center text-white">
            <User size={36} className="text-slate-200" />
          </div>
        </div>

        <div className="text-center">
          <div className="text-lg font-semibold text-white tracking-wide">Usuario Invitado</div>
          <div className="text-xs text-slate-300">Toca para desbloquear AuraOS</div>
        </div>

        <button
          id="btn-unlock-screen"
          onClick={onUnlock}
          className="mt-2 px-6 py-2.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-xl border border-white/30 text-white font-medium text-sm flex items-center gap-2 shadow-xl hover:scale-105 active:scale-95 transition-all"
        >
          <span>Ingresar al Sistema</span>
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Footer info */}
      <div className="relative z-10 text-[11px] text-slate-400 font-medium tracking-wider flex items-center gap-1.5">
        <Sparkles size={13} className="text-indigo-400" />
        <span>AURAOS SEQUOIA • NÚCLEO WEBGL</span>
      </div>
    </motion.div>
  );
};
