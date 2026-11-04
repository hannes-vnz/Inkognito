// Spielt echte Grafik (z. B. aus Gemini) als fertiges Asset ein: Hintergrund entfernen, zuschneiden,
// pixelgenau auf das Zielraster verkleinern, Frames ausrichten und zum Spritesheet zusammensetzen.
// Die Zieldatei landet in scripts/final-art.json und wird vom Platzhalter-Generator nie mehr überschrieben.
//
// Aufruf: npm run art:import -- <ziel> <quelle …> [Optionen]
//   ziel     Pfad unter assets/, z. B. sprites/anim_bert_talk.png
//   quelle   Bilder (PNG/JPG) oder Ordner mit Bildern (alphabetisch = Frame-Reihenfolge)
// Optionen:
//   --frames N     jede Quelle ist ein waagerechter Streifen mit N Frames
//   --grid CxR     jede Quelle ist ein Raster mit C Spalten und R Zeilen (zeilenweise gelesen)
//   --cell WxH     Feldgröße erzwingen (sonst aus den Spieldaten bzw. der vorhandenen Datei)
//   --anchor A     bottom (Standard: Figuren stehen auf dem Boden) oder center
//   --bg B         auto (Standard: einfarbigen Rand entfernen) oder none
//   --fps N        nur Acting-Streifen: Tempo in data/anims.json setzen
//   --once         nur Acting-Streifen: Animation läuft einmal und hält das letzte Bild
//   --trim N       oberste N px jeder Quelle löschen (Füße der Rasterzelle darüber in Gemini-Rastern)
//   --outline      an unseren Stil anpassen: 1 px dunkle Kontur (#1b1030) um die Figur, Platz dafür im Feld
//   --rows 4,4,4   Frames pro Zeile erzwingen (z. B. wenn das Sheet neue Zeilen bekommt)
//   --dry          nichts schreiben, nur anzeigen
//   --out DATEI    Vorschau: nur diese Datei schreiben, Spieldaten bleiben unberührt
// Fische: Ein einzelnes Bild genügt, die vier Zeilen (idle, swim, turn, catch) werden daraus abgeleitet.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const writeJson = (p, v) => writeFileSync(join(root, p), `${JSON.stringify(v, null, 2)}\n`);

// ---------------------------------------------------------------- Bilder

/** RGBA-Bild mit 8 Bit pro Kanal. */
const blank = (width, height) => ({ width, height, data: new Uint8Array(width * height * 4) });

function load(file) {
  const buf = readFileSync(file);
  const ext = extname(file).toLowerCase();
  if (ext === '.png') {
    const p = PNG.sync.read(buf);
    return { width: p.width, height: p.height, data: new Uint8Array(p.data) };
  }
  if (ext === '.jpg' || ext === '.jpeg') {
    const j = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });
    return { width: j.width, height: j.height, data: new Uint8Array(j.data) };
  }
  throw new Error(`${file}: nur PNG oder JPG (WebP bitte vorher umwandeln)`);
}

function savePng(file, img) {
  const p = new PNG({ width: img.width, height: img.height });
  p.data = Buffer.from(img.data);
  writeFileSync(file, PNG.sync.write(p));
}

function crop(img, x, y, w, h) {
  const out = blank(w, h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const sx = x + i;
      const sy = y + j;
      if (sx < 0 || sy < 0 || sx >= img.width || sy >= img.height) continue;
      const s = (sy * img.width + sx) * 4;
      out.data.set(img.data.subarray(s, s + 4), (j * w + i) * 4);
    }
  return out;
}

/** Zerlegt ein Bild in C×R gleich große Felder (zeilenweise). */
function split(img, cols, rows) {
  const w = Math.floor(img.width / cols);
  const h = Math.floor(img.height / rows);
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push(crop(img, c * w, r * h, w, h));
  return out;
}

