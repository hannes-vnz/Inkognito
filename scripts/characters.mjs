import { makeTools } from './pixel-tools.mjs';

/**
 * Hafen-Figuren als Platzhalter-Pixelkunst: Spritesheets 32×32 (idle, talk, react je 4 Frames),
 * Dialog-Porträts 64×64 und die Hafenstadt im Hintergrund.
 * Bekommt die Werkzeuge des Generators übergeben, damit es nur eine PNG-Pipeline gibt.
 */
export function makeCharacters({ Image, hex, mix, rampOf, outlineRegion, white, createRng }) {
  const { ink, DARK, blob, poly, line, rect, eye, blush } = makeTools({ hex, mix, white });

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
    hawaii: rampOf(hex('#ff7ab0')),
    straw: rampOf(hex('#e8c878')),
    sunburn: rampOf(hex('#f4a080')),
    octo: rampOf(hex('#f2955e')),
    coat: rampOf(hex('#f2a52a')),
    boot: rampOf(hex('#3f7a4a')),
    stache: rampOf(hex('#6b4226')),
    nose: rampOf(hex('#ff8a8a')),
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
    /** Bert: als Mensch verkleideter Oktopus. Ölmantel, Südwester, Nasen-Brille, Fake-Bart; Tentakel mit Saugnäpfen verraten ihn. */
    bert(img, face = 'normal') {
      // Ölmantel mit Matrosenhemd im Ausschnitt
      blob(img, 0, 0, 32, 70, 31, 22, P.coat);
      poly(img, 0, 0, [[25, 49], [32, 60], [39, 49]], (x, y) => (y % 3 === 0 ? hex('#3a6ac8') : white));
      poly(img, 0, 0, [[16, 52], [25, 47], [30, 63], [18, 63]], P.coat.light);
      poly(img, 0, 0, [[48, 52], [39, 47], [34, 63], [46, 63]], P.coat.shadow);
      for (const y of [56, 61]) rect(img, 0, 0, 36, y, 2, 2, hex('#7a5a2a'));
      // Kopf: runder Oktopus-Mantel, warme Farbe mit Flecken
      blob(img, 0, 0, 32, 30, 17, 19, P.octo);
      for (const [x, y, r] of [[21, 22, 1.6], [42, 20, 1.4], [44, 34, 1.2], [19, 36, 1.2]]) blob(img, 0, 0, x, y, r, r, rampOf(hex('#d9734a')));
      // Augen: waagerechte Balken-Pupillen (echtes Oktopus-Merkmal)
      const lid = face === 'happy' ? 0.35 : face === 'annoyed' ? 0.55 : face === 'shock' ? 1.25 : 1;
      for (const ex of [25, 39]) {
        const h = Math.max(1, Math.round(3 * lid));
        for (let j = -h; j <= h; j++) for (let k = -4; k <= 4; k++) if ((k * k) / 16 + (j * j) / (h * h) <= 1) img.set(ex + k, 30 + j, white);
        if (face === 'happy') {
          for (let k = -3; k <= 3; k++) img.set(ex + k, 29 - Math.round(Math.sqrt(9 - k * k) * 0.6), ink);
          rect(img, 0, 0, ex - 3, 30, 7, 2, P.octo.base);
        } else {
          // Kleine Balken-Pupille mit Glanzpunkt, Blick leicht zur Seite
          rect(img, 0, 0, ex - 1, 30, face === 'shock' ? 2 : 3, 2, ink);
          img.set(ex, 30, hex('#3a2a20'));
          img.set(ex - 1, 29, white);
          if (face !== 'shock') rect(img, 0, 0, ex - 4, 27, 9, 1, P.octo.shadow);
        }
      }
      // Runde Brille
      for (const ex of [25, 39])
        for (let a = 0; a < 36; a++) img.set(ex + Math.round(Math.cos((a / 36) * Math.PI * 2) * 6), 30 + Math.round(Math.sin((a / 36) * Math.PI * 2) * 5.5), hex('#3a2a20'));
      line(img, 0, 0, 30, 29, 34, 29, hex('#3a2a20'));
      // Buschige Fake-Augenbrauen, je nach Laune
      const brow = { normal: [0, 0], happy: [-2, -2], annoyed: [2, -2], shock: [-4, -4] }[face] ?? [0, 0];
      blob(img, 0, 0, 25, 22 + brow[0] * 0.5, 6, 1.8, P.stache);
      blob(img, 0, 0, 39, 22 + brow[0] * 0.5, 6, 1.8, P.stache);
      if (face === 'annoyed') {
        line(img, 0, 0, 20, 21, 30, 24, P.stache.shadow);
        line(img, 0, 0, 34, 24, 44, 21, P.stache.shadow);
      }
      // Gummiband der Verkleidung bis hinter die Ohren
      line(img, 0, 0, 15, 31, 19, 30, hex('#e8e0d0'));
      line(img, 0, 0, 45, 30, 49, 31, hex('#e8e0d0'));
      // Fake-Bart unten, Mund dazwischen, großer Schnurrbart, Knollennase
      for (let k = 0; k < 14; k++) {
        const a = Math.PI * 0.1 + (k / 13) * Math.PI * 0.8;
        blob(img, 0, 0, 32 + Math.cos(a) * 13, 45 + Math.sin(a) * 7, 3.2, 3.2, P.stache);
      }
      blob(img, 0, 0, 32, 48, 11, 6, P.stache);
      if (face === 'happy') {
        poly(img, 0, 0, [[26, 43], [38, 43], [35, 48], [29, 48]], hex('#5a2030'));
        rect(img, 0, 0, 27, 43, 10, 2, white);
      } else if (face === 'shock') blob(img, 0, 0, 32, 46, 3, 3.5, rampOf(hex('#5a2030')));
      else line(img, 0, 0, 28, 45, 36, 45 - (face === 'annoyed' ? 0 : 1), hex('#5a2030'));
      for (const side of [-1, 1]) {
        blob(img, 0, 0, 32 + side * 6, 41, 6, 2.4, P.stache);
        blob(img, 0, 0, 32 + side * 12, 40 - (face === 'happy' ? 2 : 0), 2.4, 1.8, P.stache);
      }
      blob(img, 0, 0, 32, 36, 4.2, 3.8, P.nose);
      img.set(31, 34, white);
      // Tentakel-Hand aus dem Ärmel, mit Saugnäpfen
      const wave = face === 'happy' ? -6 : face === 'shock' ? -10 : 0;
      for (let k = 0; k < 14; k++) {
        const x = 52 + Math.sin(k * 0.45) * 3;
        const y = 62 - k + wave * (k / 14);
        blob(img, 0, 0, x, y, 2.6 - k * 0.12, 1.4, P.octo);
        if (k % 3 === 1) img.set(x - 1, y, hex('#ffd0b0'));
      }
      if (face === 'shock') {
        blob(img, 0, 0, 51, 13, 2.2, 3, rampOf(hex('#9ff0ff')));
        img.set(50, 11, white);
      }
      // Südwester, leicht schief
      blob(img, 0, 0, 32, 15, 25, 4.6, P.sou);
      blob(img, 0, 0, 31, 9, 15, 7.5, P.sou);
      line(img, 0, 0, 10, 16, 54, 14, P.sou.shadow);
      for (let x = 18; x < 44; x += 4) img.set(x, 6 + ((x / 4) % 2), P.sou.light);
    },
  };

  /** Wo Augen und Mund sitzen und welche Farbe darunter liegt (für die Gesichtsausdrücke). */
  const faces = {
    hilde: { skin: P.skin.base, eyes: [[27, 32, 3], [38, 31, 3]], mouth: [29, 36, 41] },
    bruno: { skin: P.shark.base, eyes: [[22, 29, 3]] },
    qualle: { skin: white, eyes: [[24, 29, 3], [40, 29, 3]], mouth: [29, 35, 37], mouthSkin: P.jelly.base },
    knut: { skin: P.skinRed.base, eyes: [[26, 30, 2], [37, 30, 3]] },
    gisela: { skin: P.gullWhite.base, eyes: [[26, 25, 2]] },
  };

  /** Gesichtsausdruck über das neutrale Porträt legen: happy, annoyed, shock. */
  function expression(img, id, face) {
    const f = faces[id];
    for (const [x, y, r] of f.eyes) {
      const clear = (rr) => {
        for (let j = -rr; j <= rr; j++) for (let i = -rr; i <= rr; i++) if (i * i + j * j <= rr * rr + 1) img.set(x + i, y + j, f.skin);
      };
      if (face === 'happy') {
        clear(r + 1);
        for (let i = -r; i <= r; i++) img.set(x + i, y + 1 - Math.round(Math.sqrt(Math.max(0, r * r - i * i)) * 0.7), ink);
      } else if (face === 'shock') {
        clear(r + 1);
        for (let j = -r - 1; j <= r + 1; j++) for (let i = -r - 1; i <= r + 1; i++) if (i * i + j * j <= (r + 1) * (r + 1)) img.set(x + i, y + j, white);
        rect(img, 0, 0, x - 1, y - 1, 2, 2, ink);
        for (let k = 0; k < 24; k++) img.set(x + Math.round(Math.cos((k / 24) * Math.PI * 2) * (r + 1.5)), y + Math.round(Math.sin((k / 24) * Math.PI * 2) * (r + 1.5)), ink);
      } else if (face === 'annoyed') {
        for (let j = -r - 1; j < 0; j++) for (let i = -r - 1; i <= r + 1; i++) if (i * i + j * j <= (r + 1) * (r + 1)) img.set(x + i, y + j, f.skin);
        line(img, 0, 0, x - r - 1, y, x + r + 1, y - 1, ink);
      }
    }
    if (face === 'shock') {
      blob(img, 0, 0, 52, 14, 2.2, 3, rampOf(hex('#9ff0ff')));
      img.set(51, 12, white);
    }
    if (!f.mouth) return;
    const [x0, x1, y] = f.mouth;
    const ms = f.mouthSkin ?? f.skin;
    rect(img, 0, 0, x0 - 1, y - 2, x1 - x0 + 3, 4, ms);
    if (face === 'happy') {
      line(img, 0, 0, x0, y - 1, x0 + 1, y, ink);
      line(img, 0, 0, x0 + 1, y, x1 - 1, y, ink);
      line(img, 0, 0, x1 - 1, y, x1, y - 1, ink);
      rect(img, 0, 0, x0 + 2, y + 1, x1 - x0 - 3, 1, hex('#a8505a'));
    } else if (face === 'shock') blob(img, 0, 0, (x0 + x1) / 2, y, 2, 2, rampOf(hex('#5a2030')));
    else line(img, 0, 0, x0, y, x1, y - (face === 'annoyed' ? 1 : 0), ink);
  }

  /** Porträt 64×64; `face`: normal, happy, annoyed oder shock. */
  function portrait(id, face = 'normal') {
    const img = new Image(64, 64);
    if (id === 'bert') portraits.bert(img, face);
    else {
      portraits[id](img);
      if (face !== 'normal') expression(img, id, face);
    }
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

  /** Herr Schulze: Hawaiihemd mit Blüten, Strohhut, Sonnenbrille auf der Stirn, Kamera, Sonnenbrand. */
  portraits.schulze = (img) => {
    blob(img, 0, 0, 32, 68, 31, 20, P.hawaii);
    for (const [x, y] of [[16, 54], [26, 60], [40, 55], [48, 61], [33, 52], [20, 62]]) {
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) img.set(x + dx, y + dy, white);
      img.set(x, y, P.gold.base);
    }
    poly(img, 0, 0, [[27, 48], [32, 56], [37, 48]], P.sunburn.base);
    // Kamera am Riemen
    line(img, 0, 0, 22, 48, 30, 58, ink);
    line(img, 0, 0, 42, 48, 34, 58, ink);
    rect(img, 0, 0, 28, 56, 10, 7, hex('#2a2a3a'));
    blob(img, 0, 0, 33, 59.5, 2.4, 2.4, rampOf(hex('#5ce1e6')));
    rect(img, 0, 0, 35, 55, 2, 1, hex('#ff6b6b'));
    blob(img, 0, 0, 32, 32, 13, 14, P.sunburn);
    blob(img, 0, 0, 19, 33, 3, 4, P.sunburn);
    blob(img, 0, 0, 45, 33, 3, 4, P.sunburn);
    blob(img, 0, 0, 32, 35, 3, 2.6, rampOf(hex('#ff5a4a')));
    // Schnurrbart
    blob(img, 0, 0, 28, 39, 4, 1.6, rampOf(hex('#8a6a4a')));
    blob(img, 0, 0, 36, 39, 4, 1.6, rampOf(hex('#8a6a4a')));
    line(img, 0, 0, 29, 42, 35, 42, ink);
    eye(img, 0, 0, 27, 31, 2, hex('#3a6aa8'), 1, -1);
    eye(img, 0, 0, 38, 31, 2, hex('#3a6aa8'), 1, -1);
    // Sonnenbrille auf der Stirn, Strohhut
    rect(img, 0, 0, 22, 24, 8, 3, ink);
    rect(img, 0, 0, 34, 24, 8, 3, ink);
    line(img, 0, 0, 30, 25, 34, 25, ink);
    blob(img, 0, 0, 32, 18, 24, 4, P.straw);
    blob(img, 0, 0, 32, 12, 13, 7, P.straw);
    rect(img, 0, 0, 20, 15, 24, 2, hex('#3a6ac8'));
    for (let x = 10; x < 54; x += 3) img.set(x, 19 + ((x / 3) % 2), P.straw.shadow);
  };
  faces.schulze = { skin: P.sunburn.base, eyes: [[27, 31, 2], [38, 31, 2]], mouth: [29, 35, 42] };
  sprites.schulze = (img, ox, oy, f, row) => {
    const b = f === 1 || f === 2 ? 1 : 0;
    // Shorts, Socken in Sandalen
    rect(img, ox, oy, 12, 27, 3, 4, P.sunburn.base);
    rect(img, ox, oy, 17, 27, 3, 4, P.sunburn.base);
    rect(img, ox, oy, 12, 29, 3, 2, white);
    rect(img, ox, oy, 17, 29, 3, 2, white);
    rect(img, ox, oy, 11, 31, 4, 1, hex('#7a4a2a'));
    rect(img, ox, oy, 17, 31, 4, 1, hex('#7a4a2a'));
    rect(img, ox, oy, 11, 24, 10, 4, hex('#d9c27a'));
    blob(img, ox, oy, 16, 20 + b, 8, 6, P.hawaii);
    for (const [x, y] of [[12, 18], [19, 21], [15, 23]]) img.set(ox + x, oy + y + b, white);
    blob(img, ox, oy, 16, 11 + b, 6.5, 6.5, P.sunburn);
    img.set(ox + 16, oy + 12 + b, hex('#ff5a4a'));
    line(img, ox, oy, 13, 14 + b, 19, 14 + b, hex('#8a6a4a'));
    if (row === 1 && f % 2) rect(img, ox, oy, 15, 15 + b, 3, 1, hex('#5a2030'));
    eye(img, ox, oy, 13, 10 + b, 1, ink, f === 3 && row === 0 ? 0 : 1, -1);
    eye(img, ox, oy, 19, 10 + b, 1, ink, f === 3 && row === 0 ? 0 : 1, -1);
    blob(img, ox, oy, 16, 6 + b, 10, 2, P.straw);
    blob(img, ox, oy, 16, 3.5 + b, 5.5, 3, P.straw);
    rect(img, ox, oy, 11, 4 + b, 11, 1, hex('#3a6ac8'));
    // Kamera; bei react blitzt sie
    rect(img, ox, oy, 19, 19 + b, 6, 4, hex('#2a2a3a'));
    img.set(ox + 22, oy + 21 + b, hex('#5ce1e6'));
    if (row === 2 && f % 2 === 0) for (const [dx, dy] of [[0, -3], [3, 0], [-3, 0], [0, 3], [0, 0]]) img.set(ox + 24 + dx, oy + 17 + b + dy, white);
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

  // ------------------------------------------------------------ Bert (Spielfigur) 32×32

  /** Reihen: idle (6), cast (4), cheer (4), sweat (4). Rosa Oktopus, Südwester, viel zu großer Fake-Bart. */
  /**
   * Reihen: idle (6), cast (4), cheer (4), sweat (4). Bert im Ölmantel mit Gummistiefeln, Nasen-Brille
   * und Fake-Bart; Tentakel-Arme aus den Ärmeln, ab und zu lugt ein Tentakel aus dem Stiefel.
   */
  function bert() {
    const F = 32;
    const img = new Image(F * 6, F * 4);
    const rod = hex('#6b4a2b');
    const rows = [
      Array.from({ length: 6 }, (_, f) => ({ bob: f === 2 || f === 3 ? 1 : 0, blink: f === 4, peek: f === 5, rod: -1.15, arm: 0 })),
      [0, 1, 2, 3].map((f) => ({ bob: 0, rod: [-2.3, -1.9, -0.7, -0.2][f], arm: [-3, -2, 1, 2][f], lean: [-1, -1, 1, 1][f] })),
      [0, 1, 2, 3].map((f) => ({ bob: f % 2 ? -2 : 0, rod: -1.6, cheer: f % 2, happy: true })),
      [0, 1, 2, 3].map((f) => ({ bob: f % 2, rod: -0.9, sweat: f, fix: f % 2, shake: f % 2 ? 1 : -1 })),
    ];
    rows.forEach((frames, row) =>
      frames.forEach((o, col) => {
        const frame = new Image(F, F);
        const b = o.bob;
        const sx = (o.shake ?? 0) * 0.5 + (o.lean ?? 0) * 0.5;
        // Gummistiefel; aus dem einen lugt manchmal ein Tentakel
        for (const bx of [11, 18]) {
          rect(frame, 0, 0, bx, 26, 4, 5, (i) => (i === 0 ? P.boot.light : P.boot.base));
          rect(frame, 0, 0, bx - 1, 30, 6, 2, P.boot.shadow);
        }
        if (o.peek) for (let k = 0; k < 4; k++) frame.set(21 + k * 0.6, 25 - k, k === 3 ? hex('#ffd0b0') : P.octo.base);
        // Unter dem Mantelsaum ringeln sich Tentakel heraus und bewegen sich
        for (const [bx, dir] of [[8, -1], [24, 1]]) {
          const ph = col * 1.1 + (dir > 0 ? 1.5 : 0);
          for (let k = 0; k < 6; k++) {
            const x = bx + dir * (k * 0.7 + Math.sin(ph + k * 0.8) * 0.8);
            const y = 26 + k * 0.7 - Math.max(0, k - 3) * 1.4 * Math.abs(Math.sin(ph));
            frame.set(x, y, P.octo.base);
            frame.set(x, y + 1, k === 5 ? hex('#ffd0b0') : P.octo.shadow);
          }
        }
        // Ölmantel
        poly(frame, 0, 0, [[11 + sx, 14 + b], [21 + sx, 14 + b], [24 + sx, 27], [8 + sx, 27]], (x) => (x < 12 + sx ? P.coat.light : x > 20 + sx ? P.coat.shadow : P.coat.base));
        for (const y of [18, 22]) frame.set(16 + sx, y + b, hex('#7a5a2a'));
        poly(frame, 0, 0, [[14 + sx, 14 + b], [16 + sx, 17 + b], [18 + sx, 14 + b]], white);
        // Tentakel-Arme aus den Ärmeln
        const armL = o.cheer !== undefined ? -1 : 1;
        for (let k = 0; k < 6; k++) frame.set(10 + sx - k * 0.3, 18 + b + k * armL * (o.cheer !== undefined ? 1.4 : 0.9) - (o.cheer ? 1 : 0), P.octo.base);
        // Kopf
        blob(frame, 0, 0, 16 + sx, 9 + b, 6.5, 6.5, P.octo);
        frame.set(12 + sx, 6 + b, rampOf(hex('#d9734a')).base);
        // Augen hinter der Brille (zu beim Blinzeln, glücklich beim Jubeln)
        for (const ex of [13, 19]) {
          const x = ex + sx;
          const y = 9 + b;
          for (const [dx, dy] of [[-2, -1], [-1, -2], [0, -2], [1, -1], [1, 0], [1, 1], [0, 2], [-1, 2], [-2, 1], [-2, 0]]) frame.set(x + dx, y + dy, hex('#3a2a20'));
          if (o.blink || o.happy) {
            frame.set(x - 1, y, ink);
            frame.set(x, y, ink);
          } else {
            rect(frame, 0, 0, x - 1, y - 1, 2, 3, white);
            rect(frame, 0, 0, x - 1, y, 2, 1, ink);
          }
        }
        frame.set(16 + sx, 9 + b, hex('#3a2a20'));
        // Brauen, Knollennase, Schnurrbart, Bart
        line(frame, 0, 0, 11 + sx, 6 + b - (o.happy ? 1 : 0), 14 + sx, 6 + b, P.stache.base);
        line(frame, 0, 0, 18 + sx, 6 + b, 21 + sx, 6 + b - (o.happy ? 1 : 0), P.stache.base);
        blob(frame, 0, 0, 16 + sx + (o.fix ? 1 : 0), 11.5 + b, 1.8, 1.4, P.nose);
        line(frame, 0, 0, 12 + sx, 13 + b, 20 + sx, 13 + b, P.stache.base);
        frame.set(11 + sx, 12 + b, P.stache.base);
        frame.set(21 + sx, 12 + b, P.stache.base);
        blob(frame, 0, 0, 16 + sx, 15.5 + b, 4.5, 2.4, P.stache);
        if (o.happy) rect(frame, 0, 0, 15 + sx, 14 + b, 3, 1, hex('#5a2030'));
        // Südwester
        blob(frame, 0, 0, 16 + sx, 4 + b, 10, 1.8, P.sou);
        blob(frame, 0, 0, 16 + sx, 2 + b, 5.5, 2.6, P.sou);
        // Angel in der rechten Tentakel-Hand
        const hx = 23 + sx + (o.arm ?? 0) * 0.3;
        const hy = 18 + b;
        for (let k = 0; k < 4; k++) frame.set(21 + sx + k * 0.6, 16 + b + k * 0.5, P.octo.base);
        for (let i = 0; i < 15; i++) frame.set(hx + Math.cos(o.rod) * i, hy + Math.sin(o.rod) * i, rod);
        blob(frame, 0, 0, hx, hy, 1.5, 1.5, P.octo);
        frame.set(hx, hy, hex('#ffd0b0'));
        // Jubelarme, Schweißtropfen
        if (o.cheer !== undefined)
          for (const side of [-1, 1]) for (let i = 0; i < 7; i++) frame.set(16 + sx + side * (8 + i * 0.4), 15 + b - i - o.cheer, P.octo.base);
        if (o.sweat !== undefined) {
          blob(frame, 0, 0, 24 + sx, 6 + b + (o.sweat % 2) * 2, 1.2, 1.8, rampOf(hex('#9ff0ff')));
          frame.set(24 + sx, 4 + b + (o.sweat % 2) * 2, white);
        }
        outlineRegion(frame, 0, 0, F, F, DARK);
        for (let y = 0; y < F; y++)
          for (let x = 0; x < F; x++) {
            const a = frame.alphaAt(x, y);
            if (a <= 0) continue;
            const k = (y * F + x) * 4;
            img.set(col * F + x, row * F + y, [frame.px[k], frame.px[k + 1], frame.px[k + 2]], a);
          }
      }),
    );
    return img;
  }

  // ------------------------------------------------------------ Kutter 64×32

  function boat() {
    const img = new Image(64, 32);
    const hull = rampOf(hex('#d9573b'));
    const wood = rampOf(hex('#c8a26a'));
    const cabin = rampOf(hex('#f2ead8'));
    const roof = rampOf(hex('#3a6a9a'));
    // Rumpf: Planken, weißer Streifen, dunkler Kiel
    poly(img, 0, 0, [[1, 19], [63, 17], [58, 29], [8, 30]], (x, y) => (y < 20 ? hull.light : y === 22 ? white : y > 27 ? rampOf(hex('#5a2a2a')).base : (x + y * 3) % 11 === 0 ? hull.shadow : hull.base));
    line(img, 0, 0, 2, 19, 62, 17, wood.light);
    for (const x of [14, 24, 52]) blob(img, 0, 0, x, 24.5, 1.4, 1.4, rampOf(hex('#5ce1e6')));
    // Kajüte mit Dach, Fenstern, Tür und Rettungsring
    rect(img, 0, 0, 32, 8, 18, 10, (i, j) => (j < 2 ? cabin.light : i === 17 ? cabin.shadow : cabin.base));
    rect(img, 0, 0, 30, 6, 22, 2, roof.base);
    rect(img, 0, 0, 30, 6, 22, 1, roof.light);
    for (const x of [35, 41]) rect(img, 0, 0, x, 10, 4, 3, hex('#5ce1e6'));
    rect(img, 0, 0, 46, 11, 3, 7, wood.shadow);
    blob(img, 0, 0, 33.5, 14, 2.2, 2.2, rampOf(hex('#ff6b4a')));
    img.set(33, 14, cabin.base);
    // Schornstein mit Rauchwölkchen
    rect(img, 0, 0, 47, 2, 3, 4, hex('#2a3a4a'));
    rect(img, 0, 0, 47, 2, 3, 1, hex('#ffd23f'));
    // Mast mit Wimpel, Taurolle, Anker am Bug
    line(img, 0, 0, 22, 1, 22, 18, wood.shadow);
    poly(img, 0, 0, [[23, 1], [29, 3], [23, 5]], hex('#ffd23f'));
    blob(img, 0, 0, 10, 17, 3, 1.4, wood);
    line(img, 0, 0, 59, 19, 59, 23, hex('#5a5a6a'));
    line(img, 0, 0, 57, 23, 61, 23, hex('#5a5a6a'));
    outlineRegion(img, 0, 0, 64, 32, DARK);
    return img;
  }

  return { portrait, faces: ['normal', 'happy', 'annoyed', 'shock'], sheet, town, bert, boat, ids: Object.keys(sprites), portraitIds: Object.keys(portraits) };
}
