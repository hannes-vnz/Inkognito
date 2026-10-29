/**
 * Hafen-Figuren als Platzhalter-Pixelkunst: Spritesheets 32×32 (idle, talk, react je 4 Frames),
 * Dialog-Porträts 64×64 und die Hafenstadt im Hintergrund.
 * Bekommt die Werkzeuge des Generators übergeben, damit es nur eine PNG-Pipeline gibt.
 */
export function makeCharacters({ Image, hex, mix, rampOf, outlineRegion, white, createRng }) {
  const ink = hex('#1b1030');
  const DARK = hex('#0e1a2b');

  /** Vier Töne mit Licht von oben links, dazu ein Glanzpunkt. */
  const tone = (ramp, nx, ny) => {
    const l = -(nx * 0.55 + ny * 0.85);
    if (l > 0.82) return mix(ramp.light, white, 0.35);
    if (l > 0.42) return ramp.light;
    if (l > -0.3) return ramp.base;
    return ramp.shadow;
  };

  function blob(img, ox, oy, cx, cy, rx, ry, ramp, alpha = 1, clip) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny > 1) continue;
        if (clip && !clip(x, y)) continue;
        if (alpha < 1) img.blend(ox + x, oy + y, tone(ramp, nx, ny), alpha);
        else img.set(ox + x, oy + y, tone(ramp, nx, ny));
      }
  }

  function poly(img, ox, oy, pts, color) {
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.max(...ys); y++)
      for (let x = Math.floor(Math.min(...xs)); x <= Math.max(...xs); x++) {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i];
          const [xj, yj] = pts[j];
          if (yi > y + 0.5 !== yj > y + 0.5 && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) img.set(ox + x, oy + y, typeof color === 'function' ? color(x, y) : color);
      }
  }

  function line(img, ox, oy, x0, y0, x1, y1, color) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) img.set(ox + x0 + ((x1 - x0) * i) / n, oy + y0 + ((y1 - y0) * i) / n, color);
  }

  function rect(img, ox, oy, x, y, w, h, color) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) img.set(ox + x + i, oy + y + j, typeof color === 'function' ? color(i, j) : color);
  }

  /** Auge mit Iris, Pupille und Glanz; `open` 0 = zu (Strich), 1 = offen. */
  function eye(img, ox, oy, x, y, r, iris, open = 1, look = -1) {
    if (open <= 0) {
      line(img, ox, oy, x - r, y, x + r, y, ink);
      return;
    }
    const h = Math.max(1, Math.round(r * open));
    for (let j = -h; j <= h; j++) for (let i = -r; i <= r; i++) if ((i * i) / (r * r) + (j * j) / (h * h) <= 1.05) img.set(ox + x + i, oy + y + j, white);
    const ix = x + look * Math.max(0, r - 2);
    for (let j = -h; j <= h; j++) for (let i = -1; i <= 1; i++) if (Math.abs(j) <= h) img.set(ox + ix + i, oy + y + j, iris);
    img.set(ox + ix, oy + y, ink);
    img.set(ox + ix, oy + y + (h > 1 ? 1 : 0), ink);
    img.set(ox + ix - 1, oy + y - Math.min(1, h), white);
    if (open < 1) line(img, ox, oy, x - r, y - h, x + r, y - h, ink);
  }

  const blush = (img, ox, oy, x, y) => {
    for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [1, 1]]) img.blend(ox + x + dx, oy + y + dy, hex('#ff6b8a'), 0.45);
  };

  // ------------------------------------------------------------ Paletten
  const P = {
    skin: rampOf(hex('#f2c09a')),
    skinRed: rampOf(hex('#eaa07e')),
    navy: rampOf(hex('#2f5288')),
    capWhite: rampOf(hex('#f4f1e8')),
    grey: rampOf(hex('#c3c3d0')),
    gold: rampOf(hex('#ffd23f')),
    shark: rampOf(hex('#7f97ad')),
    belly: rampOf(hex('#eef2f6')),
    coat: rampOf(hex('#c9a26a')),
    hat: rampOf(hex('#5a4234')),
    jelly: rampOf(hex('#c78cff')),
    jellyLight: rampOf(hex('#ead6ff')),
    beard: rampOf(hex('#f2f2f6')),
    rain: rampOf(hex('#ffcf3a')),
    beanie: rampOf(hex('#2f6f7a')),
    pipe: rampOf(hex('#7a4a2a')),
    gullWhite: rampOf(hex('#f6f8fb')),
    gullGrey: rampOf(hex('#9aa8b8')),
    beak: rampOf(hex('#ffcf3a')),
    pink: rampOf(hex('#ec5a84')),
    fakeBeard: rampOf(hex('#8a5a2b')),
    sou: rampOf(hex('#ffd23f')),
    barrel: rampOf(hex('#9a6a3a')),
    red: rampOf(hex('#d9503f')),
  };

  // ------------------------------------------------------------ Porträts 64×64

  const portraits = {
    hilde(img) {
      blob(img, 0, 0, 32, 68, 31, 20, P.navy);
      poly(img, 0, 0, [[26, 48], [32, 58], [38, 48]], P.capWhite.base);
      poly(img, 0, 0, [[20, 50], [26, 48], [31, 63], [22, 63]], P.navy.light);
      poly(img, 0, 0, [[44, 50], [38, 48], [33, 63], [42, 63]], P.navy.shadow);
      for (const [x, y] of [[25, 56], [39, 56], [26, 61], [38, 61]]) rect(img, 0, 0, x, y, 2, 2, P.gold.base);
      rect(img, 0, 0, 28, 43, 8, 6, P.skin.shadow);
      blob(img, 0, 0, 32, 26, 17, 15, P.grey);
      blob(img, 0, 0, 46, 22, 6, 6, P.grey);
      blob(img, 0, 0, 19, 33, 3, 4, P.skin);
      blob(img, 0, 0, 45, 33, 3, 4, P.skin);
      blob(img, 0, 0, 32, 32, 13, 14, P.skin);
      blob(img, 0, 0, 32, 13, 16, 6, P.capWhite);
      rect(img, 0, 0, 17, 16, 30, 4, P.navy.base);
      rect(img, 0, 0, 17, 16, 30, 1, P.navy.light);
      blob(img, 0, 0, 30, 21, 15, 2.6, rampOf(hex('#1b2a4a')));
      rect(img, 0, 0, 31, 15, 3, 3, P.gold.base);
      img.set(32, 14, P.gold.light);
      // Misstrauischer Blick: links zusammengekniffen, rechte Braue hoch
      eye(img, 0, 0, 27, 32, 3, hex('#5a7a4a'), 0.45);
      eye(img, 0, 0, 38, 31, 3, hex('#5a7a4a'), 0.9);
      line(img, 0, 0, 23, 28, 30, 29, P.grey.outline);
      line(img, 0, 0, 35, 26, 41, 25, P.grey.outline);
      img.set(42, 26, P.grey.outline);
      line(img, 0, 0, 33, 33, 34, 37, P.skin.shadow);
      img.set(32, 38, P.skin.outline);
      line(img, 0, 0, 29, 41, 36, 41, hex('#a8505a'));
      img.set(36, 40, hex('#a8505a'));
      blush(img, 0, 0, 23, 37);
      blush(img, 0, 0, 39, 37);
      for (const [x, y] of [[21, 31], [21, 33], [43, 30]]) img.set(x, y, P.skin.shadow);
    },
    bruno(img) {
      // Rückenflosse durch den Mantel
      poly(img, 0, 0, [[46, 50], [58, 30], [60, 52]], P.shark.base);
      line(img, 0, 0, 58, 30, 60, 52, P.shark.light);
      blob(img, 0, 0, 32, 68, 32, 20, P.coat);
      poly(img, 0, 0, [[12, 52], [22, 38], [28, 58], [18, 63]], P.coat.light);
      poly(img, 0, 0, [[52, 52], [42, 38], [36, 58], [46, 63]], P.coat.shadow);
      line(img, 0, 0, 32, 54, 32, 63, P.coat.outline);
      blob(img, 0, 0, 33, 31, 20, 16, P.shark);
      blob(img, 0, 0, 16, 34, 11, 9, P.shark);
      blob(img, 0, 0, 25, 41, 17, 6, P.belly);
      // Grinsen mit Zähnen
      line(img, 0, 0, 10, 39, 40, 42, ink);
      for (let x = 12; x < 39; x += 3) poly(img, 0, 0, [[x, 40], [x + 2, 40], [x + 1, 43]], white);
      for (let i = 0; i < 3; i++) line(img, 0, 0, 44 + i * 2, 33, 45 + i * 2, 39, P.shark.shadow);
      eye(img, 0, 0, 22, 29, 3, ink, 1, -1);
      line(img, 0, 0, 18, 25, 26, 26, P.shark.outline);
      // Hut
      blob(img, 0, 0, 33, 18, 22, 3.6, P.hat);
      blob(img, 0, 0, 34, 12, 14, 6.5, P.hat);
      rect(img, 0, 0, 21, 14, 26, 3, P.red.base);
      rect(img, 0, 0, 21, 14, 26, 1, P.red.light);
    },
    qualle(img) {
      // Tentakel
      for (let k = 0; k < 7; k++) {
        const x0 = 15 + k * 5.5;
        for (let y = 40; y < 64; y++) {
          const x = x0 + Math.sin(y * 0.35 + k) * 2;
          img.blend(x, y, k % 2 ? P.jelly.base : P.jellyLight.base, 0.85);
          if (k % 2 === 0) img.blend(x + 1, y, P.jelly.shadow, 0.6);
        }
      }
      blob(img, 0, 0, 32, 27, 23, 17, P.jelly, 0.95);
      blob(img, 0, 0, 30, 22, 14, 9, P.jellyLight, 0.5);
      for (let x = 10; x < 55; x += 5) blob(img, 0, 0, x + 2, 42, 3, 2, P.jelly);
      for (const [x, y] of [[22, 20], [42, 20]]) for (let a = 0; a < 20; a++) img.blend(x + Math.cos(a / 3) * 3, y + Math.sin(a / 3) * 3, hex('#ff8ab8'), 0.35);
      // Brille mit großen Augen
      for (const cx of [24, 40]) {
        for (let a = 0; a < 40; a++) img.set(cx + Math.round(Math.cos((a / 40) * Math.PI * 2) * 6), 29 + Math.round(Math.sin((a / 40) * Math.PI * 2) * 6), DARK);
        eye(img, 0, 0, cx, 29, 3, hex('#6a3aa8'), 1, -1);
      }
      line(img, 0, 0, 30, 28, 34, 28, DARK);
      // Lächeln und Fliege
      line(img, 0, 0, 29, 37, 35, 37, ink);
      img.set(28, 36, ink);
      img.set(36, 36, ink);
      poly(img, 0, 0, [[26, 44], [32, 47], [26, 50]], P.red.base);
      poly(img, 0, 0, [[38, 44], [32, 47], [38, 50]], P.red.shadow);
      rect(img, 0, 0, 31, 46, 2, 2, P.red.light);
      // Doktorhut
      poly(img, 0, 0, [[14, 9], [32, 3], [50, 9], [32, 15]], DARK);
      rect(img, 0, 0, 24, 10, 16, 5, hex('#1b2a4a'));
      line(img, 0, 0, 32, 9, 48, 12, P.gold.base);
      line(img, 0, 0, 48, 12, 48, 19, P.gold.base);
      rect(img, 0, 0, 47, 19, 3, 3, P.gold.light);
      blush(img, 0, 0, 17, 34);
      blush(img, 0, 0, 44, 34);
    },
    knut(img) {
      blob(img, 0, 0, 32, 68, 31, 20, P.rain);
      poly(img, 0, 0, [[14, 52], [24, 42], [28, 63], [16, 63]], P.rain.light);
      poly(img, 0, 0, [[50, 52], [40, 42], [36, 63], [48, 63]], P.rain.shadow);
      blob(img, 0, 0, 32, 31, 13, 14, P.skinRed);
      blob(img, 0, 0, 19, 31, 3, 4, P.skinRed);
      blob(img, 0, 0, 45, 31, 3, 4, P.skinRed);
      img.set(46, 35, P.gold.base);
      // Echter Bart, voll und lockig
      blob(img, 0, 0, 32, 45, 18, 13, P.beard);
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2;
        blob(img, 0, 0, 32 + Math.cos(a) * 14, 46 + Math.sin(a) * 10, 3, 3, P.beard);
      }
      blob(img, 0, 0, 26, 39, 6, 3, P.beard);
      blob(img, 0, 0, 38, 39, 6, 3, P.beard);
      blob(img, 0, 0, 31, 35, 3.5, 3, rampOf(hex('#e0605a')));
      // Augen mit buschigen Brauen, eins zugekniffen
      eye(img, 0, 0, 26, 30, 2, hex('#3a6aa8'), 0);
      eye(img, 0, 0, 37, 30, 3, hex('#3a6aa8'), 0.8);
      blob(img, 0, 0, 26, 26, 4, 1.6, P.beard);
      blob(img, 0, 0, 37, 25, 4, 1.6, P.beard);
      // Mütze
      blob(img, 0, 0, 32, 16, 15, 10, P.beanie);
      rect(img, 0, 0, 17, 18, 30, 6, (i) => (i % 3 === 0 ? P.beanie.shadow : P.beanie.light));
      blob(img, 0, 0, 32, 6, 3, 3, P.red);
      // Pfeife mit Rauch
      line(img, 0, 0, 38, 41, 49, 44, P.pipe.base);
      line(img, 0, 0, 38, 42, 49, 45, P.pipe.shadow);
      rect(img, 0, 0, 48, 38, 5, 7, P.pipe.base);
      rect(img, 0, 0, 48, 38, 5, 1, P.pipe.light);
      for (const [x, y, r] of [[52, 32, 2.5], [55, 26, 3], [53, 19, 3.5]]) blob(img, 0, 0, x, y, r, r, P.grey, 0.7);
    },
    gisela(img) {
      blob(img, 0, 0, 34, 56, 19, 14, P.gullWhite);
      blob(img, 0, 0, 46, 52, 14, 11, P.gullGrey);
      for (let i = 0; i < 4; i++) rect(img, 0, 0, 52 + i * 2, 58 - i, 2, 5, ink);
      blob(img, 0, 0, 30, 28, 14, 13, P.gullWhite);
      // Halstuch
      poly(img, 0, 0, [[18, 39], [42, 39], [30, 48]], hex('#3a6ac8'));
      for (const [x, y] of [[24, 41], [30, 44], [35, 41]]) img.set(x, y, white);
      // Schnabel mit rotem Fleck
      poly(img, 0, 0, [[19, 27], [5, 30], [5, 33], [19, 34]], P.beak.base);
      line(img, 0, 0, 5, 30, 19, 27, P.beak.light);
      line(img, 0, 0, 6, 31, 18, 31, P.beak.outline);
      rect(img, 0, 0, 8, 32, 3, 2, hex('#e0403a'));
      img.set(4, 31, P.beak.shadow);
      img.set(4, 32, P.beak.shadow);
      // Strenges Auge
      for (let a = 0; a < 16; a++) img.set(26 + Math.round(Math.cos((a / 16) * Math.PI * 2) * 3), 25 + Math.round(Math.sin((a / 16) * Math.PI * 2) * 3), hex('#e0403a'));
      eye(img, 0, 0, 26, 25, 2, hex('#f2e05a'), 1, -1);
      line(img, 0, 0, 21, 19, 30, 22, P.gullGrey.outline);
    },
    bert(img) {
      for (let k = 0; k < 5; k++) {
        const x0 = 14 + k * 9;
        for (let y = 50; y < 64; y++) {
          const x = x0 + Math.sin(y * 0.4 + k) * 2;
          rect(img, 0, 0, x, y, 4, 1, k % 2 ? P.pink.base : P.pink.shadow);
        }
      }
      blob(img, 0, 0, 32, 32, 19, 18, P.pink);
      for (const [x, y] of [[20, 26], [44, 30], [24, 38]]) blob(img, 0, 0, x, y, 1.6, 1.6, rampOf(hex('#c8406a')));
      // Fake-Bart mit sichtbarem Gummiband
      line(img, 0, 0, 14, 34, 22, 40, hex('#e8e0d0'));
      line(img, 0, 0, 50, 34, 42, 40, hex('#e8e0d0'));
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        blob(img, 0, 0, 32 + Math.cos(a) * 14, 47 + Math.sin(a) * 8, 3.2, 3.2, P.fakeBeard);
      }
      blob(img, 0, 0, 32, 46, 16, 10, P.fakeBeard);
      for (const [x, y] of [[24, 44], [30, 49], [37, 45], [42, 50], [27, 53], [35, 54]]) {
        img.set(x, y, P.fakeBeard.shadow);
        img.set(x + 1, y - 1, P.fakeBeard.light);
      }
      eye(img, 0, 0, 25, 31, 5, ink, 1, -1);
      eye(img, 0, 0, 40, 31, 5, ink, 1, -1);
      // Südwester
      blob(img, 0, 0, 32, 16, 25, 5, P.sou);
      blob(img, 0, 0, 32, 10, 15, 8, P.sou);
      line(img, 0, 0, 18, 15, 46, 15, P.sou.shadow);
    },
  };

  function portrait(id) {
    const img = new Image(64, 64);
    portraits[id](img);
    outlineRegion(img, 0, 0, 64, 64, DARK);
    return img;
  }

  // ------------------------------------------------------------ Spritesheets 32×32: idle, talk, react

  /** f: Frame 0–3, row: 0 idle, 1 talk, 2 react. */
  const sprites = {
    hilde(img, ox, oy, f, row) {
      const b = row === 2 ? (f % 2 ? -1 : 0) : f === 1 || f === 2 ? 1 : 0;
      blob(img, ox, oy, 16, 29, 10, 6, P.navy);
      poly(img, ox, oy, [[14, 23], [16, 27], [18, 23]], P.capWhite.base);
      for (const y of [26, 29]) for (const x of [13, 19]) img.set(ox + x, oy + y, P.gold.base);
      // Fernglas um den Hals
      rect(img, ox, oy, 13, 24 + b, 6, 2, ink);
      blob(img, ox, oy, 16, 13 + b, 9, 8, P.grey);
      blob(img, ox, oy, 16, 15 + b, 7, 7, P.skin);
      blob(img, ox, oy, 16, 6 + b, 8, 3.2, P.capWhite);
      rect(img, ox, oy, 8, 8 + b, 17, 2, P.navy.base);
      rect(img, ox, oy, 9, 10 + b, 13, 1, hex('#1b2a4a'));
      img.set(ox + 16, oy + 8 + b, P.gold.base);
      const squint = row === 2 ? 0.3 : f === 3 && row === 0 ? 0 : 0.6;
      eye(img, ox, oy, 13, 15 + b, 1, hex('#5a7a4a'), squint);
      eye(img, ox, oy, 19, 15 + b, 1, hex('#5a7a4a'), row === 2 ? 1 : squint + 0.3);
      line(img, ox, oy, 17, 12 + b, 21, 11 + b - (row === 2 ? 1 : 0), P.grey.outline);
      const open = row === 1 && f % 2 === 1;
      line(img, ox, oy, 14, 19 + b, 18, 19 + b, hex('#a8505a'));
      if (open) rect(img, ox, oy, 15, 20 + b, 3, 1, hex('#5a2030'));
      blush(img, ox, oy, 10, 17 + b);
    },
    bruno(img, ox, oy, f, row) {
      const b = f === 1 || f === 2 ? 1 : 0;
      poly(img, ox, oy, [[24, 22 + b], [30, 12 + b], [31, 24 + b]], P.shark.base);
      blob(img, ox, oy, 16, 29, 12, 6, P.coat);
      poly(img, ox, oy, [[8, 26], [12, 20], [14, 30]], P.coat.light);
      poly(img, ox, oy, [[24, 26], [20, 20], [18, 30]], P.coat.shadow);
      blob(img, ox, oy, 16, 15 + b, 10, 7, P.shark);
      blob(img, ox, oy, 8, 16 + b, 5, 4, P.shark);
      blob(img, ox, oy, 13, 19 + b, 8, 3, P.belly);
      line(img, ox, oy, 5, 18 + b, 20, 19 + b, ink);
      const open = (row === 1 && f % 2 === 1) || row === 2;
      for (let x = 6; x < 20; x += 2) img.set(ox + x, oy + 19 + b, white);
      if (open) rect(img, ox, oy, 7, 20 + b, 12, 1, hex('#5a2030'));
      eye(img, ox, oy, 11, 13 + b, 1, ink, row === 2 ? 1 : f === 3 ? 0 : 1);
      // Hut: bei react tippt er an die Krempe
      const tip = row === 2 ? [0, -1, -2, -1][f] : 0;
      blob(img, ox, oy, 16, 8 + b + tip, 11, 2, P.hat);
      blob(img, ox, oy, 17, 5 + b + tip, 7, 3.5, P.hat);
      rect(img, ox, oy, 11, 6 + b + tip, 12, 1, P.red.base);
    },
    qualle(img, ox, oy, f, row) {
      const b = row === 2 ? [0, -2, -3, -1][f] : f % 2;
      for (let k = 0; k < 5; k++) for (let y = 18; y < 31; y++) img.blend(ox + 9 + k * 3.5 + Math.sin(y * 0.6 + f + k) * 1.2, oy + y + b, k % 2 ? P.jelly.base : P.jellyLight.base, 0.9);
      blob(img, ox, oy, 16, 12 + b, 11, 9, P.jelly, 0.95);
      blob(img, ox, oy, 15, 9 + b, 6, 4, P.jellyLight, 0.5);
      for (const cx of [12, 20]) {
        for (let a = 0; a < 16; a++) img.set(ox + cx + Math.round(Math.cos((a / 16) * Math.PI * 2) * 3), oy + 12 + b + Math.round(Math.sin((a / 16) * Math.PI * 2) * 3), DARK);
        eye(img, ox, oy, cx, 12 + b, 1, hex('#6a3aa8'), f === 3 && row === 0 ? 0 : 1);
      }
      img.set(ox + 16, oy + 11 + b, DARK);
      const open = row === 1 && f % 2 === 1;
      line(img, ox, oy, 14, 17 + b, 18, 17 + b, ink);
      if (open) rect(img, ox, oy, 15, 18 + b, 3, 1, hex('#7a2a5a'));
      poly(img, ox, oy, [[7, 3 + b], [16, 0 + b], [25, 3 + b], [16, 6 + b]], DARK);
      line(img, ox, oy, 16, 3 + b, 24, 5 + b, P.gold.base);
      img.set(ox + 24, oy + 7 + b, P.gold.base);
      if (row === 2) for (const [x, y] of [[3, 6], [28, 4], [27, 14]]) img.set(ox + x, oy + y + (f % 2), white);
    },
    knut(img, ox, oy, f, row) {
      const b = f === 1 || f === 2 ? 1 : 0;
      // Fass
      blob(img, ox, oy, 16, 27, 9, 5, P.barrel);
      for (const y of [25, 29]) rect(img, ox, oy, 8, y, 17, 1, P.barrel.outline);
      blob(img, ox, oy, 16, 19 + b, 9, 5, P.rain);
      blob(img, ox, oy, 15, 12 + b, 6, 6, P.skinRed);
      blob(img, ox, oy, 15, 17 + b, 7, 5, P.beard);
      for (let i = 0; i < 8; i++) blob(img, ox, oy, 15 + Math.cos(i) * 6, 18 + b + Math.sin(i) * 3, 1.6, 1.6, P.beard);
      img.set(ox + 14, oy + 14 + b, hex('#e0605a'));
      img.set(ox + 15, oy + 14 + b, hex('#e0605a'));
      const blink = row === 0 && f === 3;
      eye(img, ox, oy, 12, 11 + b, 1, hex('#3a6aa8'), blink ? 0 : 0.7);
      eye(img, ox, oy, 18, 11 + b, 1, hex('#3a6aa8'), 0);
      blob(img, ox, oy, 15, 6 + b, 7, 4, P.beanie);
      rect(img, ox, oy, 8, 7 + b, 15, 2, P.beanie.light);
      img.set(ox + 15, oy + 1 + b, P.red.base);
      // Pfeife und Rauch (zieht hoch), beim Erzählen wippt sie
      const pb = row === 1 ? f % 2 : 0;
      line(img, ox, oy, 19, 16 + b + pb, 24, 17 + b + pb, P.pipe.base);
      rect(img, ox, oy, 23, 14 + b + pb, 3, 3, P.pipe.base);
      for (let i = 0; i < 3; i++) img.blend(ox + 25 + ((f + i) % 2), oy + 11 - i * 3 - (f % 2), P.grey.light, 0.7);
      if (row === 2) for (let i = 0; i < 4; i++) img.set(ox + 3 + i, oy + 6 - (i % 2) - f % 2, P.gold.base);
    },
    gisela(img, ox, oy, f, row) {
      const flap = row === 2 ? [0, -3, -5, -2][f] : 0;
      const b = row === 0 && f === 2 ? 1 : 0;
      rect(img, ox, oy, 14, 26, 1, 4, P.beak.shadow);
      rect(img, ox, oy, 18, 26, 1, 4, P.beak.shadow);
      blob(img, ox, oy, 17, 21 + b, 8, 6, P.gullWhite);
      // Flügel (bei react flattern)
      poly(img, ox, oy, [[16, 18 + b], [27, 18 + b + flap], [29, 24 + b + flap / 2], [18, 25 + b]], P.gullGrey.base);
      rect(img, ox, oy, 26, 21 + b + flap / 2, 3, 2, ink);
      blob(img, ox, oy, 13, 12 + b, 6, 5.5, P.gullWhite);
      poly(img, ox, oy, [[9, 18 + b], [17, 18 + b], [13, 22 + b]], hex('#3a6ac8'));
      const open = (row === 1 && f % 2 === 1) || (row === 2 && f % 2 === 1);
      const turn = row === 0 && f === 3 ? 1 : 0;
      poly(img, ox, oy, [[8, 11 + b], [2 + turn * 2, 12 + b], [8, 13 + b]], P.beak.base);
      if (open) poly(img, ox, oy, [[8, 13 + b], [3, 15 + b], [8, 14 + b]], P.beak.shadow);
      img.set(ox + 4, oy + 13 + b, hex('#e0403a'));
      eye(img, ox, oy, 11, 10 + b, 1, hex('#f2e05a'), 1, -1);
      line(img, ox, oy, 9, 8 + b, 13, 9 + b, P.gullGrey.outline);
    },
  };

  function sheet(id) {
    const F = 32;
    const img = new Image(F * 4, F * 3);
    for (let row = 0; row < 3; row++)
      for (let f = 0; f < 4; f++) {
        sprites[id](img, f * F, row * F, f, row);
        outlineRegion(img, f * F, row * F, F, F, DARK);
      }
    return img;
  }

  // ------------------------------------------------------------ Hafenstadt 1920×1080 (Pixel ×6)

  function town() {
    const S = 6;
    const W = 320;
    const H = 180;
    const art = new Image(W, H);
    const rng = createRng('harbor-town');
    const base = H - 1;
    const colors = ['#e8a05a', '#d9603f', '#5fa7c9', '#f2e2b6', '#7fbf8a', '#c98ab8', '#e8d07a'];
    let x = 2;
    let i = 0;
    while (x < 170) {
      const w = 18 + Math.floor(rng.range(0, 10));
      const h = 26 + Math.floor(rng.range(0, 22));
      const wall = rampOf(hex(colors[i % colors.length]));
      const roof = rampOf(hex(i % 2 ? '#8a3a3a' : '#3a4a6a'));
      const top = base - h;
      rect(art, 0, 0, x, top, w, h, (cx) => (cx === 0 ? wall.light : cx === w - 1 ? wall.shadow : wall.base));
      // Giebel
      poly(art, 0, 0, [[x - 2, top], [x + w / 2, top - w * 0.45], [x + w + 1, top]], (px) => (px < x + w / 2 ? roof.light : roof.base));
      // Fenster mit Licht
      for (let wy = top + 5; wy < base - 8; wy += 9)
        for (let wx = x + 3; wx < x + w - 4; wx += 7) {
          rect(art, 0, 0, wx, wy, 4, 5, rng.next() < 0.4 ? hex('#ffe08a') : hex('#2a4a6a'));
          rect(art, 0, 0, wx, wy + 5, 4, 1, wall.shadow);
        }
      rect(art, 0, 0, x + Math.floor(w / 2) - 2, base - 8, 4, 8, roof.shadow);
      x += w + 1 + Math.floor(rng.range(0, 3));
      i++;
    }
    // Leuchtturm
    const lx = 290;
    const lt = 118;
    for (let y = lt; y < base; y++) {
      const half = 4 + (y - lt) * 0.06;
      for (let dx = -half; dx <= half; dx++) art.set(lx + dx, y, Math.floor((y - lt) / 9) % 2 ? hex('#f4f1e8') : hex('#d9503f'));
    }
    rect(art, 0, 0, lx - 6, lt - 7, 13, 7, hex('#2a3a4a'));
    rect(art, 0, 0, lx - 4, lt - 6, 9, 5, hex('#ffe08a'));
    poly(art, 0, 0, [[lx - 7, lt - 7], [lx, lt - 13], [lx + 7, lt - 7]], hex('#d9503f'));
    for (let k = 0; k < 30; k++) art.blend(lx - 8 - k * 2, lt - 4 + k * 0.3, hex('#fff6c0'), 0.35 - k * 0.01);
    outlineRegion(art, 0, 0, W, H, DARK);
    // Kaimauer
    rect(art, 0, 0, 0, base - 3, 175, 4, (cx) => (cx % 6 === 0 ? hex('#5a5a6a') : hex('#8a8a9a')));
    const img = new Image(W * S, H * S);
    for (let y = 0; y < H; y++)
      for (let xx = 0; xx < W; xx++) {
        const a = art.alphaAt(xx, y);
        if (a <= 0) continue;
        const k = (y * W + xx) * 4;
        const c = [art.px[k], art.px[k + 1], art.px[k + 2]];
        for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) img.set(xx * S + dx, y * S + dy, c, a);
      }
    return img;
  }

  return { portrait, sheet, town, ids: Object.keys(sprites), portraitIds: Object.keys(portraits) };
}
