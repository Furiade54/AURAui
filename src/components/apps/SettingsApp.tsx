import React, { useEffect, useState } from 'react';
import {
  Palette,
  Image as ImageIcon,
  Sliders,
  Info,
  HardDrive,
  Check,
  Sparkles,
  Volume2,
  SunMedium,
  Server,
  KeyRound,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Lock,
  Zap,
  Unplug,
} from 'lucide-react';
import { SystemSettings, VpsConnectionConfig } from '../../types';
import { WALLPAPERS } from '../../data/systemData';
import { api, setVpsConfig, getVpsConfig } from '../../lib/api';

interface SettingsAppProps {
  settings: SystemSettings;
  onUpdateSettings: (newSettings: Partial<SystemSettings>) => void;
}

const ACCENT_COLORS = [
  { name: 'Azul Eléctrico', class: 'bg-blue-500', hex: '#3b82f6' },
  { name: 'Púrpura Aura', class: 'bg-purple-500', hex: '#a855f7' },
  { name: 'Esmeralda Cíber', class: 'bg-emerald-500', hex: '#10b981' },
  { name: 'Rosa Neón', class: 'bg-pink-500', hex: '#ec4899' },
  { name: 'Ámbar Cálido', class: 'bg-amber-500', hex: '#f59e0b' },
  { name: 'Rojo VPS', class: 'bg-rose-500', hex: '#f43f5e' },
];

type AuthMode = 'password' | 'key';
type SectionKey = 'vps' | 'wallpapers' | 'appearance' | 'display' | 'about';

