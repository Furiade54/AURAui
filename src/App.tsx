/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import { 
  AppId, 
  WindowState, 
  SystemSettings, 
  FileItem, 
  NoteItem, 
  Wallpaper 
} from './types';
import { 
  APP_REGISTRY, 
  WALLPAPERS, 
  INITIAL_FILES, 
  INITIAL_NOTES 
} from './data/systemData';
import { MenuBar } from './components/MenuBar';
import { Dock } from './components/Dock';
import { Desktop } from './components/Desktop';
import { WindowFrame } from './components/WindowFrame';
import { ControlCenter } from './components/ControlCenter';
import { WidgetsPanel } from './components/WidgetsPanel';
import { Spotlight } from './components/Spotlight';
import { LockScreen } from './components/LockScreen';

// Apps VPS
import { MonitorDashboardApp } from './components/apps/MonitorDashboardApp';
import { SSHTerminalApp } from './components/apps/SSHTerminalApp';
import { ProcessManagerApp } from './components/apps/ProcessManagerApp';
import { DockerManagerApp } from './components/apps/DockerManagerApp';
import { ServicesManagerApp } from './components/apps/ServicesManagerApp';
import { FileExplorerApp } from './components/apps/FileExplorerApp';
import { SettingsApp } from './components/apps/SettingsApp';
import { PackageManagerApp } from './components/apps/PackageManagerApp';