/**
 * Entfernt den Hintergrund: Flutfüllung vom Bildrand aus über transparente Pixel, helle Grautöne
 * (eingebranntes Karo aus Bildgeneratoren) und Farben aus den vier Bildecken. Figuren mit dunkler Kontur
 * bleiben dabei ganz, auch wenn sie selbst hell sind.
 */
function removeBackground(img) {
  const { width: w, height: h, data } = img;
  const refs = [];
  for (const [cx, cy] of [[0, 0], [w - 4, 0], [0, h - 4], [w - 4, h - 4]])
    for (let y = cy; y < cy + 4; y++)
      for (let x = cx; x < cx + 4; x++) {
        const p = (y * w + x) * 4;
        if (data[p + 3] > 127) refs.push([data[p], data[p + 1], data[p + 2]]);
      }
  const lum = (q) => 0.3 * data[q * 4] + 0.59 * data[q * 4 + 1] + 0.11 * data[q * 4 + 2];
  const bgLike = (q) => {
    const p = q * 4;
    if (data[p + 3] <= 127) return true;
    const [r, g, b] = [data[p], data[p + 1], data[p + 2]];
    if (Math.min(r, g, b) >= 180 && Math.max(r, g, b) - Math.min(r, g, b) <= 28) return true;
    return refs.some((c) => Math.hypot(r - c[0], g - c[1], b - c[2]) < 30);
  };
  // Ein Pixel direkt an einer dunklen Kontur bleibt in der ersten Runde stehen: schließt Lücken im Umriss
  const nearOutline = (q) => {
    const x = q % w;
    const y = (q - x) / w;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (data[n * 4 + 3] > 127 && lum(n) < 140) return true;
      }
    return false;
  };
  const passable = (q) => data[q * 4 + 3] <= 127 || (bgLike(q) && !nearOutline(q));
  const seen = new Uint8Array(w * h);
  const stack = [];
  const seed = (q) => {
    if (!seen[q] && passable(q)) {
      seen[q] = 1;
      stack.push(q);
    }
  };
  for (let x = 0; x < w; x++) seed(x), seed((h - 1) * w + x);
  for (let y = 0; y < h; y++) seed(y * w), seed(y * w + w - 1);
  while (stack.length) {
    const q = stack.pop();
    const x = q % w;
    if (x > 0) seed(q - 1);
    if (x < w - 1) seed(q + 1);
    if (q >= w) seed(q - w);
    if (q < w * (h - 1)) seed(q + w);
  }
  // Zweite Runde: den stehengebliebenen hellen Saum direkt am Hintergrund entfernen
  const fringe = [];
  for (let q = 0; q < w * h; q++) {
    if (seen[q] || !bgLike(q)) continue;
    const x = q % w;
    if ((x > 0 && seen[q - 1]) || (x < w - 1 && seen[q + 1]) || (q >= w && seen[q - w]) || (q < w * (h - 1) && seen[q + w])) fringe.push(q);
  }
  for (const q of fringe) seen[q] = 1;
  for (let q = 0; q < w * h; q++) if (seen[q]) data[q * 4 + 3] = 0;
  return img;
}

/**
 * Entfernt Bildreste: kleine Inseln am Bildrand (angeschnittene Nachbarfelder aus Gemini-Rastern)
 * und alles Lose im unteren Fünftel (Beschriftungen unter den Feldern). Schweißtropfen usw. bleiben.
 */
