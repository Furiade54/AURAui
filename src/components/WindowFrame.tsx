import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Minus, Square, X, Maximize2 } from 'lucide-react';
import { WindowState } from '../types';
import { playClickSound, playCloseSound } from '../utils/sound';

interface WindowFrameProps {
  window: WindowState;
  isActive: boolean;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onUpdatePosition: (x: number, y: number) => void;
  onUpdateSize: (width: number, height: number) => void;
  soundEnabled: boolean;
  blurIntensity: 'low' | 'medium' | 'high';
  children: React.ReactNode;
}

export const WindowFrame: React.FC<WindowFrameProps> = ({
  window,
  isActive,
  onFocus,
  onClose,
  onMinimize,
  onMaximize,
  onUpdatePosition,
  onUpdateSize,
  soundEnabled,
  blurIntensity,
  children,
}) => {
  const [isHoveringControls, setIsHoveringControls] = useState(false);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const isResizingRef = useRef(false);
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // Handle header mouse down for dragging
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    // Only drag on left click and not on action buttons
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;
    if (window.isMaximized) return;

    onFocus();
    isDraggingRef.current = true;
    dragOffsetRef.current = {
      x: e.clientX - window.x,
      y: e.clientY - window.y,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const newX = Math.max(10, Math.min(moveEvent.clientX - dragOffsetRef.current.x, globalThis.innerWidth - 100));
      const newY = Math.max(34, Math.min(moveEvent.clientY - dragOffsetRef.current.y, globalThis.innerHeight - 100));
      onUpdatePosition(newX, newY);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle resizing from bottom-right corner
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (window.isMaximized) return;

    onFocus();
    isResizingRef.current = true;
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: window.width,
      height: window.height,
    };

    const handleResizeMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const deltaX = moveEvent.clientX - resizeStartRef.current.x;
      const deltaY = moveEvent.clientY - resizeStartRef.current.y;
      const newWidth = Math.max(320, Math.min(resizeStartRef.current.width + deltaX, globalThis.innerWidth - window.x - 10));
      const newHeight = Math.max(220, Math.min(resizeStartRef.current.height + deltaY, globalThis.innerHeight - window.y - 60));
      onUpdateSize(newWidth, newHeight);
    };

    const handleResizeUp = () => {
      isResizingRef.current = false;
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeUp);
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeUp);
  };

  const getBlurClass = () => {
    switch (blurIntensity) {
      case 'low': return 'backdrop-blur-md';
      case 'high': return 'backdrop-blur-3xl';
      default: return 'backdrop-blur-2xl';
    }
  };

  if (window.isMinimized) {
    return null;
  }

  const windowStyle: React.CSSProperties = window.isMaximized
    ? {
        position: 'fixed',
        left: 0,
        top: 32, // below menu bar
        width: '100vw',
        height: 'calc(100vh - 32px - 68px)', // above dock
        zIndex: window.zIndex,
      }
    : {
        position: 'fixed',
        left: window.x,
        top: window.y,
        width: window.width,
        height: window.height,
        zIndex: window.zIndex,
      };

  return (
    <motion.div
      id={`window-${window.id}`}
      initial={{ opacity: 0, scale: 0.95, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 30 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      style={windowStyle}
      onMouseDown={onFocus}
      className={`flex flex-col rounded-2xl overflow-hidden select-none transition-shadow duration-300 ${
        window.isMaximized ? 'rounded-none' : ''
      } ${
        isActive
          ? 'shadow-[0_25px_60px_rgba(0,0,0,0.65)] ring-1 ring-white/20'
          : 'shadow-[0_15px_35px_rgba(0,0,0,0.4)] opacity-95 ring-1 ring-white/10'
      } ${getBlurClass()} bg-slate-900/55 text-slate-100`}
    >
      {/* Window Title Bar */}
      <div
        id={`titlebar-${window.id}`}
        onMouseDown={handleHeaderMouseDown}
        onDoubleClick={onMaximize}
        className={`h-11 px-4 flex items-center justify-between mac-titlebar border-b border-white/10 ${
          isActive ? 'bg-white/10' : 'bg-white/5'
        } cursor-default`}
      >
        {/* macOS Traffic Light Buttons */}
        <div
          className="flex items-center space-x-2 w-20"
          onMouseEnter={() => setIsHoveringControls(true)}
          onMouseLeave={() => setIsHoveringControls(false)}
        >
          {/* Close Button */}
          <button
            id={`btn-close-${window.id}`}
            onClick={(e) => {
              e.stopPropagation();
              playCloseSound(soundEnabled);
              onClose();
            }}
            className="w-3.5 h-3.5 rounded-full bg-[#ff5f56] hover:bg-[#e0443e] active:scale-95 transition-transform flex items-center justify-center border border-black/20 text-black/70 shadow-inner"
            title="Cerrar"
          >
            {isHoveringControls && <X size={8} strokeWidth={3} />}
          </button>

          {/* Minimize Button */}
          <button
            id={`btn-minimize-${window.id}`}
            onClick={(e) => {
              e.stopPropagation();
              playClickSound(soundEnabled);
              onMinimize();
            }}
            className="w-3.5 h-3.5 rounded-full bg-[#ffbd2e] hover:bg-[#dea123] active:scale-95 transition-transform flex items-center justify-center border border-black/20 text-black/70 shadow-inner"
            title="Minimizar"
          >
            {isHoveringControls && <Minus size={8} strokeWidth={3} />}
          </button>

          {/* Maximize Button */}
          <button
            id={`btn-maximize-${window.id}`}
            onClick={(e) => {
              e.stopPropagation();
              playClickSound(soundEnabled);
              onMaximize();
            }}
            className="w-3.5 h-3.5 rounded-full bg-[#27c93f] hover:bg-[#1aab2f] active:scale-95 transition-transform flex items-center justify-center border border-black/20 text-black/70 shadow-inner"
            title={window.isMaximized ? 'Restaurar' : 'Maximizar'}
          >
            {isHoveringControls && (
              window.isMaximized ? <Minus size={8} strokeWidth={3} /> : <Maximize2 size={7} strokeWidth={3} />
            )}
          </button>
        </div>

        {/* Center Title */}
        <div className="flex-1 text-center font-medium text-xs tracking-wide text-slate-200 truncate px-2 opacity-90">
          {window.title}
        </div>

        {/* Right Balance spacer */}
        <div className="w-20 flex justify-end items-center opacity-40">
          <div className="w-2 h-2 rounded-full bg-white/20" />
        </div>
      </div>

      {/* Window Body */}
      <div className="flex-1 overflow-hidden relative flex flex-col bg-slate-950/40">
        {children}
      </div>

      {/* Resize Handle (corner) */}
      {!window.isMaximized && (
        <div
          id={`resize-handle-${window.id}`}
          onMouseDown={handleResizeMouseDown}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-50 flex items-end justify-end p-0.5 opacity-30 hover:opacity-100 transition-opacity"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-white/60">
            <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </motion.div>
  );
};
