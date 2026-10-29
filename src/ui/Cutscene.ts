import { el, iconImg } from './dom';
import { setRichText } from './rich';
import { play, type SoundId } from '../audio/sfx';

/** Hintergründe im Stil der Zwischenschnitte von Dave the Diver. */
export type ShotBackground = 'spotlight' | 'marquee' | 'speedlines' | 'burst' | 'split' | 'crayon' | 'waves' | 'sparkle' | 'night' | 'deep' | 'table' | 'black' | 'white';
export type ShotParticles = 'bubbles' | 'shards' | 'petals' | 'confetti';
export type PropMotion = 'still' | 'sink' | 'pass' | 'toCamera';
export type ShotCamera = 'still' | 'pushIn' | 'pullOut' | 'panLeft' | 'panRight' | 'shake';
export type ShotFx = 'sweat' | 'sparkle' | 'anger' | 'hearts' | 'question' | 'flashbulb' | 'coins' | 'tears';

export interface ShotFigure {
  /** Figur (hilde, bruno, bert …) und Gesichtsausdruck. */
  who: string;
  face?: string;
  /** Im Schatten (dunkel), z. B. wer stumm danebensteht. */
  dim?: boolean;
  /** Acting-Animation statt Standbild (data/anims.json, Schlüssel `<who>_<anim>`). */
  anim?: string;
}

export interface ActingAnim {
  file: string;
  frames: number;
  fps: number;
  loop: boolean;
}

export interface Shot {
  bg: ShotBackground;
  ms: number;
  cam?: ShotCamera;
  /** Eine Figur in der Mitte, zwei einander zugewandt, oder Comic-Panels. */
  figures?: ShotFigure[];
  panels?: ShotFigure[];
  /** Großes Bild einer Art (z. B. die gefangene Legende). */
  species?: string;
  /** Großes Requisit aus den Grafiken (z. B. Kiste, Kutter). */
  prop?: string;
  captionKey?: string;
  /** Schon übersetzter Text (statt captionKey). */
  caption?: string;
  flash?: boolean;
  fx?: ShotFx[];
  sfx?: SoundId;
  /** Bildausschnitt: Kamera zielt auf [x %, y %] mit Zoomfaktor, oder 'eyes' = Augen der Figur. */
  focus?: [number, number, number] | 'eyes';
  /** Größe des Requisits in % der Bildbreite (Standard 60). */
  propSize?: number;
  /** Vordergrund-Ebene, die sich gegen den Hintergrund bewegt (Parallaxe). */
  fg?: 'kelp' | 'net';
  particles?: ShotParticles;
  /** Wie sich Requisit oder Art durchs Bild bewegt. */
  motion?: PropMotion;
  /** Requisit/Art erst als Schattenriss. */
  silhouette?: boolean;
  /** Figur steht im Dunkeln, dann geht das Licht an. */
  lightsOn?: boolean;
  /** Lichtblitz, der übers Bild streicht (wie über eine Klinge). */
  gleam?: boolean;
  /** Schlussbild: Polaroid, das sich auf dem Tisch entwickelt (Figuren im Foto). */
  polaroid?: boolean;
}

export interface CutsceneArt {
  portrait(who: string, face: string): string | undefined;
  speciesImage(id: string): string | undefined;
  texture(key: string): string | undefined;
  anim(key: string): ActingAnim | undefined;
  text(key: string): string;
}

const BW = 480;
const BH = 270;

