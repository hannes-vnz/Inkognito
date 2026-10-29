// Erzeugt Platzhaltergrafiken in den finalen Größen und Dateinamen (siehe Asset-Regeln in INKOGNITO.md),
// im Stil von ARTSTIL.md: 4-stufige Farbrampe, farbige Kontur, große Augen mit Glanzpunkt.
// Echte Grafiken ersetzen diese Dateien später 1:1. Aufruf: npm run assets:placeholders
import { deflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRng } from '../src/systems/rng.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const spritesDir = join(root, 'assets', 'sprites');
const bgDir = join(root, 'assets', 'backgrounds');
const iconsDir = join(root, 'assets', 'icons');
for (const d of [spritesDir, bgDir, iconsDir]) mkdirSync(d, { recursive: true });

// ---------------------------------------------------------------- PNG

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

/** Bild mit Float-Kanälen 0..1 für sauberes Überblenden. */
class Image {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.px = new Float32Array(width * height * 4);
  }
  blend(x, y, [r, g, b], a) {
    x = Math.round(x);
    y = Math.round(y);
    if (a <= 0 || x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    const p = this.px;
    const da = p[i + 3];
    const oa = a + da * (1 - a);
    p[i] = (r * a + p[i] * da * (1 - a)) / oa;
    p[i + 1] = (g * a + p[i + 1] * da * (1 - a)) / oa;
    p[i + 2] = (b * a + p[i + 2] * da * (1 - a)) / oa;
    p[i + 3] = oa;
  }
  set(x, y, [r, g, b], a = 1) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.px.set([r, g, b, a], (y * this.width + x) * 4);
  }
  alphaAt(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
    return this.px[(y * this.width + x) * 4 + 3];
  }
  toPng() {
    const { width, height } = this;
    const stride = width * 4;
    const raw = Buffer.alloc(stride);
    const prev = Buffer.alloc(stride);
    const rows = [];
    for (let y = 0; y < height; y++) {
      for (let i = 0; i < stride; i++) raw[i] = Math.round(Math.min(1, Math.max(0, this.px[y * stride + i])) * 255);
      const up = Buffer.alloc(stride);
      let sumNone = 0;
      let sumUp = 0;
      for (let i = 0; i < stride; i++) {
        up[i] = (raw[i] - prev[i]) & 0xff;
        sumNone += raw[i] < 128 ? raw[i] : 256 - raw[i];
        sumUp += up[i] < 128 ? up[i] : 256 - up[i];
      }
      rows.push(sumUp < sumNone ? Buffer.concat([Buffer.from([2]), up]) : Buffer.concat([Buffer.from([0]), raw]));
      raw.copy(prev);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  }
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const white = [1, 1, 1];
const ink = hex('#0e1a2b');
const save = (dir, name, img) => {
  writeFileSync(join(dir, name), img.toPng());
  console.log(`  ${join(dir, name).slice(root.length + 1)}  ${img.width}×${img.height}`);
};

/** Farbige Kontur um alle deckenden Pixel eines Bereichs. */
function outlineRegion(img, x0, y0, w, h, color) {
  const solid = (x, y) => x >= x0 && y >= y0 && x < x0 + w && y < y0 + h && img.alphaAt(x, y) > 0.5;
  const pts = [];
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++)
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) pts.push([x, y]);
  for (const [x, y] of pts) img.set(x, y, color);
}

/** Vierstufige Farbrampe aus einer Grundfarbe. */
const rampOf = (base) => ({
  outline: mix(base, hex('#1b1030'), 0.7),
  shadow: mix(base, hex('#1b1030'), 0.32),
  base,
  light: mix(base, white, 0.42),
});

/** Gefüllte Ellipse mit Licht von oben (Rampe). */
function ellipse(img, ox, oy, cx, cy, rx, ry, ramp) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      img.set(ox + x, oy + y, ny < -0.35 ? ramp.light : ny > 0.4 ? ramp.shadow : ramp.base);
    }
}

/** Großes Auge mit Glanzpunkt. */
function eye(img, x, y, r = 2, look = 1, color = white) {
  for (let dy = -r; dy < r; dy++) for (let dx = -r; dx < r; dx++) img.set(x + dx, y + dy, color);
  img.set(x + (look > 0 ? r - 1 : -r), y, hex('#1b1030'));
  img.set(x + (look > 0 ? r - 1 : -r), y - 1, hex('#1b1030'));
  img.set(x - r, y - r, white);
}

// ---------------------------------------------------------------- Bert, der verkleidete Oktopus (32×32)

/**
 * Reihen: idle (6), cast (4), cheer (4), sweat (4). Rosa Oktopus mit gelbem Fischerhut und
 * viel zu großem braunem Fake-Bart, unten schauen die Arme heraus.
 */