function removeDebris(img) {
  const { width: w, height: h, data } = img;
  const label = new Int32Array(w * h).fill(-1);
  const parts = [];
  for (let start = 0; start < w * h; start++) {
    if (label[start] >= 0 || data[start * 4 + 3] <= 127) continue;
    const part = { pixels: [], top: h, border: false };
    const stack = [start];
    label[start] = parts.length;
    while (stack.length) {
      const p = stack.pop();
      part.pixels.push(p);
      const x = p % w;
      const y = (p - x) / w;
      part.top = Math.min(part.top, y);
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) part.border = true;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (label[q] < 0 && data[q * 4 + 3] > 127) {
            label[q] = parts.length;
            stack.push(q);
          }
        }
    }
    parts.push(part);
  }
  const largest = Math.max(0, ...parts.map((p) => p.pixels.length));
  for (const part of parts) {
    if (part.pixels.length === largest) continue;
    const small = part.pixels.length < largest * 0.08;
    if ((small && part.border) || part.top >= h * 0.8) for (const p of part.pixels) data[p * 4 + 3] = 0;
  }
  return img;
}

/** Rechteck um alle deckenden Pixel (null, wenn leer). */
function bounds(img) {
  let x0 = img.width;
  let y0 = img.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++)
      if (img.data[(y * img.width + x) * 4 + 3] > 127) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * Skaliert um Faktor `k`: beim Verkleinern Flächenmittel (vormultipliziertes Alpha), beim Vergrößern
 * nächster Nachbar. Danach hartes Alpha, damit es echte Pixel-Art bleibt.
 */
function scale(img, k) {
  const w = Math.max(1, Math.round(img.width * k));
  const h = Math.max(1, Math.round(img.height * k));
  const out = blank(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx0 = Math.floor(x / k);
      const sy0 = Math.floor(y / k);
      const sx1 = Math.max(sx0 + 1, Math.min(img.width, Math.floor((x + 1) / k)));
      const sy1 = Math.max(sy0 + 1, Math.min(img.height, Math.floor((y + 1) / k)));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let j = sy0; j < sy1; j++)
        for (let i = sx0; i < sx1; i++) {
          const s = (j * img.width + i) * 4;
          const al = img.data[s + 3] / 255;
          r += img.data[s] * al;
          g += img.data[s + 1] * al;
          b += img.data[s + 2] * al;
          a += al;
          n++;
        }
      if (a / n < 0.5) continue;
      const o = (y * w + x) * 4;
      out.data[o] = Math.round(r / a);
      out.data[o + 1] = Math.round(g / a);
      out.data[o + 2] = Math.round(b / a);
      out.data[o + 3] = 255;
    }
  return out;
}

/** Farbige Kontur wie bei den Spielfiguren: jeder freie Pixel neben der Figur wird dunkel. */
function outline(img) {
  const { width: w, height: h, data } = img;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] > 0;
  const pts = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) pts.push((y * w + x) * 4);
  for (const p of pts) data.set([27, 16, 48, 255], p);
  return img;
}

/** Kopiert `src` nach `dst` an (dx, dy), nur deckende Pixel. */
function paste(dst, src, dx, dy) {
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < src.width; x++) {
      const s = (y * src.width + x) * 4;
      const tx = dx + x;
      const ty = dy + y;
      if (src.data[s + 3] === 0 || tx < 0 || ty < 0 || tx >= dst.width || ty >= dst.height) continue;
      dst.data.set(src.data.subarray(s, s + 4), (ty * dst.width + tx) * 4);
    }
}

/** Pixel per Rückwärtsabbildung umsetzen (für Spiegeln, Drehen, Schwanzschlag). */
function warp(img, map) {
  const out = blank(img.width, img.height);
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++) {
      const [sx, sy] = map(x + 0.5, y + 0.5).map(Math.floor);
      if (sx < 0 || sy < 0 || sx >= img.width || sy >= img.height) continue;
      const s = (sy * img.width + sx) * 4;
      out.data.set(img.data.subarray(s, s + 4), (y * img.width + x) * 4);
    }
  return out;
}

