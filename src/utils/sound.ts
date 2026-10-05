// Web Audio API tactile synthesized sound effects for AuraOS

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playClickSound(soundEnabled: boolean = true) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.04);

    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.04);
  } catch {
    // Ignore audio errors
  }
}

export function playOpenSound(soundEnabled: boolean = true) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch {
    // Ignore
  }
}

export function playCloseSound(soundEnabled: boolean = true) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(250, ctx.currentTime + 0.06);

    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  } catch {
    // Ignore
  }
}

// Ambient Synth for the Music Player
export class AmbientSynth {
  private ctx: AudioContext | null = null;
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private isPlaying: boolean = false;

  start(volume: number = 0.5) {
    if (this.isPlaying) return;
    this.ctx = getAudioContext();
    if (!this.ctx) return;

    this.osc1 = this.ctx.createOscillator();
    this.osc2 = this.ctx.createOscillator();
    this.gain = this.ctx.createGain();

    this.osc1.type = 'sine';
    this.osc1.frequency.setValueAtTime(220, this.ctx.currentTime); // A3

    this.osc2.type = 'triangle';
    this.osc2.frequency.setValueAtTime(330, this.ctx.currentTime); // E4 (fifth)

    const masterVol = Math.max(0.01, (volume / 100) * 0.12);
    this.gain.gain.setValueAtTime(0.01, this.ctx.currentTime);
    this.gain.gain.exponentialRampToValueAtTime(masterVol, this.ctx.currentTime + 1.2);

    this.osc1.connect(this.gain);
    this.osc2.connect(this.gain);
    this.gain.connect(this.ctx.destination);

    this.osc1.start();
    this.osc2.start();
    this.isPlaying = true;
  }

  stop() {
    if (!this.isPlaying || !this.ctx || !this.gain) return;
    try {
      this.gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.5);
      setTimeout(() => {
        this.osc1?.stop();
        this.osc2?.stop();
        this.osc1?.disconnect();
        this.osc2?.disconnect();
        this.gain?.disconnect();
        this.isPlaying = false;
      }, 550);
    } catch {
      this.isPlaying = false;
    }
  }

  setVolume(vol: number) {
    if (!this.ctx || !this.gain || !this.isPlaying) return;
    const masterVol = Math.max(0.001, (vol / 100) * 0.12);
    this.gain.gain.setTargetAtTime(masterVol, this.ctx.currentTime, 0.1);
  }
}

export const ambientMusicSynth = new AmbientSynth();