function drawBert() {
  const F = 32;
  const img = new Image(F * 6, F * 4);
  const skin = rampOf(hex('#ec5a84'));
  const beard = rampOf(hex('#8a5a2b'));
  const hat = rampOf(hex('#ffd23f'));
  const rows = [
    Array.from({ length: 6 }, (_, f) => ({ bob: f < 3 ? 0 : 1, arm: Math.sin((f / 6) * Math.PI * 2), blink: f === 4 })),
    [0, 1, 2, 3].map((f) => ({ bob: 0, arm: 0, cast: f })),
    [0, 1, 2, 3].map((f) => ({ bob: f % 2 ? -2 : 0, arm: f % 2 ? 1 : -1, cheer: true })),
    [0, 1, 2, 3].map((f) => ({ bob: f % 2, arm: 0.3, sweat: f })),
  ];
  rows.forEach((frames, row) =>
    frames.forEach((o, col) => {
      const ox = col * F;
      const oy = row * F;
      const b = o.bob;
      // Arme unten (schauen unter dem Bart hervor)
      for (let k = 0; k < 5; k++) {
        const ax = 9 + k * 3.5 + Math.round(Math.sin(k + (o.arm ?? 0) * 2) * 1);
        for (let y = 24; y < 30; y++) img.set(ox + ax, oy + y + (y > 27 ? 0 : 0), y > 27 ? skin.shadow : skin.base);
      }
      // Kopf
      ellipse(img, ox, oy, 16, 13 + b, 9, 8.5, skin);
      // Hut: Krempe und Kappe
      for (let x = 5; x < 27; x++) img.set(ox + x, oy + 7 + b, hat.shadow);
      ellipse(img, ox, oy, 16, 5.5 + b, 7, 3.6, hat);
      // Bart: große Wolke über Mund und Kinn
      for (const [bx, by, r] of [[11, 19, 4.2], [16, 21, 5.2], [21, 19, 4.2], [13, 23, 3.4], [19, 23, 3.4], [16, 25, 3]]) ellipse(img, ox, oy, bx, by + b, r, r, beard);
      // Arm mit Angel beim Auswerfen / Jubeln
      if (o.cast !== undefined) {
        const ang = [-2.2, -1.4, -0.4, 0.2][o.cast];
        for (let i = 0; i < 12; i++) img.set(ox + 24 + Math.cos(ang) * i, oy + 18 + Math.sin(ang) * i, hex('#6b4a2b'));
      }
      if (o.cheer) for (const side of [-1, 1]) for (let i = 0; i < 6; i++) img.set(ox + 16 + side * (9 + i * 0.4), oy + 15 + b - i, skin.base);
      outlineRegion(img, ox, oy, F, F, skin.outline);
      // Augen über dem Bart
      if (o.blink) for (const ex of [12, 19]) for (let x = -1; x <= 1; x++) img.set(ox + ex + x, oy + 13 + b, skin.outline);
      else {
        eye(img, ox + 13, oy + 13 + b, 2, 1);
        eye(img, ox + 20, oy + 13 + b, 2, 1);
      }
      if (o.sweat !== undefined) for (let i = 0; i < 3; i++) img.set(ox + 26, oy + 9 + b + i + (o.sweat % 2), hex('#9ff0ff'));
    }),
  );
  return img;
}

console.log('Figuren:');
save(spritesDir, 'player_octopus.png', drawBert());

// ---------------------------------------------------------------- Hafen-Figuren (32×32)

/** Reihen: idle (4), talk (4). Frame 0 dient als Porträt im Dialog. */
function drawNpc(def) {
  const F = 32;
  const img = new Image(F * 4, F * 2);
  for (let row = 0; row < 2; row++)
    for (let f = 0; f < 4; f++) {
      const ox = f * F;
      const oy = row * F;
      const b = f === 1 || f === 2 ? 1 : 0;
      const talk = row === 1 && f % 2 === 1;
      ({ hilde: drawHilde, bruno: drawBruno, qualle: drawQualle })[def.id](img, ox, oy, b, talk, f);
    }
  return img;
}

function mouth(img, x, y, w, open) {
  for (let i = 0; i < w; i++) img.set(x + i, y, ink);
  if (open) for (let i = 1; i < w - 1; i++) img.set(x + i, y + 1, hex('#8a2030'));
}

