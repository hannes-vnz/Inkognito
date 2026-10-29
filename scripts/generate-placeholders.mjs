// Erzeugt Platzhaltergrafiken in den finalen Größen und Dateinamen (siehe Asset-Regeln in INKOGNITO.md).
// Echte Grafiken ersetzen diese Dateien später 1:1. Aufruf: npm run assets:placeholders
import { deflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRng } from '../src/systems/rng.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const spritesDir = join(root, 'assets', 'sprites');
const bgDir = join(root, 'assets', 'backgrounds');
mkdirSync(spritesDir, { recursive: true });
mkdirSync(bgDir, { recursive: true });

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

/** Image: RGBA mit Float-Kanälen 0..1 für sauberes Überblenden. */
class Image {
  constructor(width, height, wrap = false) {
    this.width = width;
    this.height = height;
    this.wrap = wrap;
    this.px = new Float32Array(width * height * 4);
  }
  /** Alpha-Blending „über“ das Vorhandene. */
  blend(x, y, [r, g, b], a) {
    if (a <= 0) return;
    if (this.wrap) {
      x = ((x % this.width) + this.width) % this.width;
      y = ((y % this.height) + this.height) % this.height;
    } else if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    const p = this.px;
    const da = p[i + 3];
    const oa = a + da * (1 - a);
    if (oa <= 0) return;
    p[i] = (r * a + p[i] * da * (1 - a)) / oa;
    p[i + 1] = (g * a + p[i + 1] * da * (1 - a)) / oa;
    p[i + 2] = (b * a + p[i + 2] * da * (1 - a)) / oa;
    p[i + 3] = oa;
  }
  set(x, y, [r, g, b], a = 1) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    this.px.set([r, g, b, a], i);
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
      for (let i = 0; i < stride; i++) {
        raw[i] = Math.round(Math.min(1, Math.max(0, this.px[y * stride + i])) * 255);
      }
      // Filter „Up“ wenn günstiger: identische Zeilen (Verläufe) komprimieren dann fast auf null.
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
    ihdr[8] = 8; // Bit-Tiefe
    ihdr[9] = 6; // RGBA
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
const save = (dir, name, img) => {
  writeFileSync(join(dir, name), img.toPng());
  console.log(`  ${join(dir, name).slice(root.length + 1)}  ${img.width}×${img.height}`);
};

// ---------------------------------------------------------------- Oktopus (32×32 je Frame)

const FRAME = 32;
const ramp = {
  outline: hex('#5a1846'),
  shadow: hex('#b8346a'),
  base: hex('#ec5a84'),
  light: hex('#ff9fb6'),
  suction: hex('#ffd2db'),
};
const white = [1, 1, 1];
const pupil = hex('#1b1030');

/**
 * Zeichnet einen Frame. `opts`: headSquash, eyeShift (−3..3, + = nach rechts), arms(t) → Liste von Arm-Polylinien.
 */
function drawOctopusFrame(img, ox, oy, opts) {
  const mask = new Int8Array(FRAME * FRAME); // 0 leer, 1 Körper, 2 Arm
  const cx = 15.5;
  const cy = 11.5 + (opts.headBob ?? 0);
  const rx = 8.5 * (1 + (opts.headSquash ?? 0));
  const ry = 8 * (1 - (opts.headSquash ?? 0));

  // Arme zuerst (liegen hinter dem Kopf), als dicke Linien.
  for (const arm of opts.arms) {
    for (let i = 0; i < arm.length; i++) {
      const [x, y, w] = arm[i];
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          if (dx * dx + dy * dy > w * w) continue;
          const px = Math.round(x + dx);
          const py = Math.round(y + dy);
          if (px >= 1 && py >= 1 && px < FRAME - 1 && py < FRAME - 1) mask[py * FRAME + px] ||= 2;
        }
    }
  }
  for (let y = 0; y < FRAME; y++)
    for (let x = 0; x < FRAME; x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1 && x >= 1 && y >= 1 && x < FRAME - 1 && y < FRAME - 1) mask[y * FRAME + x] = 1;
    }

  // Füllen mit 4-stufiger Farbrampe (Licht von oben rechts).
  for (let y = 0; y < FRAME; y++)
    for (let x = 0; x < FRAME; x++) {
      const m = mask[y * FRAME + x];
      if (!m) continue;
      let color = ramp.base;
      if (m === 1) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        const lightness = nx * 0.45 - ny * 0.75;
        if (lightness > 0.45) color = ramp.light;
        else if (lightness < -0.45) color = ramp.shadow;
      } else {
        const below = mask[(y + 1) * FRAME + x];
        if (!below) color = ramp.shadow;
        else if ((x * 3 + y * 5) % 11 === 0 && y > cy + ry) color = ramp.suction;
      }
      img.set(ox + x, oy + y, color);
    }

  // Farbige Outline um alles herum.
  for (let y = 0; y < FRAME; y++)
    for (let x = 0; x < FRAME; x++) {
      if (mask[y * FRAME + x]) continue;
      const n =
        (x > 0 && mask[y * FRAME + x - 1]) ||
        (x < FRAME - 1 && mask[y * FRAME + x + 1]) ||
        (y > 0 && mask[(y - 1) * FRAME + x]) ||
        (y < FRAME - 1 && mask[(y + 1) * FRAME + x]);
      if (n) img.set(ox + x, oy + y, ramp.outline);
    }

  // Große Augen mit Glanzpunkt.
  const eyeY = Math.round(cy + 1);
  const shift = opts.eyeShift ?? 2;
  for (const ex of [Math.round(cx - 3.5 + shift), Math.round(cx + 2.5 + shift)]) {
    for (let dy = -2; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) img.set(ox + ex + dx, oy + eyeY + dy, white);
    const lookX = shift > 0 ? 1 : shift < 0 ? -1 : 0;
    img.set(ox + ex + lookX, oy + eyeY, pupil);
    img.set(ox + ex + lookX, oy + eyeY - 1, pupil);
    img.set(ox + ex + lookX - (lookX || 1), oy + eyeY - 1, pupil);
    img.set(ox + ex + lookX - (lookX || 1), oy + eyeY, pupil);
    img.set(ox + ex - 1, oy + eyeY - 2, white); // Glanzpunkt
    if (opts.blink) for (let dx = -1; dx <= 1; dx++) for (let dy = -2; dy <= 1; dy++) img.set(ox + ex + dx, oy + eyeY + dy, ramp.base);
    if (opts.blink) for (let dx = -1; dx <= 1; dx++) img.set(ox + ex + dx, oy + eyeY, ramp.outline);
  }
  return mask;
}

