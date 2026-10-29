import { makeTools } from './pixel-tools.mjs';

/**
 * Acting-Animationen für Zwischensequenzen (Vorbild: die Charakter-Großaufnahmen bei Dave the Diver).
 * Berts Oberkörper in 96×96 mit vielen Einzelbildern: Reden, Jubeln, Schreck mit Tinte, ertappt, Einholen.
 * Jede Animation ist ein waagerechter Streifen; Länge und Tempo stehen in data/anims.json.
 */
export function makeActing({ Image, hex, mix, rampOf, outlineRegion, white }) {
  const { ink, DARK, blob, poly, line, rect } = makeTools({ hex, mix, white });
  const S = 96;
  const C = {
    octo: rampOf(hex('#f2955e')),
    spot: rampOf(hex('#d9734a')),
    sucker: hex('#ffd9bf'),
    coat: rampOf(hex('#f2a52a')),
    sou: rampOf(hex('#ffd23f')),
    stache: rampOf(hex('#6b4226')),
    nose: rampOf(hex('#ff8a8a')),
    frame: hex('#3a2a20'),
    mouth: hex('#5a2030'),
    inkC: rampOf(hex('#2a1f3a')),
    sweat: rampOf(hex('#9ff0ff')),
    rod: hex('#6b4a2b'),
  };

  /** Tentakel als Kette aus Kreisen: Basis, Startwinkel, Länge, Krümmung, Welle; Saugnäpfe auf der Innenseite. */
  function tentacle(img, x, y, angle, len, r0, curl, wave, phase, ramp = C.octo) {
    let a = angle;
    const pts = [];
    for (let i = 0; i < len; i++) {
      const t = i / len;
      pts.push([x, y, Math.max(1.2, r0 * (1 - t * 0.8)), a]);
      a += curl * (0.25 + t) * 0.55 + Math.sin(phase + i * 0.35) * wave * 0.05;
      x += Math.cos(a) * 1.6;
      y += Math.sin(a) * 1.6;
    }
    for (const [px, py, r] of pts) blob(img, 0, 0, px, py, r, r, ramp);
    pts.forEach(([px, py, r, pa], i) => {
      if (i % 3 !== 1 || r < 2) return;
      const sx = px + Math.cos(pa + Math.PI / 2) * (r - 1);
      const sy = py + Math.sin(pa + Math.PI / 2) * (r - 1);
      img.set(sx, sy, C.sucker);
      img.set(sx + 1, sy, C.sucker);
    });
  }

  /** Berts Oberkörper mit allen Stellschrauben einer Pose. */
  function bust(img, p) {
    const skin = p.skin ? rampOf(hex(p.skin)) : C.octo;
    const dy = p.dy ?? 0;
    const lx = p.lean ?? 0;
    const hx = 48 + lx;
    const hy = 46 + dy + (p.headDy ?? 0);
    // Tintenwolke hinter allem (Oktopusse spritzen Tinte, wenn sie erschrecken)
    if (p.ink) {
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2;
        const r = 10 + p.ink * 22;
        blob(img, 0, 0, 48 + Math.cos(a) * r * 1.3, 70 + Math.sin(a) * r * 0.7, 6 + p.ink * 9, 6 + p.ink * 8, C.inkC, 0.95);
      }
    }
    // Hintere Tentakel (aus dem Mantelsaum und Kragen)
    for (const tt of p.back ?? []) tentacle(img, tt[0], tt[1] + dy, tt[2], tt[3], tt[7] ?? 6, tt[4], tt[5] ?? 6, tt[6] ?? 0, skin);
    // Ölmantel mit Kragen und Matrosenhemd (fehlt beim echten Oktopus)
    if (!p.noCoat) {
    blob(img, 0, 0, 48 + lx * 0.4, 104 + dy, 44, 30, C.coat);
    poly(img, 0, 0, [[40 + lx * 0.5, 74 + dy], [48 + lx * 0.5, 90 + dy], [56 + lx * 0.5, 74 + dy]], (x, y) => ((y - dy) % 4 < 2 ? hex('#3a6ac8') : white));
    poly(img, 0, 0, [[22, 80 + dy], [40 + lx * 0.5, 72 + dy], [46, 96], [26, 96]], C.coat.light);
    poly(img, 0, 0, [[74, 80 + dy], [56 + lx * 0.5, 72 + dy], [50, 96], [70, 96]], C.coat.shadow);
    for (const y of [84, 92]) rect(img, 0, 0, 52 + lx * 0.4, y + dy, 3, 3, hex('#7a5a2a'));
    }
    // Kopf: Oktopus-Mantel, oben etwas länger (unter dem Hut versteckt)
    blob(img, 0, 0, hx, hy, 22, 25, skin);
    blob(img, 0, 0, hx, hy - 14, 17, 14, skin);
    for (const [x, y, r] of [[-14, -10, 2.4], [15, -14, 2], [17, 6, 1.8], [-16, 8, 1.8], [4, -20, 1.6]]) blob(img, 0, 0, hx + x, hy + y, r, r, rampOf(skin.shadow));
    // Augen hinter runder Brille: waagerechte Balken-Pupillen
    const eyes = p.eyes ?? 'open';
    for (const ex of [-10, 10]) {
      const x = hx + ex;
      const y = hy - 2;
      const h = eyes === 'wide' ? 7 : eyes === 'half' ? 3 : 5;
      if (eyes === 'happy' || eyes === 'closed') {
        for (let k = -5; k <= 5; k++) img.set(x + k, y + (eyes === 'happy' ? 1 - Math.round(Math.sqrt(25 - k * k) * 0.6) : 0), ink);
        if (eyes === 'happy') for (let k = -5; k <= 5; k++) img.set(x + k, y + 2 - Math.round(Math.sqrt(25 - k * k) * 0.6), ink);
      } else {
        for (let j = -h; j <= h; j++) for (let k = -6; k <= 6; k++) if ((k * k) / 36 + (j * j) / (h * h) <= 1) img.set(x + k, y + j, white);
        const look = p.look ?? 0;
        const pw = eyes === 'wide' ? 3 : 5;
        rect(img, 0, 0, x - Math.floor(pw / 2) + look, y, pw, 2, ink);
        img.set(x - 2 + look, y - 2, white);
        if (eyes === 'half') rect(img, 0, 0, x - 6, y - h, 13, 2, C.octo.shadow);
      }
    }
    if (!p.noGlasses) {
      for (const ex of [-10, 10])
        for (let a = 0; a < 48; a++) img.set(hx + ex + Math.round(Math.cos((a / 48) * Math.PI * 2) * 9), hy - 2 + Math.round(Math.sin((a / 48) * Math.PI * 2) * 8), C.frame);
      line(img, 0, 0, hx - 1, hy - 4, hx + 1, hy - 4, C.frame);
    }
    // Brauen: Höhe und Winkel tragen die Laune
    const bu = p.brow ?? 0;
    const ba = p.browAngle ?? 0;
    for (const s of p.noGlasses ? [] : [-1, 1]) {
      const bx = hx + s * 10;
      const by = hy - 14 - bu;
      for (let k = -7; k <= 7; k++) blob(img, 0, 0, bx + k, by + k * s * ba * 0.25, 1.6, 1.8, C.stache);
    }
    // Gummiband
    if (!p.noBeard) {
      line(img, 0, 0, hx - 23, hy - 2, hx - 19, hy - 3, hex('#e8e0d0'));
      line(img, 0, 0, hx + 19, hy - 3, hx + 23, hy - 2, hex('#e8e0d0'));
    }
    // Mund (hinter dem Bart sichtbar)
    const mx = hx;
    const my = hy + 16;
    const mouth = p.mouth ?? 'closed';
    if (mouth === 'open') blob(img, 0, 0, mx, my + 1, 5, 3.5, rampOf(C.mouth));
    else if (mouth === 'O') blob(img, 0, 0, mx, my + 2, 4, 5, rampOf(C.mouth));
    else if (mouth === 'grin') {
      poly(img, 0, 0, [[mx - 9, my - 1], [mx + 9, my - 1], [mx + 5, my + 6], [mx - 5, my + 6]], C.mouth);
      rect(img, 0, 0, mx - 8, my - 1, 17, 2, white);
    } else if (mouth === 'grit') {
      rect(img, 0, 0, mx - 7, my, 15, 4, white);
      for (let x = -6; x <= 7; x += 3) line(img, 0, 0, mx + x, my, mx + x, my + 3, C.mouth);
    } else line(img, 0, 0, mx - 5, my + 1, mx + 5, my + (mouth === 'smile' ? 0 : 1), C.mouth);
    // Fake-Bart (kann verrutschen)
    const bd = p.beard ?? [0, 0];
    for (let k = 0; k < (p.noBeard ? 0 : 16); k++) {
      const a = Math.PI * 0.08 + (k / 15) * Math.PI * 0.84;
      blob(img, 0, 0, hx + bd[0] + Math.cos(a) * 17, hy + 24 + bd[1] + Math.sin(a) * 9, 4.4, 4.4, C.stache);
    }
    if (!p.noBeard) blob(img, 0, 0, hx + bd[0], hy + 28 + bd[1], 14, 7, C.stache);
    // Schnurrbart und Knollennase (die Nase kann verrutschen)
    const nd = p.noseDy ?? 0;
    for (const s of p.noBeard ? [] : [-1, 1]) {
      blob(img, 0, 0, hx + s * 8, hy + 12 + nd * 0.5, 8, 3.2, C.stache);
      blob(img, 0, 0, hx + s * 16, hy + 10 - (mouth === 'grin' ? 3 : 0) + nd * 0.5, 3.4, 2.4, C.stache);
    }
    if (!p.noNose) {
      blob(img, 0, 0, hx, hy + 6 + nd, 6, 5.4, C.nose);
      img.set(hx - 2, hy + 3 + nd, white);
      img.set(hx - 1, hy + 3 + nd, white);
    }
    // Südwester (kann abheben)
    const hd = p.hatDy ?? 0;
    const ht = p.hatTilt ?? 0;
    if (!p.noHat) {
    blob(img, 0, 0, hx + ht, hy - 26 - hd, 34, 6, C.sou);
    blob(img, 0, 0, hx + ht * 0.6 - 1, hy - 34 - hd, 20, 10, C.sou);
    line(img, 0, 0, hx - 32 + ht, hy - 24 - hd + ht * 0.3, hx + 32 + ht, hy - 26 - hd - ht * 0.3, C.sou.shadow);
    }
    // Angel
    if (p.rod) {
      const [rx, ry, ra, bend] = p.rod;
      for (let i = 0; i < 70; i++) img.set(rx + Math.cos(ra) * i, ry + Math.sin(ra) * i + (i * i * bend) / 400, C.rod);
    }
    // Vordere Tentakel (Arme aus den Ärmeln)
    for (const tt of p.front ?? []) tentacle(img, tt[0], tt[1] + dy, tt[2], tt[3], 7, tt[4], tt[5] ?? 6, tt[6] ?? 0, skin);
    // Schweißtropfen
    if (p.sweat !== undefined) {
      blob(img, 0, 0, hx + 26, hy - 14 + p.sweat, 2.6, 3.6, C.sweat);
      img.set(hx + 25, hy - 17 + p.sweat, white);
    }
  }

  /** Arm-Tentakel aus dem linken/rechten Ärmel: [x, y, Winkel, Länge, Krümmung, Welle, Phase]. */
  const armL = (angle, curl, phase = 0) => [16, 84, angle, 30, curl, 8, phase];
  const armR = (angle, curl, phase = 0) => [80, 84, angle, 30, curl, 8, phase];

  const anims = {
    talk: Array.from({ length: 8 }, (_, f) => ({
      dy: f % 4 === 2 ? 1 : 0,
      mouth: ['closed', 'open', 'smile', 'open', 'closed', 'O', 'open', 'closed'][f],
      brow: [0, 1, 2, 1, 0, 2, 1, 0][f],
      eyes: f === 5 ? 'closed' : 'open',
      look: f < 4 ? -1 : 1,
      front: [armL(-1.2, -0.02), armR(-1.9 + Math.sin(f * 0.8) * 0.5, -0.08 - Math.sin(f) * 0.03, f)],
      back: [[30, 112, 1.9, 12, 0.05, 6, f], [64, 112, 1.3, 12, -0.05, 6, f + 2]],
    })),
    happy: Array.from({ length: 8 }, (_, f) => {
      const b = [0, -4, -7, -4, 0, 2, 0, -2][f];
      const w = Math.sin((f / 8) * Math.PI * 2);
      return {
        dy: b,
        hatDy: Math.max(0, -b) * 0.8,
        mouth: 'grin',
        eyes: 'happy',
        brow: 4,
        front: [armL(-2.0 + w * 0.5, 0.06, f), armR(-1.1 - w * 0.5, -0.06, f + 1)],
        back: [
          [24, 100, 2.6 - w * 0.4, 16, 0.05, 10, f],
          [72, 100, 0.5 + w * 0.4, 16, -0.05, 10, f + 3],
          [40, 80, -2.2 + w * 0.3, 14, 0.04, 8, f + 1],
          [56, 80, -0.9 - w * 0.3, 14, -0.04, 8, f + 2],
        ],
      };
    }),
    shock: Array.from({ length: 10 }, (_, f) => {
      const t = Math.min(1, f / 3);
      return {
        lean: f > 2 ? (f % 2 ? 2 : -2) : 0,
        eyes: f === 0 ? 'open' : 'wide',
        brow: f === 0 ? 0 : 7,
        mouth: f === 0 ? 'closed' : 'O',
        hatDy: f === 0 ? 0 : Math.min(16, f * 5),
        hatTilt: f > 1 ? (f % 2 ? 3 : -2) : 0,
        beard: [f > 3 ? 2 : 0, f > 2 ? Math.min(8, (f - 2) * 2.5) : 0],
        ink: f > 3 ? Math.min(1, (f - 3) / 5) : 0,
        sweat: f > 1 ? (f * 3) % 9 : undefined,
        front: [armL(-2.6 * t - 1.2 * (1 - t), 0.04, f), armR(-0.6 * t - 1.6 * (1 - t), -0.04, f)],
        back: f > 1 ? [[28, 104, 2.8, 16, 0.07, 10, f], [68, 104, 0.3, 16, -0.07, 10, f], [48, 76, -1.57, 12, 0.02, 12, f]] : [],
      };
    }),
    busted: Array.from({ length: 8 }, (_, f) => ({
      dy: f % 2,
      eyes: f < 4 ? 'open' : 'half',
      look: f < 4 ? 3 : -3,
      brow: 1,
      browAngle: -1,
      mouth: 'smile',
      noseDy: [0, 2, 4, 5, 4, 2, 0, 0][f],
      sweat: f * 2,
      front: [armL(-1.3, -0.02), [80, 84, -2.3 + (f > 2 && f < 6 ? -0.2 : 0.4), 22, -0.09, 4, f]],
    })),
    reel: Array.from({ length: 6 }, (_, f) => {
      const pull = [0, -3, -5, -6, -4, -2][f];
      return {
        lean: pull,
        dy: f % 2,
        eyes: 'half',
        brow: -1,
        browAngle: 2,
        mouth: 'grit',
        sweat: (f * 3) % 9,
        rod: [54 + pull, 78, -0.75, 1 + f * 0.3],
        front: [[16, 84, -0.6, 22, -0.04, 4, f], [80, 84, -2.3, 14, 0.05, 4, f]],
        back: [[44, 96, -0.9, 16, -0.03, 4, f], [60, 104, 0.2, 14, -0.06, 6, f]],
      };
    }),
  };

  /** Echter Oktopus: acht Arme rundherum, wechselt zur Tarnung die Farbe. */
  const camo = ['#f2955e', '#e8b35a', '#c98a5a', '#9a7a6a', '#d9605a', '#f2955e', '#e8b35a', '#f2955e'];
  const allArms = (f) =>
    Array.from({ length: 8 }, (_, k) => {
      const a = Math.PI * (-0.12 + (k / 7) * 1.24);
      return [48 + Math.cos(a) * 14, 58 + Math.sin(a) * 6, a + Math.sin(f * 0.8 + k) * 0.25, 30, (k < 4 ? 1 : -1) * 0.025, 3, f + k, 4.2];
    });
  const raw = { noCoat: true, noHat: true, noGlasses: true, noNose: true, noBeard: true, mouth: 'closed' };
  anims.raw = Array.from({ length: 8 }, (_, f) => ({ ...raw, skin: camo[f], dy: (f % 4 < 2 ? 0 : -2) - 8, eyes: f === 6 ? 'closed' : 'open', look: f < 4 ? -2 : 2, back: allArms(f) }));
  /** Verkleiden, Teil für Teil: Hut, Brille, Nase, Bart, Mantel. */
  anims.dressup = Array.from({ length: 12 }, (_, f) => ({
    noHat: f < 2,
    hatDy: f === 2 ? 10 : f === 3 ? 3 : 0,
    noGlasses: f < 4,
    noNose: f < 6,
    noBeard: f < 8,
    noCoat: f < 10,
    eyes: f === 11 ? 'happy' : 'open',
    mouth: f >= 10 ? 'smile' : 'closed',
    brow: f >= 10 ? 3 : 0,
    look: f % 2 ? 1 : -1,
    back: f < 10 ? allArms(f) : [],
    front: f >= 10 ? [armL(-1.0, -0.03, f), armR(-2.0, -0.05, f)] : [],
  }));

  /** Animation als waagerechter Streifen aus 96×96-Bildern. */
  function strip(name) {
    const frames = anims[name];
    const img = new Image(S * frames.length, S);
    frames.forEach((p, i) => {
      const frame = new Image(S, S);
      bust(frame, p);
      outlineRegion(frame, 0, 0, S, S, DARK);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const a = frame.alphaAt(x, y);
          if (a <= 0) continue;
          const k = (y * S + x) * 4;
          img.set(i * S + x, y, [frame.px[k], frame.px[k + 1], frame.px[k + 2]], a);
        }
    });
    return img;
  }

  return { names: Object.keys(anims), frames: (name) => anims[name].length, strip };
}