/** Hafenmeisterin: blaue Jacke, Kapitänsmütze, zusammengekniffene Augen (misstrauisch). */
function drawHilde(img, ox, oy, b, talk, f) {
  const skin = rampOf(hex('#f2c09a'));
  const coat = rampOf(hex('#3f6fa8'));
  const cap = rampOf(hex('#f4f1e8'));
  const hair = rampOf(hex('#b8b8c8'));
  ellipse(img, ox, oy, 16, 27, 10, 6, coat);
  for (let y = 23; y < 32; y++) img.set(ox + 16, oy + y, coat.shadow);
  for (const bx of [14, 18]) img.set(ox + bx, oy + 26, hex('#ffd23f'));
  ellipse(img, ox, oy, 9, 14 + b, 3, 5, hair);
  ellipse(img, ox, oy, 23, 14 + b, 3, 5, hair);
  ellipse(img, ox, oy, 16, 14 + b, 7.5, 7.5, skin);
  ellipse(img, ox, oy, 16, 6 + b, 8, 3.2, cap);
  for (let x = 8; x < 25; x++) img.set(ox + x, oy + 8 + b, hex('#1b2a4a'));
  img.set(ox + 16, oy + 5 + b, hex('#ffd23f'));
  outlineRegion(img, ox, oy, 32, 32, coat.outline);
  // Misstrauischer Blick: schmale Augen, eine Braue hoch
  const look = f === 3 ? -1 : 1;
  for (const ex of [12, 19]) for (let x = 0; x < 3; x++) img.set(ox + ex + x, oy + 13 + b, ink);
  img.set(ox + (look > 0 ? 14 : 12), oy + 13 + b, white);
  img.set(ox + (look > 0 ? 21 : 19), oy + 13 + b, white);
  for (let x = 11; x < 15; x++) img.set(ox + x, oy + 11 + b, hair.outline);
  for (let x = 18; x < 22; x++) img.set(ox + x, oy + 10 + b - (x > 19 ? 1 : 0), hair.outline);
  mouth(img, ox + 14, oy + 18 + b, 4, talk);
}

/** Bruno: grauer Hai im beigen Trenchcoat mit Hut, Rückenflosse schaut hinten heraus. */
function drawBruno(img, ox, oy, b, talk) {
  const shark = rampOf(hex('#7f93a6'));
  const coat = rampOf(hex('#b8925a'));
  const hat = rampOf(hex('#4a3a30'));
  // Rückenflosse durch den Mantel
  for (let y = 0; y < 7; y++) for (let x = 0; x <= 6 - y; x++) img.set(ox + 25 + x, oy + 15 + y + b, shark.base);
  ellipse(img, ox, oy, 16, 27, 11, 6, coat);
  for (let y = 22; y < 32; y++) img.set(ox + 15 + (y % 3 === 0 ? 1 : 0), oy + y, coat.shadow);
  for (let x = 11; x < 21; x++) img.set(ox + x, oy + 24, coat.light);
  ellipse(img, ox, oy, 16, 15 + b, 10, 7, shark);
  ellipse(img, ox, oy, 16, 18 + b, 7, 3, rampOf(hex('#e8edf2')));
  ellipse(img, ox, oy, 16, 7 + b, 6.5, 3, hat);
  for (let x = 6; x < 27; x++) img.set(ox + x, oy + 9 + b, hat.shadow);
  for (let x = 10; x < 23; x++) img.set(ox + x, oy + 8 + b, hex('#c23b3b'));
  outlineRegion(img, ox, oy, 32, 32, shark.outline);
  eye(img, ox + 11, oy + 13 + b, 1.5, -1);
  eye(img, ox + 21, oy + 13 + b, 1.5, 1);
  // Zahnreihe, offen beim Reden
  for (let x = 11; x < 22; x++) img.set(ox + x, oy + 18 + b, ink);
  for (let x = 11; x < 22; x += 2) img.set(ox + x, oy + 19 + b, white);
  if (talk) for (let x = 12; x < 21; x++) img.set(ox + x, oy + 20 + b, hex('#8a2030'));
}

/** Professorin Qualle: lila Glocke mit runder Brille und Tentakeln, schwebt. */
function drawQualle(img, ox, oy, b, talk, f) {
  const bell = rampOf(hex('#c78cff'));
  const bb = f % 2 ? 1 : 0;
  for (let k = 0; k < 5; k++) {
    const tx = 9 + k * 3.5;
    for (let y = 18; y < 31; y++) img.set(ox + Math.round(tx + Math.sin(y * 0.6 + f + k) * 1.2), oy + y + bb, y % 4 === 0 ? bell.light : bell.base);
  }
  ellipse(img, ox, oy, 16, 12 + bb, 11, 9, bell);
  for (let x = 6; x < 27; x++) img.set(ox + x, oy + 18 + bb, bell.shadow);
  outlineRegion(img, ox, oy, 32, 32, bell.outline);
  // Brille
  const glass = hex('#1b1030');
  for (const cx of [12, 20]) {
    for (let a = 0; a < 16; a++) img.set(ox + Math.round(cx + Math.cos((a / 16) * Math.PI * 2) * 3), oy + Math.round(12 + bb + Math.sin((a / 16) * Math.PI * 2) * 3), glass);
    eye(img, ox + cx + 1, oy + 12 + bb, 1.5, 1);
  }
  img.set(ox + 16, oy + 11 + bb, glass);
  img.set(ox + 15, oy + 11 + bb, glass);
  mouth(img, ox + 14, oy + 16 + bb, 4, talk);
  // Glitzer (Biolumineszenz)
  img.set(ox + 9, oy + 7 + bb, white);
  if (f === 2) img.set(ox + 23, oy + 6 + bb, hex('#9ff0ff'));
}