/** Arme als Polylinien: hängen vom Kopf, Welle über `phase`, Neigung `sweep` (− = nach hinten links). */
function armSet({ phase, amp, sweep = 0, reach = 0, length = 12 }) {
  const roots = [9.5, 13.5, 17.5, 21.5];
  return roots.map((rx, k) => {
    const pts = [];
    for (let s = 0; s <= length; s++) {
      const t = s / length;
      const wave = Math.sin(phase + k * 1.3 + t * 3.2) * amp * t;
      const x = rx + wave + sweep * t * t * 10 + reach * t * 12;
      const y = 17 + s * (1 - Math.abs(sweep) * 0.35 - Math.abs(reach) * 0.4);
      pts.push([x, y, t < 0.5 ? 1.6 : t < 0.85 ? 1.1 : 0.6]);
    }
    return pts;
  });
}

const sheet = new Image(FRAME * 6, FRAME * 4);
const normal = new Image(FRAME * 6, FRAME * 4);
const rows = [
  // idle: sanftes Wabern, einmal blinzeln
  Array.from({ length: 6 }, (_, f) => ({
    arms: armSet({ phase: (f / 6) * Math.PI * 2, amp: 1.4 }),
    headBob: f < 3 ? 0 : 0.5,
    blink: f === 4,
  })),
  // swim: Arme schlagen nach hinten, Kopf staucht im Takt
  Array.from({ length: 6 }, (_, f) => ({
    arms: armSet({ phase: (f / 6) * Math.PI * 2, amp: 2.4, sweep: -0.5 + Math.sin((f / 6) * Math.PI * 2) * 0.15 }),
    headSquash: Math.sin((f / 6) * Math.PI * 2) * 0.08,
  })),
  // turn: von frontal zur neuen Blickrichtung
  Array.from({ length: 4 }, (_, f) => ({
    arms: armSet({ phase: f, amp: 1, sweep: 0.15 - f * 0.05 }),
    eyeShift: -1 + f,
    headSquash: 0.1 - f * 0.03,
  })),
  // catch: Arme greifen nach vorn
  Array.from({ length: 4 }, (_, f) => ({
    arms: armSet({ phase: f, amp: 0.8, reach: [0.2, 0.5, 0.7, 0.35][f] }),
    eyeShift: 3,
  })),
];
rows.forEach((frames, row) =>
  frames.forEach((opts, col) => {
    const mask = drawOctopusFrame(sheet, col * FRAME, row * FRAME, opts);
    // Normal Map: Kopf als Halbkugel, Arme leicht gewölbt; Leerraum flach.
    for (let y = 0; y < FRAME; y++)
      for (let x = 0; x < FRAME; x++) {
        const m = mask[y * FRAME + x];
        const a = sheet.alphaAt(col * FRAME + x, row * FRAME + y);
        let n = [0, 0, 1];
        if (m === 1) {
          const nx = (x + 0.5 - 15.5) / 9;
          const ny = (y + 0.5 - 11.5) / 8;
          const nz = Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny));
          const l = Math.hypot(nx, ny, nz);
          n = [nx / l, -ny / l, nz / l];
        }
        normal.set(col * FRAME + x, row * FRAME + y, n.map((v) => v * 0.5 + 0.5), a > 0 ? 1 : 0);
      }
  }),
);

