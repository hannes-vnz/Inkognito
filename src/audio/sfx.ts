import soundsJson from '../../data/sounds.json';

interface SoundDef {
  /** Pfad relativ zu /assets (siehe CREDITS.md für Herkunft und Lizenz). */
  file: string;
  gain: number;
}

export type SoundId = keyof typeof soundsJson;

const sounds = soundsJson as Record<SoundId, SoundDef>;
const MUTE_KEY = 'inkognito.muted';

let ctx: AudioContext | null = null;
const buffers = new Map<SoundId, AudioBuffer>();
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
})();

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  void loadAll(ctx);
  return ctx;
}

/** Alle Sounds einmal laden und dekodieren; fehlende Dateien bleiben einfach stumm. */
async function loadAll(ac: AudioContext): Promise<void> {
  await Promise.all(
    (Object.keys(sounds) as SoundId[]).map(async (id) => {
      try {
        const res = await fetch(sounds[id].file);
        buffers.set(id, await ac.decodeAudioData(await res.arrayBuffer()));
      } catch {
        // ohne Datei kein Ton, das Spiel läuft weiter
      }
    }),
  );
}

/** Browser erlauben Ton erst nach einer Berührung: beim ersten Antippen aufwecken und laden. */
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

/** `pitch` verschiebt die Tonhöhe (1 = normal), z. B. höher bei längerer Combo. */
export function play(id: SoundId, pitch = 1): void {
  if (muted) return;
  const ac = audio();
  const buffer = buffers.get(id);
  if (!ac || ac.state !== 'running' || !buffer) return;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = pitch;
  const g = ac.createGain();
  g.gain.value = sounds[id].gain;
  src.connect(g).connect(ac.destination);
  src.start();
}