const npcDefs = JSON.parse(readFileSync(join(root, 'data', 'npcs.json'), 'utf8'));
for (const def of npcDefs) save(spritesDir, `${def.sprite}.png`, drawNpc(def));

// ---------------------------------------------------------------- Arten aus data/fish.json

/**
 * Spritesheet je Art: Reihen idle, swim, turn, catch mit je 4 Frames, schaut nach rechts.
 * Platzhalter mit den typischen Merkmalen der echten Art.
 */
function drawSpecies(def) {
  const fw = def.frame.width;
  const fh = def.frame.height;
  const ramp = rampOf(hex(def.placeholderColor));
  const img = new Image(fw * 4, fh * 4);
  const glow = hex('#7dfff0');
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 4; col++) {
      const ox = col * fw;
      const oy = row * fh;
      const wag = [0, 1, 0, -1][col] * (row === 1 ? 1.5 : 0.7);
      const squash = row === 2 ? [0.45, 0.7, 0.9, 1][col] : 1;
      const cx = fw * 0.56;
      const cy = fh / 2;
      const tail = (len, half) => {
        const tx = Math.round(cx - (fw * 0.36) * squash);
        for (let i = 0; i < len; i++) {
          const h = Math.round((i / len) * half) + 1;
          for (let y = -h; y <= h; y++) img.set(ox + tx - i, oy + cy + y + Math.round(wag * (i / len)), ramp.shadow);
        }
      };
      switch (def.shape) {
        case 'round': {
          ellipse(img, ox, oy, cx, cy, (fw * 0.38) * squash, fh * 0.36, ramp);
          for (let i = 0; i < 7; i++) {
            img.set(ox + cx - 1, oy + 2 + i * 0.6 - wag, ramp.shadow);
            img.set(ox + cx - 1, oy + fh - 3 - i * 0.6 + wag, ramp.shadow);
          }
          for (let y = -4; y <= 4; y++) img.set(ox + cx - fw * 0.38 * squash, oy + cy + y, ramp.light);
          break;
        }
        case 'eel': {
          for (let i = 0; i < fw * 0.6; i++) {
            const y = cy + Math.sin(i * 0.5 + col) * 1.5;
            img.set(ox + fw * 0.6 - i, oy + y, ramp.base);
            img.set(ox + fw * 0.6 - i, oy + y + 1, ramp.shadow);
          }
          ellipse(img, ox, oy, fw * 0.74, cy, fw * 0.16 * squash, fh * 0.42, ramp);
          for (let x = 0; x < fw * 0.12; x++) img.set(ox + fw * 0.8 + x, oy + cy, hex('#1b1030'));
          break;
        }
        case 'dumbo': {
          ellipse(img, ox, oy, fw / 2, fh * 0.42, fw * 0.3 * squash, fh * 0.32, ramp);
          for (const side of [-1, 1]) ellipse(img, ox, oy, fw / 2 + side * fw * 0.3, fh * 0.3 + wag * 0.5, 2.5, 3.5, ramp);
          for (let k = 0; k < 4; k++) for (let y = 0; y < 4; y++) img.set(ox + fw * 0.3 + k * 3, oy + fh * 0.7 + y, ramp.shadow);
          break;
        }
        case 'pig': {
          ellipse(img, ox, oy, fw / 2, fh * 0.5, fw * 0.42 * squash, fh * 0.3, ramp);
          for (let k = 0; k < 5; k++) for (let y = 0; y < 3; y++) img.set(ox + 4 + k * 3, oy + fh * 0.76 + y + (k % 2 === col % 2 ? 0 : -1), ramp.shadow);
          for (let k = 0; k < 3; k++) img.set(ox + 5 + k * 2, oy + fh * 0.2, ramp.light);
          break;
        }
        case 'shrimp': {
          for (let k = 0; k < 4; k++) ellipse(img, ox, oy, 4 + k * 3, cy, 2.3, fh * 0.32, ramp);
          for (let k = 0; k < 4; k++) for (let y = 0; y < 3; y++) img.set(ox + 3 + k * 3 + (col % 2), oy + cy + 3 + y, ramp.shadow);
          for (let i = 0; i < 4; i++) img.set(ox + 14 + i * 0.4, oy + cy - 2 - i, ramp.shadow);
          break;
        }
        case 'jelly': {
          // Gasblase oben, Tentakel nach unten
          ellipse(img, ox, oy, fw / 2, fh * 0.3, fw * 0.42 * squash, fh * 0.24, ramp);
          for (let k = 0; k < 4; k++) for (let y = fh * 0.5; y < fh - 1; y++) img.set(ox + 4 + k * 3 + Math.round(Math.sin(y * 0.6 + col + k) * 1), oy + y, k % 2 ? ramp.shadow : hex('#5ce1e6'));
          for (let x = 3; x < fw - 3; x++) img.set(ox + x, oy + fh * 0.12 + Math.round(Math.sin(x) * 1), ramp.light);
          break;
        }
        case 'squid': {
          // Mantel hinten (links), Kopf, Arme nach rechts, große Augen
          ellipse(img, ox, oy, fw * 0.3, cy, fw * 0.24 * squash, fh * 0.3, ramp);
          for (let x = 2; x < fw * 0.12; x++) for (let y = -2; y <= 2; y++) if (Math.abs(y) < x * 0.6) img.set(ox + x, oy + cy + y, ramp.shadow);
          for (let k = 0; k < 5; k++) for (let x = 0; x < fw * 0.42; x++) img.set(ox + fw * 0.55 + x, oy + cy - 4 + k * 2 + Math.round(Math.sin(x * 0.4 + col + k) * (x / 12)), k % 2 ? ramp.shadow : ramp.base);
          break;
        }
        case 'vampire': {
          // Glocke mit Hautschirm zwischen den Armen, dunkelrot
          ellipse(img, ox, oy, fw * 0.42, fh * 0.42, fw * 0.3 * squash, fh * 0.32, ramp);
          for (let y = fh * 0.55; y < fh - 1; y++) for (let x = fw * 0.15; x < fw * 0.85; x++) if (Math.abs(x - fw / 2) < (fh - y) * 0.9 + 2) img.set(ox + x, oy + y, ramp.shadow);
          for (const side of [-1, 1]) ellipse(img, ox, oy, fw * 0.42 + side * fw * 0.28, fh * 0.22, 2, 3, ramp);
          break;
        }
        case 'wings': {
          tail(Math.max(3, Math.round(fw * 0.2)), fh * 0.3);
          ellipse(img, ox, oy, cx, cy + 1, (fw * 0.36) * squash, fh * 0.3, ramp);
          // große Brustflossen als Flügel
          for (let i = 0; i < fw * 0.4; i++) for (let y = 0; y < 3; y++) img.set(ox + cx - i * 0.6, oy + cy - 2 - y - Math.round(i * 0.25 * (col % 2 ? 1 : 0.6)), mix(ramp.light, white, 0.3));
          break;
        }
        case 'belly': {
          tail(4, fh * 0.25);
          ellipse(img, ox, oy, cx - 1, cy - 2, (fw * 0.34) * squash, fh * 0.26, ramp);
          ellipse(img, ox, oy, cx - 2, cy + 3, (fw * 0.24) * squash, fh * 0.28, rampOf(hex('#4a3f5a')));
          break;
        }
        case 'fangs': {
          tail(4, fh * 0.3);
          ellipse(img, ox, oy, cx, cy, (fw * 0.36) * squash, fh * 0.42, ramp);
          for (let i = 0; i < 3; i++) for (let y = 0; y < 3 + (i % 2); y++) img.set(ox + cx + fw * 0.26 + i * 1.5, oy + cy + 1 + y, white);
          break;
        }
        case 'stilts': {
          tail(5, fh * 0.2);
          ellipse(img, ox, oy, cx, fh * 0.32, (fw * 0.38) * squash, fh * 0.2, ramp);
          for (const sx of [0.2, 0.5, 0.75]) for (let y = fh * 0.45; y < fh - 1; y++) img.set(ox + fw * sx, oy + y, ramp.shadow);
          break;
        }
        case 'flat': {
          // Plattfisch von der Seite: flache Scheibe mit Flossensaum, beide Augen oben
          tail(3, fh * 0.25);
          ellipse(img, ox, oy, cx, cy + 1, (fw * 0.4) * squash, fh * 0.34, ramp);
          for (let x = -fw * 0.36; x < fw * 0.36; x += 2) {
            img.set(ox + cx + x, oy + cy + 1 - fh * 0.38 + ((x + col) % 4 === 0 ? 0 : 1), ramp.shadow);
            img.set(ox + cx + x, oy + cy + 1 + fh * 0.38, ramp.shadow);
          }
          for (let k = 0; k < 4; k++) img.set(ox + cx - 4 + k * 3, oy + cy + 1 + (k % 2), hex('#e8743a'));
          break;
        }
        case 'star': {
          // Fünf Arme um die Mitte, dreht sich langsam
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * Math.PI * 2 + col * 0.15 - Math.PI / 2;
            for (let r = 0; r < fw * 0.46; r++) {
              const w = Math.max(0, 2.2 - r * 0.28);
              for (let d = -w; d <= w; d++) img.set(ox + fw / 2 + Math.cos(a) * r - Math.sin(a) * d, oy + fh / 2 + Math.sin(a) * r + Math.cos(a) * d, r % 3 === 0 ? ramp.light : ramp.base);
            }
          }
          ellipse(img, ox, oy, fw / 2, fh / 2, 3, 3, ramp);
          break;
        }
        case 'crab': {
          // Breiter Panzer, Beinchen, zwei Scheren vorne
          ellipse(img, ox, oy, fw / 2, fh * 0.5, fw * 0.36 * squash, fh * 0.28, ramp);
          for (let k = 0; k < 4; k++)
            for (const side of [-1, 1]) for (let i = 0; i < 3; i++) img.set(ox + fw / 2 + side * (fw * 0.28 + i), oy + fh * 0.55 + k * 1.5 + i * 0.6 + ((col + k) % 2), ramp.shadow);
          for (const side of [-1, 1]) ellipse(img, ox, oy, fw / 2 + side * fw * 0.38, fh * 0.26 - (col % 2), 2.4, 2, ramp);
          break;
        }
        default: {
          tail(Math.max(3, Math.round(fw * 0.2)), fh * 0.34);
          ellipse(img, ox, oy, cx, cy, (fw * 0.36) * squash, fh * 0.4, ramp);
          for (let i = 0; i < fw * 0.25; i++) if (i % 3 !== 2) img.set(ox + cx - fw * 0.1 + i, oy + cy - fh * 0.4 - 1, ramp.shadow);
        }
      }
      outlineRegion(img, ox, oy, fw, fh, ramp.outline);
      // Augen und Merkmale
      const eyeAt = {
        dumbo: [fw * 0.6, fh * 0.42],
        pig: [fw * 0.6, cy - 1],
        shrimp: [14, cy - 1],
        jelly: [fw * 0.62, fh * 0.3],
        squid: [fw * 0.5, cy - 1],
        vampire: [fw * 0.55, fh * 0.4],
        stilts: [cx + fw * 0.24 * squash, fh * 0.3],
        flat: [cx + fw * 0.26, cy - fh * 0.12],
        star: [fw / 2 + 1, fh / 2],
        crab: [fw / 2 + 2, fh * 0.36],
      }[def.shape] ?? [cx + fw * 0.24 * squash, cy - 1];
      const ex = Math.round(ox + eyeAt[0]);
      const ey = Math.round(oy + eyeAt[1]);
      if (def.id === 'barreleye') {
        // durchsichtige Kuppel mit grünen Augen darin
        for (let x = -3; x <= 3; x++) for (let y = -4; y <= 0; y++) if (x * x + y * y * 0.6 < 10) img.blend(ex + x - 1, ey + y - 1, hex('#e8fff8'), 0.55);
        eye(img, ex - 1, ey - 2, 1.5, 1, hex('#8cff5a'));
      } else eye(img, ex, ey, def.id === 'giant_squid' ? 3 : fh >= 12 ? 2 : 1.5, 1, def.id === 'vampire_squid' ? hex('#ff7a7a') : white);
      if (def.id === 'viperfish') for (let i = 0; i < 3; i++) img.set(ex + 2 + i, ey + 3 + (i % 2), white);
      if (def.id === 'anglerfish') {
        const top = Math.max(oy + 2, ey - 7);
        for (let y = ey - 3; y > top; y--) img.set(ex + 1 + (ey - 3 - y) * 0.5, y, ramp.outline);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) img.set(Math.min(ox + fw - 2, ex + 3) + dx, top + dy, glow);
        for (let i = 0; i < 4; i++) img.set(ex + 2 + i, oy + cy + 3, white);
      }
      if (def.glow && def.id !== 'anglerfish') for (let k = 0; k < 4; k++) img.set(ox + cx - fw * 0.2 + k * 3, oy + cy + fh * 0.32, glow);
    }
  return img;
}