console.log('Sprites:');
save(spritesDir, 'player_octopus.png', sheet);
save(spritesDir, 'player_octopus_n.png', normal);

// Blase für Schwimm-Effekt (8×8)
const bubble = new Image(8, 8);
for (let y = 0; y < 8; y++)
  for (let x = 0; x < 8; x++) {
    const d = Math.hypot(x + 0.5 - 4, y + 0.5 - 4);
    if (d <= 3.6 && d > 2.4) bubble.set(x, y, hex('#d8fbff'), 0.9);
    else if (d <= 2.4) bubble.set(x, y, hex('#9ff0ff'), 0.25);
  }
bubble.set(2, 2, white, 1);
save(spritesDir, 'fx_bubble.png', bubble);

// ---------------------------------------------------------------- Fische (Größe und Farbe aus data/fish.json)

/**
 * Fisch als Spritesheet: Reihen idle, swim, turn, catch mit je 4 Frames, schaut nach rechts.
 * Platzhalter: Körper-Ellipse, Schwanzflosse, Rückenflosse, großes Auge mit Glanzpunkt.
 */
function drawFishSheet(def) {
  const fw = def.frame.width;
  const fh = def.frame.height;
  const base = hex(def.placeholderColor);
  const fishRamp = {
    outline: mix(base, hex('#1b1030'), 0.65),
    shadow: mix(base, hex('#1b1030'), 0.3),
    base,
    light: mix(base, [1, 1, 1], 0.45),
  };
  const sheetImg = new Image(fw * 4, fh * 4);
  const frameOpts = [
    [0, 1, 2, 1].map((t) => ({ tail: t * 0.5, squash: 1 })),
    [0, 1, 2, 1].map((t) => ({ tail: t - 1, squash: 1 })),
    [0.35, 0.6, 0.85, 1].map((sq) => ({ tail: 0, squash: sq })),
    [0, 1, 0, -1].map((t) => ({ tail: t, squash: 1, wide: true })),
  ];
  frameOpts.forEach((row, r) =>
    row.forEach((o, c) => {
      const ox = c * fw;
      const oy = r * fh;
      const mask = new Int8Array(fw * fh);
      const bodyW = (fw - 2) * 0.72 * o.squash;
      const bodyH = (fh - 2) * 0.78;
      const cx = fw * 0.58;
      const cy = fh / 2;
      // Körper
      for (let y = 0; y < fh; y++)
        for (let x = 0; x < fw; x++) {
          const nx = (x + 0.5 - cx) / (bodyW / 2);
          const ny = (y + 0.5 - cy) / (bodyH / 2);
          if (nx * nx + ny * ny <= 1) mask[y * fw + x] = 1;
        }
      // Schwanzflosse (Dreieck links), wedelt über o.tail
      const tailX0 = Math.round(cx - bodyW / 2) + 1;
      const tailLen = Math.max(3, Math.round(fw * 0.22));
      for (let i = 0; i < tailLen; i++) {
        const x = tailX0 - i;
        const half = Math.round((i / tailLen) * fh * 0.36) + 1;
        const shift = Math.round(o.tail * (i / tailLen));
        for (let y = Math.round(cy) - half + shift; y <= Math.round(cy) + half - 1 + shift; y++)
          if (x >= 1 && y >= 1 && y < fh - 1) mask[y * fw + x] = 2;
      }
      // Rückenflosse
      for (let i = 0; i < Math.round(bodyW * 0.35); i++) {
        const x = Math.round(cx - bodyW * 0.15 + i);
        const y = Math.round(cy - bodyH / 2) - 1;
        if (y >= 1 && i % 3 !== 2) mask[y * fw + x] = 2;
      }
      for (let y = 0; y < fh; y++)
        for (let x = 0; x < fw; x++) {
          const m = mask[y * fw + x];
          if (!m) continue;
          let color = fishRamp.base;
          if (m === 2) color = fishRamp.shadow;
          else if (y < cy - bodyH * 0.2) color = fishRamp.light;
          else if (y > cy + bodyH * 0.22) color = fishRamp.shadow;
          sheetImg.set(ox + x, oy + y, color);
        }
      for (let y = 0; y < fh; y++)
        for (let x = 0; x < fw; x++) {
          if (mask[y * fw + x]) continue;
          const n =
            (x > 0 && mask[y * fw + x - 1]) || (x < fw - 1 && mask[y * fw + x + 1]) ||
            (y > 0 && mask[(y - 1) * fw + x]) || (y < fh - 1 && mask[(y + 1) * fw + x]);
          if (n) sheetImg.set(ox + x, oy + y, fishRamp.outline);
        }
      // Auge vorne, groß mit Glanzpunkt
      const ex = Math.round(cx + bodyW * 0.22);
      const ey = Math.round(cy - 1);
      const eyeR = o.wide ? 2 : fh >= 12 ? 2 : 1;
      for (let dy = -eyeR; dy < eyeR; dy++) for (let dx = -eyeR; dx < eyeR; dx++) sheetImg.set(ox + ex + dx, oy + ey + dy, white);
      sheetImg.set(ox + ex, oy + ey, pupil);
      if (eyeR > 1) sheetImg.set(ox + ex, oy + ey - 1, pupil);
      sheetImg.set(ox + ex - eyeR, oy + ey - eyeR, white);
    }),
  );
  return sheetImg;
}