export default function App() {
  // System settings state
  const [settings, setSettings] = useState<SystemSettings>(() => {
    const saved = localStorage.getItem('aura_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return {
      wallpaperId: 'sonoma-twilight',
      blurIntensity: 'medium',
      accentColor: '#3b82f6',
      theme: 'dark',
      soundEnabled: true,
      dockSize: 48,
      dockMagnification: true,
      volume: 75,
      brightness: 100,
      wifiEnabled: true,
      bluetoothEnabled: true,
      airDropEnabled: true,
      dndEnabled: false,
    };
  });

  // Files and Notes state
  const [files, setFiles] = useState<FileItem[]>(INITIAL_FILES);
  const [notes, setNotes] = useState<NoteItem[]>(() => {
    const saved = localStorage.getItem('aura_notes');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return INITIAL_NOTES;
  });

  // Windows State
  const [windows, setWindows] = useState<WindowState[]>([
    {
      id: 'win-dashboard-1',
      appId: 'dashboard',
      title: 'Dashboard — Monitor VPS',
      icon: 'Activity',
      x: 100,
      y: 60,
      width: 960,
      height: 600,
      isMinimized: false,
      isMaximized: false,
      zIndex: 11,
    },
    {
      id: 'win-settings-1',
      appId: 'settings',
      title: 'Ajustes — Conexión VPS',
      icon: 'Settings',
      x: 220,
      y: 120,
      width: 760,
      height: 520,
      isMinimized: false,
      isMaximized: false,
      zIndex: 10,
    }
  ]);

  const [activeWindowId, setActiveWindowId] = useState<string | null>('win-dashboard-1');
  const [topZIndex, setTopZIndex] = useState(12);

  // UI Panels
  const [isControlCenterOpen, setIsControlCenterOpen] = useState(false);
  const [isWidgetsOpen, setIsWidgetsOpen] = useState(false);
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  // Save settings and notes
  useEffect(() => {
    localStorage.setItem('aura_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('aura_notes', JSON.stringify(notes));
  }, [notes]);

  // Global Keyboard Shortcuts (Cmd+K / Ctrl+K for Spotlight)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSpotlightOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const currentWallpaper = WALLPAPERS.find((w) => w.id === settings.wallpaperId) || WALLPAPERS[0];

  const handleUpdateSettings = (newSettings: Partial<SystemSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const handleFocusWindow = (windowId: string) => {
    const nextZ = topZIndex + 1;
    setTopZIndex(nextZ);
    setWindows((prev) =>
      prev.map((w) => (w.id === windowId ? { ...w, zIndex: nextZ, isMinimized: false } : w))
    );
    setActiveWindowId(windowId);
  };

  const handleOpenApp = (appId: AppId) => {
    // Check if window already exists
    const existingWindow = windows.find((w) => w.appId === appId);
    if (existingWindow) {
      if (existingWindow.isMinimized) {
        // Restore
        handleFocusWindow(existingWindow.id);
      } else {
        handleFocusWindow(existingWindow.id);
      }
      return;
    }

    // Otherwise create new window
    const appDef = APP_REGISTRY[appId];
    const newZ = topZIndex + 1;
    setTopZIndex(newZ);

    // Stagger window offset
    const offset = (windows.length % 6) * 30;
    const initialX = Math.max(40, Math.min(100 + offset, window.innerWidth - appDef.defaultWidth - 20));
    const initialY = Math.max(50, Math.min(60 + offset, window.innerHeight - appDef.defaultHeight - 80));

    const newWindow: WindowState = {
      id: `win-${appId}-${Date.now()}`,
      appId,
      title: appDef.defaultTitle,
      icon: appDef.iconName,
      x: initialX,
      y: initialY,
      width: Math.min(appDef.defaultWidth, window.innerWidth - 40),
      height: Math.min(appDef.defaultHeight, window.innerHeight - 120),
      isMinimized: false,
      isMaximized: false,
      zIndex: newZ,
    };

    setWindows((prev) => [...prev, newWindow]);
    setActiveWindowId(newWindow.id);
  };

  const handleOpenFile = (file: FileItem) => {
    if (file.type === 'folder') {
      handleOpenApp('files');
    } else {
      handleOpenApp('files');
    }
  };

  const handleCloseWindow = (windowId: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== windowId));
    if (activeWindowId === windowId) {
      const remaining = windows.filter((w) => w.id !== windowId && !w.isMinimized);
      if (remaining.length > 0) {
        // focus the one with highest z-index
        const highest = remaining.reduce((prev, curr) => (curr.zIndex > prev.zIndex ? curr : prev));
        setActiveWindowId(highest.id);
      } else {
        setActiveWindowId(null);
      }
    }
  };

  const handleMinimizeWindow = (windowId: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === windowId ? { ...w, isMinimized: true } : w))
    );
    if (activeWindowId === windowId) {
      const remaining = windows.filter((w) => w.id !== windowId && !w.isMinimized);
      if (remaining.length > 0) {
        const highest = remaining.reduce((prev, curr) => (curr.zIndex > prev.zIndex ? curr : prev));
        setActiveWindowId(highest.id);
      } else {
        setActiveWindowId(null);
      }
    }
  };

  const handleMaximizeWindow = (windowId: string) => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id === windowId) {
          if (!w.isMaximized) {
            return {
              ...w,
              isMaximized: true,
              prevPosition: { x: w.x, y: w.y, width: w.width, height: w.height },
            };
          } else {
            return {
              ...w,
              isMaximized: false,
              x: w.prevPosition?.x || 100,
              y: w.prevPosition?.y || 60,
              width: w.prevPosition?.width || 700,
              height: w.prevPosition?.height || 450,
            };
          }
        }
        return w;
      })
    );
  };

  const handleUpdatePosition = (windowId: string, x: number, y: number) => {
    setWindows((prev) => prev.map((w) => (w.id === windowId ? { ...w, x, y } : w)));
  };

  const handleUpdateSize = (windowId: string, width: number, height: number) => {
    setWindows((prev) => prev.map((w) => (w.id === windowId ? { ...w, width, height } : w)));
  };

  // Get active app id for MenuBar
  const activeWindow = windows.find((w) => w.id === activeWindowId && !w.isMinimized);
  const activeAppId = activeWindow ? activeWindow.appId : null;

  return (
    <div className={`relative w-screen h-screen overflow-hidden ${settings.theme === 'dark' ? 'dark' : ''}`}>
      {/* Top Menu Bar */}
      <MenuBar
        activeAppId={activeAppId}
        settings={settings}
        onOpenApp={handleOpenApp}
        onToggleControlCenter={() => {
          setIsControlCenterOpen(!isControlCenterOpen);
          setIsWidgetsOpen(false);
        }}
        onToggleSpotlight={() => setIsSpotlightOpen(true)}
        onToggleWidgets={() => {
          setIsWidgetsOpen(!isWidgetsOpen);
          setIsControlCenterOpen(false);
        }}
        isControlCenterOpen={isControlCenterOpen}
        isWidgetsOpen={isWidgetsOpen}
        onShutdown={() => setIsLocked(true)}
      />

      {/* Desktop Canvas with Wallpaper & Icons */}
      <Desktop
        files={files}
        wallpaper={currentWallpaper}
        brightness={settings.brightness}
        onOpenApp={handleOpenApp}
        onOpenFile={handleOpenFile}
        onOpenSettings={() => handleOpenApp('settings')}
        onOpenTerminal={() => handleOpenApp('terminal')}
      />

      {/* Interactive Translucent Windows Stack */}
      <AnimatePresence>
        {windows.map((w) => {
          const isActive = w.id === activeWindowId;
          return (
            <WindowFrame
              key={w.id}
              window={w}
              isActive={isActive}
              onFocus={() => handleFocusWindow(w.id)}
              onClose={() => handleCloseWindow(w.id)}
              onMinimize={() => handleMinimizeWindow(w.id)}
              onMaximize={() => handleMaximizeWindow(w.id)}
              onUpdatePosition={(x, y) => handleUpdatePosition(w.id, x, y)}
              onUpdateSize={(width, height) => handleUpdateSize(w.id, width, height)}
              soundEnabled={settings.soundEnabled}
              blurIntensity={settings.blurIntensity}
            >
              {/* App Content */}
              {w.appId === 'dashboard' && <MonitorDashboardApp />}
              {w.appId === 'terminal' && <SSHTerminalApp />}
              {w.appId === 'processes' && <ProcessManagerApp />}
              {w.appId === 'docker' && <DockerManagerApp />}
              {w.appId === 'services' && <ServicesManagerApp />}
              {w.appId === 'files' && <FileExplorerApp />}
              {w.appId === 'packages' && <PackageManagerApp />}
              {w.appId === 'settings' && (
                <SettingsApp
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                />
              )}
            </WindowFrame>
          );
        })}
      </AnimatePresence>

      {/* Floating Modern Magnifying Dock */}
      <Dock
        openWindows={windows}
        activeWindowId={activeWindowId}
        onLaunchApp={handleOpenApp}
        onRestoreWindow={handleFocusWindow}
        soundEnabled={settings.soundEnabled}
      />

      {/* Control Center Flyout */}
      <AnimatePresence>
        {isControlCenterOpen && (
          <ControlCenter
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onClose={() => setIsControlCenterOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Widgets & Notification Center Drawer */}
      <AnimatePresence>
        {isWidgetsOpen && (
          <WidgetsPanel onClose={() => setIsWidgetsOpen(false)} />
        )}
      </AnimatePresence>

      {/* Spotlight Search Overlay (Cmd + K) */}
      <Spotlight
        isOpen={isSpotlightOpen}
        onClose={() => setIsSpotlightOpen(false)}
        onOpenApp={handleOpenApp}
        files={files}
        notes={notes}
      />

      {/* Lock Screen / Session restart */}
      <AnimatePresence>
        {isLocked && (
          <LockScreen
            wallpaper={currentWallpaper}
            onUnlock={() => setIsLocked(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