/** Vier Zeilen Fisch-Animation aus einem Bild (Blick nach rechts): idle, swim, turn, catch. */
function deriveFish(cell) {
  const { width: w, height: h } = cell;
  const cx = w / 2;
  const cy = h / 2;
  const frames = [];
  for (const dy of [0, -1, 0, 1]) frames.push(warp(cell, (x, y) => [x, y - dy]));
  const tail = w * 0.45;
  for (const p of [0, 1, 0, -1]) frames.push(warp(cell, (x, y) => [x, y - (x < tail ? p * Math.round(((tail - x) / tail) * 2) : 0)]));
  for (const s of [1, 0.5, -0.5, -1]) frames.push(warp(cell, (x, y) => [cx + (x - cx) / s, y]));
  for (const deg of [-14, 0, 14, 0]) {
    const a = (deg * Math.PI) / 180;
    frames.push(warp(cell, (x, y) => [cx + (x - cx) * Math.cos(a) + (y - cy) * Math.sin(a), cy - (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)]));
  }
  return frames;
}

// ---------------------------------------------------------------- Ziel-Layout aus den Spieldaten

/** Feldgröße und Frames pro Zeile für eine Zieldatei. */
function layoutOf(target, opts) {
  const name = target.split('/').pop().replace(/\.png$/, '');
  const existing = existsSync(join(root, 'assets', target)) ? PNG.sync.read(readFileSync(join(root, 'assets', target))) : null;
  if (name.startsWith('anim_')) return { kind: 'acting', key: name.slice(5), cell: [existing?.height ?? 96, existing?.height ?? 96], rows: null };
  if (name.startsWith('portrait_')) return { kind: 'single', cell: [96, 96], rows: [1] };
  const player = readJson('data/player.json');
  if (name === player.sprite) return { kind: 'sheet', cell: [player.frameWidth, player.frameHeight], rows: player.animations.map((a) => a.frames) };
  const npc = readJson('data/npcs.json').find((n) => n.sprite === name);
  if (npc) return { kind: 'sheet', cell: [npc.frame.width, npc.frame.height], rows: npc.animations.map((a) => a.frames) };
  const fish = readJson('data/fish.json').find((f) => f.sprite === name);
  if (fish) return { kind: 'fish', cell: [fish.frame.width, fish.frame.height], rows: [4, 4, 4, 4] };
  const sheet = readJson('data/sheets.json')[name];
  if (sheet && existing) {
    const cols = existing.width / sheet.frame[0];
    return { kind: 'sheet', cell: sheet.frame, rows: Array(existing.height / sheet.frame[1]).fill(cols) };
  }
  if (opts.cell) return { kind: 'single', cell: opts.cell, rows: [1] };
  if (existing) return { kind: 'single', cell: [existing.width, existing.height], rows: [1] };
  throw new Error(`${target}: unbekanntes Ziel, bitte --cell WxH angeben`);
}

// ---------------------------------------------------------------- Ablauf