const fishDefs = JSON.parse(readFileSync(join(root, 'data', 'fish.json'), 'utf8'));
for (const def of fishDefs) save(spritesDir, `${def.sprite}.png`, drawFishSheet(def));

// Fangblase (32×32): umschließt einen gefangenen Fisch.
const catchBubble = new Image(32, 32);
for (let y = 0; y < 32; y++)
  for (let x = 0; x < 32; x++) {
    const d = Math.hypot(x + 0.5 - 16, y + 0.5 - 16);
    if (d <= 15 && d > 13.6) catchBubble.set(x, y, hex('#e4fdff'), 0.95);
    else if (d <= 13.6) catchBubble.set(x, y, hex('#a8f2ff'), 0.16 + (d / 13.6) * 0.14);
  }
for (const [x, y] of [[9, 7], [10, 7], [8, 8], [8, 9], [9, 8], [7, 10]]) catchBubble.set(x, y, white, 1);
save(spritesDir, 'fx_catch_bubble.png', catchBubble);

// ---------------------------------------------------------------- Hintergründe Kelpwald (1920×1080)

const W = 1920;
const H = 1080;
const rng = createRng('placeholder-kelp');
console.log('Hintergründe:');

// Ebene 0: Wasserverlauf mit Sonnenstrahlen, deckend, fest zur Kamera.
{
  const img = new Image(W, H);
  const top = hex('#7fe8e0');
  const mid = hex('#2fb7c4');
  const bottom = hex('#167f9e');
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1);
    const c = t < 0.5 ? mix(top, mid, t / 0.5) : mix(mid, bottom, (t - 0.5) / 0.5);
    for (let x = 0; x < W; x++) img.set(x, y, c);
  }
  const rays = Array.from({ length: 9 }, () => ({
    x: rng.range(0, W),
    width: rng.range(40, 140),
    slant: rng.range(0.25, 0.45),
    alpha: rng.range(0.06, 0.14),
  }));
  const sun = hex('#fff6d0');
  for (const r of rays)
    for (let y = 0; y < H; y++) {
      const fade = Math.pow(1 - y / H, 1.6);
      const center = r.x + y * r.slant;
      const w = r.width * (1 + y / H);
      for (let x = Math.floor(center - w); x <= center + w; x++) {
        const edge = 1 - Math.abs(x - center) / w;
        if (edge > 0 && x >= 0 && x < W) img.blend(x, y, sun, r.alpha * fade * edge * edge);
      }
    }
  save(bgDir, 'bg_kelp_0.png', img);
}