const fishDefs = JSON.parse(readFileSync(join(root, 'data', 'fish.json'), 'utf8'));
console.log('Arten:');
for (const def of fishDefs) save(spritesDir, `${def.sprite}.png`, drawSpecies(def));

// ---------------------------------------------------------------- Boot, Haken, Effekte

/** Kleiner Fischkutter 64×32: Rumpf, Kajüte, Mast. Anker unten mittig. */
function drawBoat() {
  const img = new Image(64, 32);
  const hull = rampOf(hex('#d9573b'));
  const cabin = rampOf(hex('#f2ead8'));
  for (let y = 20; y < 30; y++) {
    const inset = Math.round((y - 20) * 0.9);
    for (let x = 2 + inset; x < 62 - inset * 0.6; x++) img.set(x, y, y < 22 ? hull.light : y > 26 ? hull.shadow : hull.base);
  }
  for (let x = 2; x < 62; x++) img.set(x, 20, cabin.light);
  for (let y = 10; y < 20; y++) for (let x = 30; x < 50; x++) img.set(x, y, y < 12 ? cabin.light : cabin.base);
  for (let y = 12; y < 16; y++) for (let x = 34; x < 46; x++) img.set(x, y, (x - 34) % 6 < 4 ? hex('#5ce1e6') : cabin.base);
  for (let y = 2; y < 20; y++) img.set(22, y, hex('#6b4a2b'));
  for (let x = 2; x < 60; x += 6) img.set(x, 24, hex('#fff6e0'));
  outlineRegion(img, 0, 0, 64, 32, ink);
  return img;
}