export const SettingsApp: React.FC<SettingsAppProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const [activeSection, setActiveSection] = useState<SectionKey>('vps');
  const [cfg, setCfg] = useState<VpsConnectionConfig>(() => getVpsConfig());
  const [authMode, setAuthMode] = useState<AuthMode>((cfg.password || !cfg.privateKey) && cfg.password ? 'password' : (cfg.privateKey ? 'key' : 'password'));
  const [testState, setTestState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testResult, setTestResult] = useState<{ ok?: boolean; msg?: string }>({});

  useEffect(() => {
    setVpsConfig(cfg);
    try {
      const saveable: VpsConnectionConfig = { ...cfg };
      window.localStorage.setItem('vps_config', JSON.stringify(saveable));
    } catch {}
  }, [cfg]);

  const updateCfg = (patch: Partial<VpsConnectionConfig>) =>
    setCfg((p) => ({ ...p, ...patch }));

  const runTest = async () => {
    setTestState('loading');
    setTestResult({});
    try {
      const r = await api.testVps(cfg);
      setTestState(r.ok ? 'success' : 'error');
      setTestResult({
        ok: !!r.ok,
        msg: r.ok ? `Conectado como ${r.whoami}@${r.config?.host || cfg.host}` : 'Conexión fallida',
      });
    } catch (e: any) {
      setTestState('error');
      setTestResult({ ok: false, msg: e?.message || String(e) });
    }
  };

  const runDisconnect = async () => {
    try {
      await api.disconnectVps();
      setTestState('idle');
      setTestResult({ msg: 'Sesión SSH cerrada en backend.' });
    } catch (e: any) {
      setTestState('error');
      setTestResult({ ok: false, msg: e?.message || String(e) });
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-900/50 text-slate-100 select-none">
      {/* Sidebar */}
      <div className="w-56 bg-black/30 border-r border-white/10 p-3 flex flex-col gap-1 text-xs overflow-y-auto">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
          VPS Monitor
        </div>
        <SidebarBtn
          label="Conexión VPS"
          Icon={Server}
          active={activeSection === 'vps'}
          onClick={() => setActiveSection('vps')}
        />

        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1 mt-2">
          Ajustes UI
        </div>
        <SidebarBtn
          label="Fondos de Pantalla"
          Icon={ImageIcon}
          active={activeSection === 'wallpapers'}
          onClick={() => setActiveSection('wallpapers')}
        />
        <SidebarBtn
          label="Aspecto y Cristal"
          Icon={Palette}
          active={activeSection === 'appearance'}
          onClick={() => setActiveSection('appearance')}
        />
        <SidebarBtn
          label="Pantalla y Sonido"
          Icon={Sliders}
          active={activeSection === 'display'}
          onClick={() => setActiveSection('display')}
        />

        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1 mt-2">
          Sistema
        </div>
        <SidebarBtn
          label="Acerca de"
          Icon={Info}
          active={activeSection === 'about'}
          onClick={() => setActiveSection('about')}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-950/20">
        {activeSection === 'vps' && (
          <div className="flex flex-col gap-5 max-w-2xl">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Server size={18} className="text-emerald-400" />
                Conexión SSH con la VPS Ubuntu
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Estos datos se guardan en el navegador y se envían al backend Express, que se conecta por SSH.
                El backend también soporta variables <code className="bg-white/10 px-1 rounded">VPS_HOST</code>, <code className="bg-white/10 px-1 rounded">VPS_USER</code>, etc.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Host / IP VPS" icon={<Server size={13} />}>
                <input
                  value={cfg.host || ''}
                  onChange={(e) => updateCfg({ host: e.target.value })}
                  placeholder="192.168.1.100"
                  className={inputCls}
                />
              </Field>
              <Field label="Puerto SSH" icon={<Lock size={13} />}>
                <input
                  type="number"
                  value={cfg.port ?? 22}
                  onChange={(e) => updateCfg({ port: Number(e.target.value) || 22 })}
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Usuario" icon={<KeyRound size={13} />}>
              <input
                value={cfg.username || ''}
                onChange={(e) => updateCfg({ username: e.target.value })}
                placeholder="root o ubuntu"
                className={inputCls}
              />
            </Field>

            <div className="flex gap-1 rounded-xl bg-white/5 border border-white/10 p-1 w-fit text-xs">
              <button
                onClick={() => setAuthMode('password')}
                className={`px-3 py-1.5 rounded-lg ${authMode === 'password' ? 'bg-emerald-500/25 text-emerald-200' : 'text-slate-300 hover:text-white'}`}
              >
                🔑 Contraseña
              </button>
              <button
                onClick={() => setAuthMode('key')}
                className={`px-3 py-1.5 rounded-lg ${authMode === 'key' ? 'bg-sky-500/25 text-sky-200' : 'text-slate-300 hover:text-white'}`}
              >
                🔐 Clave privada (PEM)
              </button>
            </div>

            {authMode === 'password' ? (
              <Field label="Contraseña SSH" icon={<Lock size={13} />}>
                <input
                  type="password"
                  value={cfg.password || ''}
                  onChange={(e) => updateCfg({ password: e.target.value })}
                  placeholder="••••••••"
                  className={inputCls}
                />
              </Field>
            ) : (
              <>
                <Field label="Clave privada (contenido PEM)" icon={<KeyRound size={13} />}>
                  <textarea
                    value={cfg.privateKey || ''}
                    onChange={(e) => updateCfg({ privateKey: e.target.value })}
                    placeholder={'-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----'}
                    rows={6}
                    className={`${inputCls} font-mono text-[11px] resize-y`}
                  />
                </Field>
                <Field label="Passphrase de la clave (si tiene)" icon={<Lock size={13} />}>
                  <input
                    type="password"
                    value={cfg.passphrase || ''}
                    onChange={(e) => updateCfg({ passphrase: e.target.value })}
                    placeholder="opcional"
                    className={inputCls}
                  />
                </Field>
              </>
            )}

            {testResult.msg && (
              <div
                className={`rounded-xl p-3 border text-xs flex items-start gap-2 ${
                  testState === 'error' || testResult.ok === false
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                    : testState === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                    : 'bg-slate-700/30 border-white/10 text-slate-200'
                }`}
              >
                {testState === 'success' ? (
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                ) : testState === 'error' ? (
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                ) : (
                  <Sparkles size={16} className="mt-0.5 shrink-0 text-sky-300" />
                )}
                <div className="break-all">{testResult.msg}</div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={runTest}
                disabled={testState === 'loading'}
                className="px-4 py-2 rounded-xl bg-emerald-500/30 hover:bg-emerald-500/50 disabled:opacity-60 text-emerald-100 flex items-center gap-2 text-xs font-semibold border border-emerald-500/30"
              >
                <RefreshCw size={13} className={testState === 'loading' ? 'animate-spin' : ''} />
                Probar conexión SSH
              </button>
              <button
                onClick={runDisconnect}
                className="px-4 py-2 rounded-xl bg-slate-500/30 hover:bg-slate-500/50 text-slate-100 flex items-center gap-2 text-xs border border-white/10"
              >
                <Unplug size={13} />
                Cerrar sesión SSH
              </button>
              <button
                onClick={() => {
                  setCfg({});
                  try { window.localStorage.removeItem('vps_config'); } catch {}
                  setAuthMode('password');
                }}
                className="ml-auto px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-100 flex items-center gap-2 text-xs border border-rose-500/30"
              >
                Limpiar configuración
              </button>
            </div>

            <div className="rounded-2xl p-4 bg-slate-900/60 border border-white/10 text-xs text-slate-300 space-y-2">
              <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                <Zap size={14} className="text-amber-300" />
                Sugerencias antes de probar
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400">
                <li>Abre el puerto SSH (por defecto 22) en el firewall de la VPS / ufw.</li>
                <li>Usa un usuario con privilegios <code className="bg-white/10 px-1 rounded">sudo</code> para gestionar Docker y systemd.</li>
                <li>
                  En <code className="bg-white/10 px-1 rounded">.env</code> puedes definir variables <code className="bg-white/10 px-1 rounded">VPS_*</code> para no tener que introducirlas en la UI.
                </li>
                <li>
                  Arranca el backend con <code className="bg-white/10 px-1 rounded">pnpm dev</code> (Vite + Express concurrentes).
                </li>
              </ul>
            </div>
          </div>
        )}

        {activeSection === 'wallpapers' && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-base font-bold text-white">Fondos de Pantalla Dinámicos</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Selecciona un degradado para tu escritorio.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              {WALLPAPERS.map((wp) => {
                const isSelected = settings.wallpaperId === wp.id;
                return (
                  <div
                    key={wp.id}
                    onClick={() => onUpdateSettings({ wallpaperId: wp.id })}
                    className={`group rounded-2xl p-1.5 cursor-pointer border-2 transition-all ${
                      isSelected ? 'border-blue-500 shadow-xl scale-[1.02]' : 'border-white/10 hover:border-white/30'
                    }`}
                  >
                    <div
                      style={{ background: wp.gradient }}
                      className="h-24 rounded-xl shadow-inner relative flex items-end p-2 overflow-hidden"
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-md">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <div className="px-1 pt-1.5 flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">{wp.name}</span>
                      <span className="text-[10px] text-slate-400 uppercase">{wp.type}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeSection === 'appearance' && (
          <div className="flex flex-col gap-6 max-w-xl">
            <div>
              <h2 className="text-base font-bold text-white">Aspecto del Sistema y Cristal</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Personaliza la intensidad del desenfoque translúcido y los colores de acento.
              </p>
            </div>

            <Field label="Modo de Interfaz">
              <div className="grid grid-cols-2 gap-3 max-w-sm">
                <button
                  onClick={() => onUpdateSettings({ theme: 'dark' })}
                  className={`p-3 rounded-2xl border text-center transition-all ${
                    settings.theme === 'dark' ? 'bg-white/15 border-blue-500' : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="h-10 rounded-lg bg-slate-900 border border-white/20 mb-2" />
                  <span className="text-xs font-medium">Modo Oscuro</span>
                </button>
                <button
                  onClick={() => onUpdateSettings({ theme: 'light' })}
                  className={`p-3 rounded-2xl border text-center transition-all ${
                    settings.theme === 'light' ? 'bg-white/15 border-blue-500' : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="h-10 rounded-lg bg-slate-200 border border-black/20 mb-2" />
                  <span className="text-xs font-medium">Modo Claro</span>
                </button>
              </div>
            </Field>

            <Field label="Intensidad de Desenfoque del Cristal">
              <div className="grid grid-cols-3 gap-2.5 max-w-md">
                {(['low', 'medium', 'high'] as const).map((level) => {
                  const isSelected = settings.blurIntensity === level;
                  return (
                    <button
                      key={level}
                      onClick={() => onUpdateSettings({ blurIntensity: level })}
                      className={`py-2 px-3 rounded-xl border text-xs font-medium capitalize transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-400 shadow-md'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {level === 'low' ? 'Bajo' : level === 'medium' ? 'Medio' : 'Ultra'}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Color de Acento">
              <div className="flex items-center gap-3 flex-wrap">
                {ACCENT_COLORS.map((col) => (
                  <button
                    key={col.hex}
                    onClick={() => onUpdateSettings({ accentColor: col.hex })}
                    className={`w-8 h-8 rounded-full ${col.class} shadow-md transition-transform flex items-center justify-center ${
                      settings.accentColor === col.hex
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110'
                        : 'hover:scale-105'
                    }`}
                    title={col.name}
                  >
                    {settings.accentColor === col.hex && <Check size={14} className="text-white" strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        )}

        {activeSection === 'display' && (
          <div className="flex flex-col gap-6 max-w-md">
            <div>
              <h2 className="text-base font-bold text-white">Pantalla y Efectos de Audio</h2>
              <p className="text-xs text-slate-400 mt-0.5">Controla la salida multimedia y el brillo.</p>
            </div>
            <SliderCard
              label="Brillo"
              Icon={SunMedium}
              value={settings.brightness}
              min={20}
              max={100}
              suffix="%"
              onChange={(v) => onUpdateSettings({ brightness: v })}
            />
            <SliderCard
              label="Volumen del Sistema"
              Icon={Volume2}
              value={settings.volume}
              min={0}
              max={100}
              suffix="%"
              onChange={(v) => onUpdateSettings({ volume: v })}
            />
            <label className="flex items-center gap-2 text-xs bg-white/5 border border-white/10 rounded-xl p-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!settings.soundEnabled}
                onChange={(e) => onUpdateSettings({ soundEnabled: e.target.checked })}
                className="w-4 h-4 accent-emerald-500"
              />
              <span>Habilitar efectos de sonido (apertura de apps, clicks)</span>
            </label>
          </div>
        )}

        {activeSection === 'about' && (
          <div className="flex flex-col items-center text-center gap-4 py-4 max-w-md mx-auto">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 via-sky-500 to-indigo-500 p-0.5 shadow-2xl flex items-center justify-center">
              <div className="w-full h-full rounded-[22px] bg-slate-900 flex items-center justify-center">
                <Server size={36} className="text-emerald-400" />
              </div>
            </div>

            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">AuraUI VPS Monitor</h1>
              <div className="text-xs text-slate-400 mt-0.5">Versión 1.0 (Panel VPS Ubuntu)</div>
              <div className="text-[11px] text-emerald-400 font-medium mt-1">
                SSH2 · Express · WebSocket · React 19 · Vite · Tailwind 4
              </div>
            </div>

            <div className="w-full rounded-2xl bg-white/5 border border-white/10 p-4 text-left text-xs flex flex-col gap-2.5">
              <InfoRow label="Frontend" value="Vite + React 19 + Tailwind v4" />
              <InfoRow label="Backend" value="Express + SSH2 + WebSocket (ws)" />
              <InfoRow label="Monitorización" value="top, free, df, /proc/net/dev, ps, docker, systemctl" />
              <InfoRow label="Terminal real" value="SSH PTY por WebSocket (/ws/terminal)" />
            </div>

            <div className="w-full rounded-2xl bg-white/5 border border-white/10 p-4 text-left text-xs flex flex-col gap-2">
              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-1.5 font-medium">
                  <HardDrive size={14} className="text-sky-400" /> Almacenamiento SSD
                </span>
                <span className="font-mono text-[11px] text-slate-400">Configurable por VPS</span>
              </div>
              <div className="h-2.5 w-full bg-white/10 rounded-full overflow-hidden flex">
                <div className="h-full bg-emerald-500 w-[35%]" title="Sistema" />
                <div className="h-full bg-amber-400 w-[15%]" title="Contenedores Docker" />
                <div className="h-full bg-sky-500 w-[10%]" title="Logs / backups" />
              </div>
              <div className="flex gap-4 text-[10px] text-slate-400 mt-1 flex-wrap">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Sistema</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Docker</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500" /> Logs</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const inputCls =
  'w-full px-3 py-2 text-xs rounded-lg bg-slate-900/70 border border-white/10 focus:border-emerald-500/50 focus:outline-none placeholder:text-slate-500 text-slate-100';

const SidebarBtn: React.FC<{
  label: string;
  Icon: any;
  active: boolean;
  onClick: () => void;
}> = ({ label, Icon, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-2.5 transition-colors ${
      active
        ? 'bg-emerald-600 text-white font-medium shadow-md'
        : 'hover:bg-white/5 text-slate-300'
    }`}
  >
    <Icon size={15} /> {label}
  </button>
);

const Field: React.FC<{
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, icon, children }) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
      {icon}
      {label}
    </span>
    {children}
  </div>
);

const SliderCard: React.FC<{
  label: string;
  Icon: any;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (v: number) => void;
}> = ({ label, Icon, value, min, max, suffix, onChange }) => (
  <div className="rounded-2xl p-4 bg-white/5 border border-white/10 flex flex-col gap-2">
    <div className="flex justify-between text-xs font-semibold text-slate-200">
      <span className="flex items-center gap-1.5">
        <Icon size={15} /> {label}
      </span>
      <span className="font-mono">
        {value}
        {suffix}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-emerald-500 cursor-pointer h-2 bg-white/20 rounded-lg appearance-none"
    />
  </div>
);

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between gap-3 border-b border-white/5 pb-2 last:border-0 last:pb-0">
    <span className="text-slate-400 shrink-0">{label}</span>
    <span className="font-semibold text-white text-right">{value}</span>
  </div>
);