/**
 * Kelp-Ebene, nahtlos in beide Richtungen kachelbar: Stängel laufen über die volle Höhe,
 * ihre Welle hat eine ganzzahlige Periode pro Bildhöhe.
 */
function kelpLayer(file, { count, width, color, lightColor, alpha, bladeEvery, bladeSize, sway }) {
  const img = new Image(W, H, true);
  const stalks = Array.from({ length: count }, () => ({
    x: rng.range(0, W),
    w: rng.range(width[0], width[1]),
    k: rng.int(1, 2),
    phase: rng.range(0, Math.PI * 2),
    amp: rng.range(sway * 0.5, sway),
  }));
  const centerAt = (s, y) => s.x + Math.sin((y / H) * Math.PI * 2 * s.k + s.phase) * s.amp;

  for (const s of stalks) {
    for (let y = 0; y < H; y++) {
      const cx = centerAt(s, y);
      for (let x = Math.floor(cx - s.w - 1); x <= Math.ceil(cx + s.w + 1); x++) {
        const d = Math.abs(x + 0.5 - cx);
        const cover = clamp01(s.w - d + 0.5);
        if (cover <= 0) continue;
        const side = clamp01(0.5 - (x + 0.5 - cx) / (2 * s.w)); // links heller (Licht)
        img.blend(x, y, mix(color, lightColor, side * 0.7), alpha * cover);
      }
    }
    // Blätter: schräge Ellipsen abwechselnd links/rechts, Abstand teilt die Bildhöhe glatt.
    const n = Math.max(1, Math.round(H / bladeEvery));
    for (let i = 0; i < n; i++) {
      const by = (i + rng.range(0, 0.6)) * (H / n);
      const dir = i % 2 === 0 ? 1 : -1;
      const len = rng.range(bladeSize[0], bladeSize[1]);
      const thick = len * 0.22;
      const angle = dir * rng.range(0.5, 0.9) - Math.PI / 2;
      const cx = centerAt(s, by) + Math.cos(angle) * len * 0.5 * dir * -1;
      const cy = by + Math.sin(angle) * len * 0.5;
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);
      const r = Math.ceil(len);
      for (let y = Math.floor(cy - r); y <= cy + r; y++)
        for (let x = Math.floor(cx - r); x <= cx + r; x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          const u = (dx * ca + dy * sa) / (len * 0.5);
          const v = (-dx * sa + dy * ca) / thick;
          const d = u * u + v * v;
          if (d > 1.15) continue;
          const cover = clamp01((1 - d) * thick * 0.5 + 0.5);
          img.blend(x, y, mix(color, lightColor, clamp01(0.4 - v * 0.4)), alpha * cover);
        }
    }
  }
  save(bgDir, file, img);
}

kelpLayer('bg_kelp_1.png', {
  count: 14, width: [5, 9], color: hex('#3a9e9a'), lightColor: hex('#6cc7b8'),
  alpha: 0.35, bladeEvery: 140, bladeSize: [40, 70], sway: 18,
});
kelpLayer('bg_kelp_2.png', {
  count: 8, width: [8, 13], color: hex('#2e7f68'), lightColor: hex('#5fae7c'),
  alpha: 0.6, bladeEvery: 160, bladeSize: [60, 100], sway: 26,
});
kelpLayer('bg_kelp_3.png', {
  count: 4, width: [12, 18], color: hex('#245f3f'), lightColor: hex('#4f9a55'),
  alpha: 0.8, bladeEvery: 180, bladeSize: [80, 130], sway: 34,
});

// ---------------------------------------------------------------- App-Icons (PWA)

const iconsDir = join(root, 'assets', 'icons');
mkdirSync(iconsDir, { recursive: true });
console.log('Icons:');
for (const size of [192, 512]) {
  const icon = new Image(size, size);
  const bgTop = hex('#3fd3d0');
  const bgBottom = hex('#0f4f7a');
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) icon.set(x, y, mix(bgTop, bgBottom, y / size));
  const scale = Math.floor((size * 0.8) / FRAME);
  const off = Math.floor((size - FRAME * scale) / 2);
  for (let y = 0; y < FRAME * scale; y++)
    for (let x = 0; x < FRAME * scale; x++) {
      const i = (Math.floor(y / scale) * sheet.width + Math.floor(x / scale)) * 4;
      const a = sheet.px[i + 3];
      if (a > 0) icon.blend(off + x, off + y, [sheet.px[i], sheet.px[i + 1], sheet.px[i + 2]], a);
    }
  save(iconsDir, `icon-${size}.png`, icon);
}