/** Kutter von oben (32×32), Bug zeigt nach rechts; Phaser dreht ihn in Fahrtrichtung. */
function drawBoatTop() {
  const img = new Image(32, 32);
  const hull = rampOf(hex('#d9503f'));
  const deck = rampOf(hex('#c8a26a'));
  for (let y = 9; y < 23; y++)
    for (let x = 3; x < 30; x++) {
      const ny = Math.abs(y - 15.5) / 7;
      const bow = x > 20 ? (x - 20) / 10 : 0;
      if (ny > 1 - bow * bow * 0.9) continue;
      img.set(x, y, ny > 0.75 ? hull.shadow : hull.base);
    }
  for (let y = 11; y < 21; y++) for (let x = 6; x < 22; x++) if (Math.abs(y - 15.5) < 4) img.set(x, y, (x + y) % 4 === 0 ? deck.shadow : deck.base);
  for (let y = 12; y < 20; y++) for (let x = 8; x < 14; x++) img.set(x, y, hex('#f4f1e8'));
  for (let y = 13; y < 15; y++) for (let x = 9; x < 13; x++) img.set(x, y, hex('#5cd6e6'));
  img.set(17, 15, hex('#ffd23f'));
  img.set(17, 16, hex('#ec5a84'));
  outlineRegion(img, 0, 0, 32, 32, hull.outline);
  return img;
}

