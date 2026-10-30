// Erzeugt Platzhaltergrafiken in den finalen Größen und Dateinamen (siehe Asset-Regeln in INKOGNITO.md),
// im Stil von ARTSTIL.md: 4-stufige Farbrampe, farbige Kontur, große Augen mit Glanzpunkt.
// Echte Grafiken ersetzen diese Dateien später 1:1. Aufruf: npm run assets:placeholders
import { makeCharacters } from './characters.mjs';
import { makeFish } from './fish.mjs';
import { makeActing } from './acting.mjs';
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
// Fertige Grafik (per scripts/import-art.mjs eingespielt) wird nie überschrieben.
const finalArt = new Set(JSON.parse(readFileSync(join(root, 'scripts', 'final-art.json'), 'utf8')));
const save = (dir, name, img) => {
  const rel = join(dir, name).slice(join(root, 'assets').length + 1).replaceAll('\\', '/');
  if (finalArt.has(rel)) return console.log(`  ${rel}  (fertige Grafik, bleibt)`);
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


console.log('Figuren:');


// ---------------------------------------------------------------- Hafen-Figuren (32×32)

const chars = makeCharacters({ Image, hex, mix, rampOf, outlineRegion, white, createRng });
const npcDefs = JSON.parse(readFileSync(join(root, 'data', 'npcs.json'), 'utf8'));
for (const def of npcDefs) save(spritesDir, `${def.sprite}.png`, chars.sheet(def.id));
for (const id of chars.portraitIds) {
  save(spritesDir, `portrait_${id}.png`, chars.portrait(id));
  for (const face of chars.faces.slice(1)) save(spritesDir, `portrait_${id}_${face}.png`, chars.portrait(id, face));
}
save(bgDir, 'bg_harbor_0.png', chars.town());
const acting = makeActing({ Image, hex, mix, rampOf, outlineRegion, white });
for (const name of acting.names) save(spritesDir, `anim_bert_${name}.png`, acting.strip(name));

// ---------------------------------------------------------------- Arten aus data/fish.json

const fishDefs = JSON.parse(readFileSync(join(root, 'data', 'fish.json'), 'utf8'));
console.log('Arten:');
const fishArt = makeFish({ Image, hex, mix, rampOf, outlineRegion, white });
for (const def of fishDefs) save(spritesDir, `${def.sprite}.png`, fishArt.drawSpecies(def));

// ---------------------------------------------------------------- Boot, Haken, Effekte

/** Kleiner Fischkutter 64×32: Rumpf, Kajüte, Mast. Anker unten mittig. */

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
save(spritesDir, 'boat_1.png', chars.boat());
save(spritesDir, 'player_octopus.png', chars.bert());
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
