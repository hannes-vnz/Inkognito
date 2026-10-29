import soundsJson from '../../data/sounds.json';

interface Note {
  wave: OscillatorType | 'noise';
  freq?: number;
  /** Zielfrequenz am Ende (Gleiten). */
  to?: number;
  start: number;
  dur: number;
  gain: number;
  /** Tiefpass für Rauschen (Hz). */
  filter?: number;
}

export type SoundId = keyof typeof soundsJson;

const sounds = soundsJson as Record<SoundId, Note[]>;
const MUTE_KEY = 'inkognito.muted';

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
})();

/**
 * Platzhalter-Sounds, live synthetisiert (Chiptune-Stil passend zur Pixel-Optik).
 * Später durch echte Dateien ersetzbar, die Aufrufe bleiben gleich.
 */
function audio(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  // Weißes Rauschen aus einer festen Zahlenfolge (deterministisch)
  noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const data = noise.getChannelData(0);
  let x = 12345;
  for (let i = 0; i < data.length; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    data[i] = (x / 0x7fffffff) * 2 - 1;
  }
  return ctx;
}

/** Browser erlauben Ton erst nach einer Berührung: beim ersten Antippen aufwecken. */
export function unlockAudio(): void {
  const wake = () => void audio()?.resume();
  window.addEventListener('pointerdown', wake, { once: true });
  window.addEventListener('keydown', wake, { once: true });
}

export const isMuted = (): boolean => muted;

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    // ohne Speicher gilt die Einstellung nur bis zum Neuladen
  }
}

/** `pitch` verschiebt alle Töne (1 = normal), z. B. höher bei längerer Combo. */
export function play(id: SoundId, pitch = 1): void {
  if (muted) return;
  const ac = audio();
  if (!ac || ac.state !== 'running') return;
  const t0 = ac.currentTime + 0.01;
  for (const n of sounds[id]) {
    const g = ac.createGain();
    const start = t0 + n.start;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(n.gain, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + n.dur);
    let src: AudioScheduledSourceNode;
    if (n.wave === 'noise') {
      const b = ac.createBufferSource();
      b.buffer = noise;
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = n.filter ?? 2000;
      b.connect(f).connect(g);
      src = b;
    } else {
      const o = ac.createOscillator();
      o.type = n.wave;
      o.frequency.setValueAtTime((n.freq ?? 440) * pitch, start);
      if (n.to) o.frequency.exponentialRampToValueAtTime(n.to * pitch, start + n.dur);
      o.connect(g);
      src = o;
    }
    g.connect(ac.destination);
    src.start(start);
    src.stop(start + n.dur + 0.02);
  }
}