function background(kind: ShotBackground): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = BW;
  c.height = BH;
  const g = c.getContext('2d')!;
  const cx = BW / 2;
  switch (kind) {
    case 'black':
    case 'white':
      g.fillStyle = kind === 'black' ? '#000' : '#fff';
      g.fillRect(0, 0, BW, BH);
      break;
    case 'deep': {
      // Weite Tiefsee: Licht von oben, das nach unten ins Dunkle verläuft, Felsen an den Seiten
      const grad = g.createLinearGradient(0, 0, 0, BH);
      grad.addColorStop(0, '#2a7f9a');
      grad.addColorStop(0.45, '#0f3a5a');
      grad.addColorStop(1, '#040c18');
      g.fillStyle = grad;
      g.fillRect(0, 0, BW, BH);
      const glow = g.createRadialGradient(cx, -40, 10, cx, -40, 260);
      glow.addColorStop(0, 'rgba(200,255,255,0.45)');
      glow.addColorStop(1, 'rgba(200,255,255,0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, BW, BH);
      g.fillStyle = '#06141f';
      g.beginPath();
      g.moveTo(0, 0);
      g.bezierCurveTo(90, 60, 40, 160, 110, BH);
      g.lineTo(0, BH);
      g.fill();
      g.beginPath();
      g.moveTo(BW, 30);
      g.bezierCurveTo(BW - 70, 110, BW - 20, 190, BW - 120, BH);
      g.lineTo(BW, BH);
      g.fill();
      break;
    }
    case 'table': {
      // Holztisch für das Polaroid
      g.fillStyle = '#7a5232';
      g.fillRect(0, 0, BW, BH);
      for (let y = 0; y < BH; y += 30) {
        g.fillStyle = y % 60 ? '#6d4829' : '#845a37';
        g.fillRect(0, y, BW, 28);
        g.fillStyle = 'rgba(0,0,0,0.15)';
        for (let x = (y * 7) % 90; x < BW; x += 90) g.fillRect(x, y + 6, 40, 2);
      }
      const v = g.createRadialGradient(cx, BH / 2, 60, cx, BH / 2, 300);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,0,0.55)');
      g.fillStyle = v;
      g.fillRect(0, 0, BW, BH);
      break;
    }
    case 'spotlight':
    case 'night': {
      // Dunkle Bühne mit weichem Lichtkegel von oben, wie die Charakter-Großaufnahmen
      g.fillStyle = kind === 'night' ? '#0b1630' : '#141418';
      g.fillRect(0, 0, BW, BH);
      const r = g.createRadialGradient(cx, BH * 0.95, 10, cx, BH * 0.8, BW * 0.6);
      r.addColorStop(0, kind === 'night' ? 'rgba(120,160,255,0.45)' : 'rgba(255,255,255,0.32)');
      r.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, BW, BH);
      const cone = g.createLinearGradient(0, 0, 0, BH);
      cone.addColorStop(0, 'rgba(255,255,240,0.18)');
      cone.addColorStop(1, 'rgba(255,255,240,0)');
      g.fillStyle = cone;
      g.beginPath();
      g.moveTo(cx - 40, 0);
      g.lineTo(cx + 40, 0);
      g.lineTo(cx + 190, BH);
      g.lineTo(cx - 190, BH);
      g.fill();
      break;
    }
    case 'marquee': {
      // Glühbirnen-Wand wie auf einer Showbühne
      g.fillStyle = '#3a1c08';
      g.fillRect(0, 0, BW, BH);
      for (let y = 6; y < BH; y += 14)
        for (let x = 6 + ((y / 14) % 2) * 7; x < BW; x += 14) {
          const glow = g.createRadialGradient(x, y, 0, x, y, 7);
          glow.addColorStop(0, '#fff6c0');
          glow.addColorStop(0.4, '#ffb238');
          glow.addColorStop(1, 'rgba(255,140,0,0)');
          g.fillStyle = glow;
          g.fillRect(x - 7, y - 7, 14, 14);
        }
      break;
    }
    case 'speedlines': {
      g.fillStyle = '#f4f4f8';
      g.fillRect(0, 0, BW, BH);
      g.strokeStyle = '#2a2a3a';
      for (let i = 0; i < 90; i++) {
        const a = (i / 90) * Math.PI * 2 + (i % 3) * 0.01;
        const r0 = 70 + (i % 5) * 18;
        g.lineWidth = 1 + (i % 4);
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * r0, BH / 2 + Math.sin(a) * r0 * 0.7);
        g.lineTo(cx + Math.cos(a) * 400, BH / 2 + Math.sin(a) * 400);
        g.stroke();
      }
      break;
    }
    case 'burst': {
      for (let i = 0; i < 28; i++) {
        const a0 = (i / 28) * Math.PI * 2;
        const a1 = ((i + 1) / 28) * Math.PI * 2;
        g.fillStyle = i % 2 ? '#ff9f43' : '#ffd23f';
        g.beginPath();
        g.moveTo(cx, BH * 0.6);
        g.lineTo(cx + Math.cos(a0) * 600, BH * 0.6 + Math.sin(a0) * 600);
        g.lineTo(cx + Math.cos(a1) * 600, BH * 0.6 + Math.sin(a1) * 600);
        g.fill();
      }
      break;
    }
    case 'split': {
      // Dramatisch: links Blau, rechts Rot, mit Wellen-Ornament (Tiger-und-Drache-Moment)
      g.fillStyle = '#1f3fa8';
      g.fillRect(0, 0, BW, BH);
      g.fillStyle = '#c22a2a';
      g.beginPath();
      g.moveTo(BW * 0.55, 0);
      g.lineTo(BW, 0);
      g.lineTo(BW, BH);
      g.lineTo(BW * 0.42, BH);
      g.fill();
      g.lineWidth = 3;
      for (let k = 0; k < 7; k++) {
        g.strokeStyle = 'rgba(160,200,255,0.55)';
        g.beginPath();
        g.arc(60 + k * 24, BH - 30 - (k % 2) * 30, 30, Math.PI, Math.PI * 1.85);
        g.stroke();
        g.strokeStyle = 'rgba(255,200,120,0.6)';
        g.beginPath();
        g.arc(BW - 60 - k * 24, 40 + (k % 2) * 30, 26, 0, Math.PI * 0.9);
        g.stroke();
      }
      break;
    }
    case 'crayon': {
      // Kinderzeichnung: Himmel, Regenbogen, Sonne, Wachsmalstriche
      g.fillStyle = '#bfe8ff';
      g.fillRect(0, 0, BW, BH);
      const bow = ['#ff6b6b', '#ffb238', '#ffe066', '#7bd88f', '#5ca8ff', '#b07cff'];
      bow.forEach((col, i) => {
        g.strokeStyle = col;
        g.lineWidth = 12;
        g.beginPath();
        g.arc(BW * 0.3, BH * 1.05, 210 - i * 12, Math.PI * 1.05, Math.PI * 1.95);
        g.stroke();
      });
      g.fillStyle = '#ffe066';
      g.beginPath();
      g.arc(BW * 0.85, 45, 26, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.5)';
      g.lineWidth = 2;
      for (let i = 0; i < 160; i++) {
        const x = (i * 47) % BW;
        const y = (i * 31) % BH;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + 9, y + 3);
        g.stroke();
      }
      break;
    }
    case 'waves': {
      g.fillStyle = '#0d2233';
      g.fillRect(0, 0, BW, BH);
      const blues = ['#1f5a80', '#2f7fa8', '#9fc6dc', '#e6f1f6'];
      for (let row = 0; row < 6; row++)
        for (let i = 0; i < 14; i++) {
          const x = i * 40 + (row % 2) * 20;
          const y = BH - row * 44 + 10;
          blues.forEach((col, k) => {
            g.strokeStyle = col;
            g.lineWidth = 5;
            g.beginPath();
            g.arc(x, y, 30 - k * 7, Math.PI, Math.PI * 1.9);
            g.stroke();
          });
        }
      break;
    }
    case 'sparkle': {
      const grad = g.createLinearGradient(0, 0, 0, BH);
      grad.addColorStop(0, '#ff8fb8');
      grad.addColorStop(1, '#7c5cff');
      g.fillStyle = grad;
      g.fillRect(0, 0, BW, BH);
      g.fillStyle = '#fff6e0';
      for (let i = 0; i < 60; i++) {
        const x = (i * 53) % BW;
        const y = (i * 29) % BH;
        g.fillRect(x, y - 4, 2, 10);
        g.fillRect(x - 4, y, 10, 2);
      }
      break;
    }
  }
  return c;
}

