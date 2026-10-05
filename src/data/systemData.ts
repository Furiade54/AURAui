import { Wallpaper, FileItem, NoteItem, SongTrack, AppId } from '../types';

export const WALLPAPERS: Wallpaper[] = [
  {
    id: 'server-rack',
    name: 'Datacenter Rack',
    gradient:
      'radial-gradient(at 0% 0%, #064e3b 0px, transparent 50%), radial-gradient(at 100% 0%, #0369a1 0px, transparent 50%), radial-gradient(at 100% 100%, #4c1d95 0px, transparent 50%), radial-gradient(at 0% 100%, #0f172a 0px, transparent 50%), linear-gradient(135deg, #020617 0%, #0c4a6e 50%, #022c22 100%)',
    previewColor: '#0ea5e9',
    accent: '#34d399',
    type: 'mesh',
  },
  {
    id: 'cyber-aurora',
    name: 'Cyber Aurora',
    gradient:
      'radial-gradient(at 20% 20%, #064e3b 0px, transparent 50%), radial-gradient(at 80% 0%, #047857 0px, transparent 50%), radial-gradient(at 10% 90%, #0e7490 0px, transparent 50%), radial-gradient(at 90% 80%, #10b981 0px, transparent 40%), linear-gradient(145deg, #022c22 0%, #064e3b 60%, #042f2e 100%)',
    previewColor: '#10b981',
    accent: '#34d399',
    type: 'mesh',
  },
  {
    id: 'deep-space',
    name: 'Deep Cosmos',
    gradient:
      'radial-gradient(at 50% 40%, #2e1065 0px, transparent 60%), radial-gradient(at 90% 90%, #0369a1 0px, transparent 50%), radial-gradient(at 10% 80%, #4c0519 0px, transparent 50%), linear-gradient(180deg, #09090b 0%, #18181b 100%)',
    previewColor: '#2e1065',
    accent: '#c084fc',
    type: 'cosmic',
  },
  {
    id: 'glass-monochrome',
    name: 'Obsidian Minimal',
    gradient:
      'radial-gradient(at 50% 0%, #334155 0px, transparent 60%), radial-gradient(at 100% 100%, #1e293b 0px, transparent 50%), linear-gradient(180deg, #0f172a 0%, #020617 100%)',
    previewColor: '#334155',
    accent: '#94a3b8',
    type: 'minimal',
  },
];

export const INITIAL_FILES: FileItem[] = [
  {
    id: 'folder-docs',
    name: 'Documentos',
    type: 'folder',
    size: '--',
    modified: 'Hoy, 10:15',
    path: '/Documentos',
  },
  {
    id: 'folder-projects',
    name: 'Proyectos',
    type: 'folder',
    size: '--',
    modified: 'Ayer, 18:40',
    path: '/Proyectos',
  },
  {
    id: 'folder-images',
    name: 'Imágenes',
    type: 'folder',
    size: '--',
    modified: '12 Sep, 09:20',
    path: '/Imágenes',
  },
  {
    id: 'file-readme',
    name: 'Bienvenido_VPS_Monitor.txt',
    type: 'text',
    size: '1.4 KB',
    modified: 'Hoy, 08:00',
    path: '/Documentos/Bienvenido_VPS_Monitor.txt',
    parentId: 'folder-docs',
    content: `🖥️ Bienvenido a AuraUI — VPS Monitor Panel ✨\n\nPanel de control para tu VPS Ubuntu con diseño tipo macOS.\n\n🚀 Características:\n• Dashboard con métricas en tiempo real (CPU, RAM, Disco, Red)\n• Terminal SSH interactiva por WebSocket\n• Gestor de procesos (kill, señal, filtrado)\n• Gestor Docker: containers, imágenes, volúmenes, logs\n• Gestor de servicios systemd: start/stop/enable\n• Explorador de archivos SFTP vía SSH\n\n🔌 Primero abre "Ajustes" y configura host, usuario y contraseña/clave de tu VPS. Luego pulsa "Probar Conexión".`,
  },
];

export const INITIAL_NOTES: NoteItem[] = [
  {
    id: 'note-1',
    title: 'Checklist de VPS',
    content: `• Configurar clave SSH sin contraseña\n• Instalar Docker + docker compose\n• Habilitar firewall ufw\n• Configurar swap 2GB\n• Activar updates automáticos (unattended-upgrades)\n• Monitorizar con fail2ban`,
    category: 'Sysadmin',
    updatedAt: 'Hoy, 10:45',
  },
];

export const SONGS: SongTrack[] = [];

export interface AppDefinition {
  id: AppId;
  name: string;
  iconName: string;
  defaultWidth: number;
  defaultHeight: number;
  defaultTitle: string;
  category: string;
}

export const APP_REGISTRY: Record<AppId, AppDefinition> = {
  dashboard: {
    id: 'dashboard',
    name: 'Monitor',
    iconName: 'Activity',
    defaultWidth: 960,
    defaultHeight: 600,
    defaultTitle: 'Dashboard — Monitor VPS',
    category: 'Monitorización',
  },
  packages: {
    id: 'packages',
    name: 'Instalador',
    iconName: 'Package',
    defaultWidth: 960,
    defaultHeight: 600,
    defaultTitle: 'Instalador APT — Paquetes Ubuntu',
    category: 'Sistema',
  },
  terminal: {
    id: 'terminal',
    name: 'Terminal SSH',
    iconName: 'Terminal',
    defaultWidth: 760,
    defaultHeight: 460,
    defaultTitle: 'SSH — Terminal VPS',
    category: 'Sistema',
  },
  processes: {
    id: 'processes',
    name: 'Procesos',
    iconName: 'Cpu',
    defaultWidth: 880,
    defaultHeight: 560,
    defaultTitle: 'Gestor de Procesos — htop',
    category: 'Monitorización',
  },
  docker: {
    id: 'docker',
    name: 'Docker',
    iconName: 'Container',
    defaultWidth: 920,
    defaultHeight: 580,
    defaultTitle: 'Gestor Docker',
    category: 'Contenedores',
  },
  services: {
    id: 'services',
    name: 'Servicios',
    iconName: 'Server',
    defaultWidth: 880,
    defaultHeight: 560,
    defaultTitle: 'Gestor de Servicios — systemd',
    category: 'Sistema',
  },
  files: {
    id: 'files',
    name: 'Archivos',
    iconName: 'Folder',
    defaultWidth: 820,
    defaultHeight: 500,
    defaultTitle: 'Explorador SFTP',
    category: 'Sistema',
  },
  settings: {
    id: 'settings',
    name: 'Ajustes',
    iconName: 'Settings',
    defaultWidth: 760,
    defaultHeight: 520,
    defaultTitle: 'Ajustes — Conexión VPS',
    category: 'Sistema',
  },
};
