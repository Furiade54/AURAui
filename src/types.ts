export type AppId =
  | 'dashboard'
  | 'terminal'
  | 'processes'
  | 'docker'
  | 'services'
  | 'files'
  | 'settings'
  | 'packages';

export interface WindowState {
  id: string;
  appId: AppId;
  title: string;
  icon: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  prevPosition?: { x: number; y: number; width: number; height: number };
  customData?: any;
}

export interface Wallpaper {
  id: string;
  name: string;
  gradient: string;
  previewColor: string;
  accent: string;
  type: 'mesh' | 'cosmic' | 'minimal' | 'gradient';
}

export interface SystemSettings {
  wallpaperId: string;
  blurIntensity: 'low' | 'medium' | 'high';
  accentColor: string;
  theme: 'dark' | 'light';
  soundEnabled: boolean;
  dockSize: number;
  dockMagnification: boolean;
  volume: number;
  brightness: number;
  wifiEnabled: boolean;
  bluetoothEnabled: boolean;
  airDropEnabled: boolean;
  dndEnabled: boolean;
}

export interface FileItem {
  id: string;
  name: string;
  type: 'folder' | 'text' | 'image' | 'code' | 'audio';
  size: string;
  modified: string;
  path: string;
  content?: string;
  previewUrl?: string;
  icon?: string;
  parentId?: string;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  category: string;
  updatedAt: string;
}

export interface SongTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  cover: string;
  bpm: number;
}

export interface VpsConnectionConfig {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface VpsConnectionStatus {
  connected: boolean;
  hostname?: string;
  whoami?: string;
  lastCheck?: string;
  error?: string;
}