function fxLayer(fx: readonly ShotFx[]): HTMLDivElement {
  const layer = el('div', 'cut-fx');
  for (const f of fx) {
    const n = f === 'coins' ? 14 : f === 'sparkle' || f === 'hearts' ? 10 : f === 'tears' ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const p = f === 'coins' ? iconImg('icon_coin') : el('div', '');
      p.className = `cut-${f}`;
      p.style.setProperty('--i', `${i}`);
      p.style.left = `${f === 'coins' ? 8 + ((i * 37) % 84) : f === 'sparkle' || f === 'hearts' ? 10 + ((i * 41) % 80) : f === 'tears' ? 44 + i * 12 : 62}%`;
      p.style.top = `${f === 'sparkle' || f === 'hearts' ? 10 + ((i * 29) % 60) : f === 'coins' ? -10 : f === 'tears' ? 44 : 22}%`;
      if (f === 'question') p.textContent = '?';
      layer.append(p);
    }
  }
  return layer;
}

/** Partikel, die durchs Bild treiben (Blasen steigen, Splitter fliegen, Blätter fallen). */
function particles(kind: ShotParticles): HTMLDivElement {
  const layer = el('div', `cut-particles p-${kind}`);
  const n = kind === 'shards' ? 22 : 28;
  for (let i = 0; i < n; i++) {
    const p = el('div', '');
    p.style.setProperty('--i', `${i}`);
    p.style.left = `${(i * 37) % 100}%`;
    p.style.top = `${(i * 53) % 100}%`;
    p.style.setProperty('--s', `${0.6 + ((i * 7) % 5) * 0.25}`);
    layer.append(p);
  }
  return layer;
}

