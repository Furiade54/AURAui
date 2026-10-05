import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Terminal as TerminalIcon,
  Power,
  RefreshCcw,
  Minus,
  Plus,
  AlertCircle,
} from 'lucide-react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import 'xterm/css/xterm.css';
import { createTerminalWS, getVpsConfig } from '../../lib/api';

const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 22;

export const SSHTerminalApp: React.FC = () => {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'ready' | 'error' | 'closed'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [fontSize, setFontSize] = useState(13);

  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const clientRef = useRef<ReturnType<typeof createTerminalWS> | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const initSentRef = useRef(false);

  const ensureTerminal = useCallback(() => {
    if (xtermRef.current || !containerRef.current) return;
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize,
      lineHeight: 1.15,
      scrollback: 10000,
      convertEol: false,
      allowProposedApi: true,
      theme: {
        background: '#020617',
        foreground: '#e2e8f0',
        cursor: '#34d399',
        cursorAccent: '#020617',
        selectionBackground: 'rgba(52, 211, 153, 0.25)',
        black: '#0b1220',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#c084fc',
        cyan: '#06b6d4',
        white: '#cbd5e1',
        brightBlack: '#475569',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#d8b4fe',
        brightCyan: '#22d3ee',
        brightWhite: '#f8fafc',
      },
    });
    const fit = new FitAddon();
    const weblinks = new WebLinksAddon((_e, uri) => {
      window.open(uri, '_blank', 'noopener,noreferrer');
    });
    term.loadAddon(fit);
    term.loadAddon(weblinks);
    term.open(containerRef.current);
    try { fit.fit(); } catch {}
    xtermRef.current = term;
    fitAddonRef.current = fit;

    term.onData((data) => {
      try { clientRef.current?.input(data); } catch {}
    });
    term.onBinary((data) => {
      try { clientRef.current?.input(data); } catch {}
    });
    term.onTitleChange((t) => {
      if (!t) return;
      try {
        const win = containerRef.current?.closest('[data-window-id]') as HTMLElement | null;
        const titleEl = win?.querySelector('[data-role="window-title"]') as HTMLElement | null;
        if (titleEl) titleEl.textContent = t;
      } catch {}
    });

    const ro = new ResizeObserver(() => {
      const term = xtermRef.current;
      const fit = fitAddonRef.current;
      if (!term || !fit) return;
      try {
        fit.fit();
        const client = clientRef.current;
        if (client) client.resize(term.cols, term.rows);
      } catch {}
    });
    ro.observe(containerRef.current);
    roRef.current = ro;
  }, [fontSize]);

  useEffect(() => {
    ensureTerminal();
  }, [ensureTerminal]);

  useEffect(() => {
    const term = xtermRef.current;
    if (!term) return;
    term.options.fontSize = fontSize;
    const fit = fitAddonRef.current;
    if (fit) {
      try {
        fit.fit();
        const client = clientRef.current;
        if (client) client.resize(term.cols, term.rows);
      } catch {}
    }
  }, [fontSize]);

  useEffect(() => {
    return () => {
      try { clientRef.current?.close(); } catch {}
      clientRef.current = null;
      if (roRef.current) try { roRef.current.disconnect(); } catch {}
      roRef.current = null;
      if (xtermRef.current) try { xtermRef.current.dispose(); } catch {}
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  const appendWarn = (msg: string) => {
    const term = xtermRef.current;
    if (!term) return;
    try {
      term.writeln(`\r\n\x1b[33m${msg}\x1b[0m\r\n`);
    } catch {
      try { term.writeln(msg); } catch {}
    }
  };

  const connect = useCallback(async () => {
    try {
      setStatus('connecting');
      setErrorMsg('');
      initSentRef.current = false;
      ensureTerminal();
      const term = xtermRef.current;
      if (!term) throw new Error('Terminal not ready');
      try { term.clear(); } catch {}
      term.writeln('\x1b[90mConectando con la VPS...\x1b[0m');

      clientRef.current?.close();
      clientRef.current = null;

      const client = createTerminalWS({
        onOutput: (d) => {
          try { xtermRef.current?.write(typeof d === 'string' ? d : new Uint8Array(d as any)); } catch {}
        },
        onReady: () => {
          setStatus('ready');
        },
        onClose: (code, reason) => {
          setStatus('closed');
          appendWarn(`[Connection closed. code=${code} reason=${reason || 'n/a'}]`);
        },
        onError: (e) => {
          setStatus('error');
          const msg = e?.message || String(e);
          setErrorMsg(msg);
          appendWarn(`[Error: ${msg}]`);
        },
      });
      clientRef.current = client;

      const fit = fitAddonRef.current;
      if (fit) try { fit.fit(); } catch {}

      const cfg = getVpsConfig();
      const cols = term.cols || 80;
      const rows = term.rows || 24;
      client.init({ ...cfg, cols, rows, term: 'xterm-256color' });
      initSentRef.current = true;

      term.focus();
    } catch (e: any) {
      setStatus('error');
      const msg = e?.message || String(e);
      setErrorMsg(msg);
      appendWarn(`[Error: ${msg}]`);
    }
  }, [ensureTerminal]);

  const disconnect = () => {
    try { clientRef.current?.close(); } catch {}
    clientRef.current = null;
    setStatus('closed');
    appendWarn('[Desconectado]');
  };

  const statusChip = () => {
    const map = {
      idle: { cls: 'bg-slate-500/30 text-slate-200', text: 'Desconectado' },
      connecting: { cls: 'bg-amber-500/30 text-amber-200', text: 'Conectando...' },
      ready: { cls: 'bg-emerald-500/30 text-emerald-200', text: 'Conectado' },
      error: { cls: 'bg-rose-500/30 text-rose-200', text: 'Error' },
      closed: { cls: 'bg-slate-500/30 text-slate-200', text: 'Cerrado' },
    } as const;
    const c = map[status];
    return (
      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${c.cls}`}>
        {c.text}
      </span>
    );
  };

  return (
    <div className="flex flex-col flex-1 bg-slate-950 backdrop-blur-xl overflow-hidden">
      <div className="flex items-center gap-2 p-2 border-b border-white/10 bg-slate-950/70">
        <TerminalIcon size={15} className="text-emerald-400 shrink-0" />
        <div className="text-xs font-mono text-emerald-300 truncate">
          xterm-256color · {xtermRef.current ? `${xtermRef.current.cols}x${xtermRef.current.rows}` : '—'}
        </div>
        <div className="ml-1 shrink-0">{statusChip()}</div>
        {errorMsg && (
          <div className="ml-2 flex items-center gap-1 text-[11px] text-rose-300 min-w-0">
            <AlertCircle size={12} className="shrink-0" />
            <span className="truncate max-w-xs">{errorMsg}</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <button
            onClick={() => setFontSize((s) => Math.max(MIN_FONT_SIZE, s - 1))}
            className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-200"
            title="Disminuir fuente"
          >
            <Minus size={13} />
          </button>
          <div className="text-[11px] font-mono w-10 text-center text-slate-300 tabular-nums">{fontSize}px</div>
          <button
            onClick={() => setFontSize((s) => Math.min(MAX_FONT_SIZE, s + 1))}
            className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-200"
            title="Aumentar fuente"
          >
            <Plus size={13} />
          </button>
          <button
            onClick={connect}
            className="ml-1 px-2 py-1 rounded-md bg-emerald-500/25 text-emerald-200 hover:bg-emerald-500/40 flex items-center gap-1 text-[11px]"
          >
            <RefreshCcw size={12} /> {status === 'idle' || status === 'closed' ? 'Conectar' : 'Reconectar'}
          </button>
          <button
            onClick={disconnect}
            className="px-2 py-1 rounded-md bg-rose-500/20 text-rose-200 hover:bg-rose-500/40 flex items-center gap-1 text-[11px]"
          >
            <Power size={12} /> Desconectar
          </button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 relative overflow-hidden [&_.xterm]:p-2" />
    </div>
  );
};