/** Boje für Angelplätze (16×24): rot-weiß mit gelber Fahne. */
function drawBuoy() {
  const img = new Image(16, 24);
  for (let y = 0; y < 8; y++) for (let x = 8; x < 8 + (8 - y) / 1.6; x++) img.set(x, y + 1, hex('#ffd23f'));
  for (let y = 0; y < 14; y++) img.set(7, y, hex('#3a2a20'));
  ellipse(img, 0, 0, 8, 17, 6, 5, rampOf(hex('#d9503f')));
  for (let x = 2; x < 14; x++) img.set(x, 17, white);
  outlineRegion(img, 0, 0, 16, 24, hex('#1b1030'));
  return img;
}

/** Flaschenpost (16×16): grüne Flasche mit Brief und Korken, schräg. */
function drawBottle() {
  const img = new Image(16, 16);
  const glass = rampOf(hex('#5fbf7a'));
  for (let i = 0; i < 10; i++) for (let w = -2; w <= 2; w++) img.set(3 + i + w * 0.5, 12 - i * 0.8 + w, i > 7 ? glass.shadow : glass.base);
  for (let i = 2; i < 7; i++) img.set(4 + i, 11 - i * 0.8, hex('#f2e2b6'));
  img.set(13, 3, hex('#8a5a2b'));
  img.set(14, 2, hex('#8a5a2b'));
  img.set(5, 9, white);
  outlineRegion(img, 0, 0, 16, 16, glass.outline);
  return img;
}

/** Treibgut-Kiste (16×16). */
function drawCrate() {
  const img = new Image(16, 16);
  const wood = rampOf(hex('#b07a3a'));
  for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) img.set(x, y, y === 3 || x === 3 ? wood.light : (x + y) % 5 === 0 ? wood.shadow : wood.base);
  for (let i = 3; i < 13; i++) { img.set(i, i, wood.shadow); img.set(i, 15 - i, wood.shadow); }
  outlineRegion(img, 0, 0, 16, 16, wood.outline);
  return img;
}

function drawHook() {
  const img = new Image(8, 12);
  const steel = hex('#cfd8e3');
  for (let y = 0; y < 8; y++) img.set(5, y, steel);
  for (const [x, y] of [[5, 8], [4, 9], [3, 9], [2, 8], [1, 7], [1, 6]]) img.set(x, y, steel);
  img.set(2, 6, steel);
  outlineRegion(img, 0, 0, 8, 12, ink);
  return img;
}

console.log('Boot und Haken:');
save(spritesDir, 'boat_1.png', drawBoat());
save(spritesDir, 'hook.png', drawHook());
save(spritesDir, 'boat_top.png', drawBoatTop());
save(spritesDir, 'buoy.png', drawBuoy());
save(spritesDir, 'fx_crate.png', drawCrate());
save(spritesDir, 'fx_bottle.png', drawBottle());