function figure(art: CutsceneArt, f: ShotFigure, cls: string): HTMLElement {
  const anim = f.anim ? art.anim(`${f.who}_${f.anim}`) : undefined;
  if (anim) {
    // Bildstreifen hinter einem quadratischen Fenster, Bild für Bild verschoben
    const box = el('div', `cut-figure anim ${cls}${f.dim ? ' dim' : ''}`);
    const strip = el('img', 'cut-strip');
    strip.src = anim.file;
    strip.alt = '';
    box.style.setProperty('--frames', `${anim.frames}`);
    box.style.setProperty('--dur', `${anim.frames / anim.fps}s`);
    box.style.setProperty('--iter', anim.loop ? 'infinite' : '1');
    box.append(strip);
    return box;
  }
  const img = el('img', `cut-figure ${cls}${f.dim ? ' dim' : ''}`);
  img.src = art.portrait(f.who, f.face ?? 'normal') ?? '';
  img.alt = '';
  return img;
}

/**
 * Zwischensequenz aus mehreren Einstellungen: Kinobalken, Hintergrund, Kamerafahrt, Figuren,
 * Effekte und Text, harte Schnitte mit Weißblitz. Antippen überspringt alles.
 */
export function playCutscene(root: HTMLElement, shots: readonly Shot[], art: CutsceneArt, done: () => void): void {
  const node = el('div', 'cut');
  const stage = el('div', 'cut-stage');
  const top = el('div', 'bar top');
  const bottom = el('div', 'bar bottom');
  const flash = el('div', 'cut-flash');
  node.append(stage, flash, top, bottom);
  root.append(node);
  let i = -1;
  let timer = 0;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    window.clearTimeout(timer);
    node.classList.add('out');
    window.setTimeout(() => {
      node.remove();
      done();
    }, 220);
  };
  const next = () => {
    i++;
    if (i >= shots.length) return finish();
    const s = shots[i]!;
    const bg = background(s.bg);
    bg.className = 'cut-bg';
    const frame = el('div', `cut-frame cam-${s.cam ?? 'pushIn'}`);
    frame.style.setProperty('--ms', `${s.ms}ms`);
    if (Array.isArray(s.focus)) {
      frame.style.transformOrigin = `${s.focus[0]}% ${s.focus[1]}%`;
      frame.style.setProperty('--z', `${s.focus[2]}`);
    }
    frame.append(bg);
    if (s.particles) frame.append(particles(s.particles));
    if (s.panels?.length) {
      const panels = el('div', `cut-panels n${s.panels.length}`);
      s.panels.forEach((p, k) => {
        const panel = el('div', `cut-panel p${k}`);
        panel.append(figure(art, p, 'in-panel'));
        panels.append(panel);
      });
      frame.append(panels);
    }
    const motion = s.motion ? ` move-${s.motion}` : '';
    const sil = s.silhouette ? ' silhouette' : '';
    if (s.species) {
      const fish = el('img', `cut-species${motion}${sil}`);
      fish.src = art.speciesImage(s.species) ?? '';
      fish.alt = '';
      frame.append(fish);
    }
    if (s.prop) {
      const prop = el('img', `cut-species cut-prop${motion}${sil}`);
      prop.src = art.texture(s.prop) ?? '';
      prop.alt = '';
      if (s.propSize) prop.style.width = `${s.propSize}%`;
      frame.append(prop);
    }
    if (s.polaroid) {
      // Foto auf dem Tisch: weißer Rahmen, Bild entwickelt sich langsam
      const photo = el('div', 'cut-polaroid');
      const pic = el('div', 'cut-polaroid-pic');
      for (const f of s.figures ?? []) pic.append(figure(art, f, 'in-photo'));
      const label = el('div', 'cut-polaroid-label');
      setRichText(label, s.caption ?? (s.captionKey ? art.text(s.captionKey) : ''));
      photo.append(pic, label);
      frame.append(photo);
    }
    const figs = s.polaroid ? [] : (s.figures ?? []);
    const lit = s.lightsOn ? ' lights-on' : '';
    if (figs.length === 1) frame.append(figure(art, figs[0]!, `solo${lit}`));
    if (figs.length >= 2) frame.append(figure(art, figs[0]!, `left${lit}`), figure(art, figs[1]!, `right${lit}`));
    if (s.fg) frame.append(el('div', `cut-fg fg-${s.fg}`));
    if (s.gleam) frame.append(el('div', 'cut-gleam'));
    if (s.fx?.length) frame.append(fxLayer(s.fx));
    const caption = s.polaroid ? '' : (s.caption ?? (s.captionKey ? art.text(s.captionKey) : ''));
    // Text steht im unteren Kinobalken, nie über dem Bild: kurze Texte groß, lange als Untertitel
    bottom.replaceChildren();
    if (caption) {
      const text = el('div', caption.length > 40 ? 'cut-caption long' : 'cut-caption');
      setRichText(text, caption);
      bottom.append(text);
    }
    stage.replaceChildren(frame);
    if (s.focus === 'eyes') {
      // Großaufnahme vom Kopf (obere ~60 % der Figur): so nah wie möglich, aber der ganze Kopf bleibt im Bild
      // Ruheposition aus dem Layout (ohne die Einspring-Animation)
      const fig = frame.querySelector<HTMLElement>('.cut-figure');
      const box = { width: frame.clientWidth, height: frame.clientHeight };
      if (fig) {
        const hx = fig.offsetLeft + fig.offsetWidth / 2 - (fig.classList.contains('solo') ? fig.offsetWidth / 2 : 0);
        const head = fig.offsetHeight * 0.62;
        const hy = fig.offsetTop + head / 2;
        // Platz lassen für die leichte Kamerafahrt (bis ×1.05)
        const z = Math.min(2.6, (box.height * 0.92) / head / 1.05, (box.width * 0.92) / fig.offsetWidth / 1.05);
        frame.style.transformOrigin = `${hx}px ${hy}px`;
        frame.style.setProperty('--z', `${Math.max(1, z)}`);
        frame.style.translate = `${box.width / 2 - hx}px ${box.height / 2 - hy}px`;
      }
    }
    if (s.flash) {
      flash.classList.remove('on');
      void flash.offsetWidth;
      flash.classList.add('on');
    }
    if (s.sfx) play(s.sfx);
    if (s.fx?.includes('flashbulb')) play('tap', 2);
    timer = window.setTimeout(next, s.ms);
  };
  node.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    finish();
  });
  navigator.vibrate?.(15);
  next();
}