function parseArgs(argv) {
  const opts = { anchor: null, bg: 'auto', sources: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--frames') opts.frames = Number(next());
    else if (a === '--grid') opts.grid = next().split('x').map(Number);
    else if (a === '--cell') opts.cell = next().split('x').map(Number);
    else if (a === '--anchor') opts.anchor = next();
    else if (a === '--bg') opts.bg = next();
    else if (a === '--fps') opts.fps = Number(next());
    else if (a === '--once') opts.once = true;
    else if (a === '--dry') opts.dry = true;
    else if (a === '--out') opts.out = next();
    else if (a === '--rows') opts.rows = next().split(',').map(Number);
    else if (a === '--outline') opts.outline = true;
    else if (a === '--trim') opts.trim = Number(next());
    else if (!opts.target) opts.target = a.replace(/^assets\//, '');
    else opts.sources.push(a);
  }
  if (!opts.target || opts.sources.length === 0) throw new Error('Aufruf: npm run art:import -- <ziel> <quelle …> [Optionen]');
  return opts;
}

function sourceFiles(paths) {
  const files = [];
  for (const p of paths) {
    if (statSync(p).isDirectory())
      files.push(
        ...readdirSync(p)
          .filter((f) => /\.(png|jpe?g)$/i.test(f))
          .sort((a, b) => a.localeCompare(b, 'de', { numeric: true }))
          .map((f) => join(p, f)),
      );
    else files.push(p);
  }
  return files;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const layout = layoutOf(opts.target, opts);
  const [cw, ch] = opts.cell ?? layout.cell;
  const anchor = opts.anchor ?? (layout.kind === 'fish' ? 'center' : 'bottom');

  // Quellen laden, zerlegen, freistellen
  let frames = [];
  for (const file of sourceFiles(opts.sources)) {
    const img = load(file);
    const parts = opts.grid ? split(img, opts.grid[0], opts.grid[1]) : opts.frames ? split(img, opts.frames, 1) : [img];
    const trimmed = opts.trim ? parts.map((f) => crop(f, 0, opts.trim, f.width, f.height - opts.trim)) : parts;
    frames.push(...trimmed.map((f) => removeDebris(opts.bg === 'none' ? f : removeBackground(f))));
  }
  const boxes = frames.map(bounds);
  frames = frames.filter((_, i) => boxes[i]);
  const solid = boxes.filter(Boolean);
  if (solid.length === 0) throw new Error('Keine Figur gefunden (alles transparent?)');

  // Ein gemeinsamer Maßstab für alle Frames, damit die Figur nicht pulsiert
  const margin = layout.kind === 'fish' || opts.outline ? 1 : 0;
  // Nie vergrößern: Pixel-Art in Zielgröße bleibt 1:1 scharf
  const k = Math.min(1, (cw - margin * 2) / Math.max(...solid.map((b) => b.w)), (ch - margin * 2) / Math.max(...solid.map((b) => b.h)));
  const cells = solid.map((b, i) => {
    const part = scale(crop(frames[i], b.x, b.y, b.w, b.h), k);
    const cell = blank(cw, ch);
    const dx = Math.round((cw - part.width) / 2);
    const dy = anchor === 'center' ? Math.round((ch - part.height) / 2) : ch - margin - part.height;
    paste(cell, part, dx, dy);
    return opts.outline ? outline(removeDebris(cell)) : cell;
  });

  let rows = opts.rows ?? layout.rows;
  let list = cells;
  if (layout.kind === 'fish' && cells.length === 1) list = deriveFish(cells[0]);
  if (layout.kind === 'acting') rows = [list.length];
  const need = rows.reduce((a, b) => a + b, 0);
  if (list.length !== need) throw new Error(`${opts.target}: ${need} Frames erwartet (Zeilen ${rows.join(', ')}), ${list.length} bekommen`);

  const sheet = blank(Math.max(...rows) * cw, rows.length * ch);
  let n = 0;
  rows.forEach((count, r) => {
    for (let c = 0; c < count; c++) paste(sheet, list[n++], c * cw, r * ch);
  });

  console.log(`${opts.target}: ${list.length} Frames à ${cw}×${ch} → ${sheet.width}×${sheet.height} (Maßstab ${k.toFixed(3)})`);
  if (opts.dry) return;
  if (opts.out) return savePng(opts.out, sheet);
  savePng(join(root, 'assets', opts.target), sheet);

  // Acting-Streifen: Frame-Anzahl (und auf Wunsch Tempo) in data/anims.json nachziehen
  if (layout.kind === 'acting') {
    const anims = readJson('data/anims.json');
    const prev = anims[layout.key] ?? { file: opts.target, fps: 10, loop: true };
    anims[layout.key] = { ...prev, file: opts.target, frames: list.length, fps: opts.fps ?? prev.fps, loop: opts.once ? false : prev.loop };
    writeJson('data/anims.json', anims);
  }
  const finalArt = readJson('scripts/final-art.json');
  if (!finalArt.includes(opts.target)) writeJson('scripts/final-art.json', [...finalArt, opts.target].sort());
}

try {
  main();
} catch (e) {
  console.error(`Fehler: ${e.message}`);
  process.exit(1);
}