const bubble = new Image(8, 8);
for (let y = 0; y < 8; y++)
  for (let x = 0; x < 8; x++) {
    const d = Math.hypot(x + 0.5 - 4, y + 0.5 - 4);
    if (d <= 3.6 && d > 2.4) bubble.set(x, y, hex('#d8fbff'), 0.9);
    else if (d <= 2.4) bubble.set(x, y, hex('#9ff0ff'), 0.25);
  }
bubble.set(2, 2, white, 1);
save(spritesDir, 'fx_bubble.png', bubble);

// ---------------------------------------------------------------- Icons (16×16)

function icon(draw) {
  const img = new Image(16, 16);
  draw(img);
  outlineRegion(img, 0, 0, 16, 16, ink);
  return img;
}
console.log('Icons:');
save(spritesDir, 'icon_coin.png', icon((img) => {
  const r = rampOf(hex('#ffd23f'));
  ellipse(img, 0, 0, 8, 8, 6, 6, r);
  for (let y = 5; y < 11; y++) img.set(8, y, r.shadow);
}));
save(spritesDir, 'icon_fish.png', icon((img) => {
  const r = rampOf(hex('#ff7a1a'));
  ellipse(img, 0, 0, 9, 8, 5, 3.6, r);
  for (let i = 0; i < 4; i++) for (let y = 8 - i - 1; y <= 8 + i; y++) img.set(4 - i + 1, y, r.shadow);
  eye(img, 11, 8, 1, 1);
}));
save(spritesDir, 'icon_book.png', icon((img) => {
  const r = rampOf(hex('#5ce1e6'));
  for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) img.set(x, y, x < 5 ? r.shadow : y < 5 ? r.light : r.base);
  for (let y = 4; y < 12; y++) img.set(8, y, r.outline);
}));
save(spritesDir, 'icon_map.png', icon((img) => {
  const paper = rampOf(hex('#f2e2b6'));
  for (let y = 3; y < 13; y++) for (let x = 2; x < 14; x++) img.set(x, y, Math.floor((x - 2) / 4) % 2 ? paper.shadow : paper.base);
  for (const [x, y] of [[4, 10], [5, 9], [6, 9], [7, 8], [8, 7], [9, 7]]) img.set(x, y, hex('#d9503f'));
  for (const [x, y] of [[10, 5], [11, 6], [10, 7], [11, 4], [12, 5]]) img.set(x, y, hex('#d9503f'));
}));

// ---------------------------------------------------------------- Hintergründe (1920×1080)

const W = 1920;
const H = 1080;
const rng = createRng('placeholder-sea');
console.log('Hintergründe:');
{
  // Himmel mit Wolkenbändern wie im Vorbild
  const img = new Image(W, H);
  const top = hex('#2fb6b8');
  const bottom = hex('#bff0e8');
  for (let y = 0; y < H; y++) {
    const c = mix(top, bottom, y / H);
    for (let x = 0; x < W; x++) img.set(x, y, c);
  }
  const cloud = hex('#f2fbf8');
  for (let i = 0; i < 18; i++) {
    const cx = rng.range(0, W);
    const cy = rng.range(80, H * 0.6);
    for (let b = 0; b < 6; b++) {
      const bx = cx + rng.range(-120, 120);
      const by = cy + rng.range(-20, 20);
      const r = rng.range(30, 70);
      for (let y = Math.floor(by - r); y < by + r; y++)
        for (let x = Math.floor(bx - r); x < bx + r; x++) {
          const d = Math.hypot(x - bx, y - by);
          if (d < r && y < by + r * 0.3) img.blend(x, y, mix(cloud, top, clamp01((y - by) / r) * 0.25), 0.85);
        }
    }
  }
  save(bgDir, 'bg_sea_0.png', img);
}
{
  // Felsinseln am Horizont (unten verankert)
  const img = new Image(W, H);
  const rock = hex('#5f8f8a');
  const green = hex('#6fae4f');
  for (let i = 0; i < 9; i++) {
    const cx = rng.range(0, W);
    const w = rng.range(60, 180);
    const h = rng.range(160, 420);
    for (let y = Math.floor(H - h); y < H; y++) {
      const t = (y - (H - h)) / h;
      const half = w * (0.35 + 0.65 * Math.sqrt(t)) * (0.85 + 0.15 * Math.sin(y * 0.05 + i));
      for (let x = Math.floor(cx - half); x < cx + half; x++) img.set(((x % W) + W) % W, y, t < 0.12 ? green : x < cx - half * 0.4 ? mix(rock, white, 0.15) : rock);
    }
  }
  save(bgDir, 'bg_sea_1.png', img);
}
