import { makeTools } from './pixel-tools.mjs';

/**
 * Fische und andere Meerestiere als Pixel-Sprites (ARTSTIL.md: 4-stufige Rampe, farbige Kontur,
 * große Augen mit Glanzpunkt, echte Körperform). Spritesheet je Art: Reihen idle, swim, turn, catch
 * mit je 4 Frames, Blick nach rechts.
 */
export function makeFish({ Image, hex, mix, rampOf, outlineRegion, white }) {
  const { ink, blob, poly, line, rect, eye } = makeTools({ hex, mix, white });
  const glowC = hex('#7dfff0');

  /** Pose pro Frame: Schwanzschlag, Stauchung beim Wenden, Zappeln beim Fang. */
  const poseOf = (row, col) => ({
    sway: [0, 1, 0, -1][col] * (row === 1 ? 1.6 : 0.8),
    squash: row === 2 ? [0.5, 0.7, 0.88, 1][col] : 1,
    catch: row === 3,
    dy: row === 3 ? [-1, 1, -1, 1][col] : 0,
    flap: col % 2,
    col,
  });

  /** Kleines oder großes Auge, je nach Größe. */
  function fishEye(img, ox, oy, x, y, r, iris = ink, wide = false) {
    x = Math.round(x);
    y = Math.round(y);
    if (r >= 2) {
      eye(img, ox, oy, x, y, Math.round(r) + (wide ? 1 : 0), iris, 1, 1);
      return;
    }
    rect(img, ox, oy, x - 1, y - 1, 2, 2, white);
    img.set(ox + x, oy + y - 1 + (wide ? 0 : 1), iris);
  }

  const shadeY = (ramp, y, top, bottom) => {
    const t = (y - top) / Math.max(1, bottom - top);
    return t < 0.3 ? ramp.light : t > 0.75 ? ramp.shadow : ramp.base;
  };

  // ------------------------------------------------------------ Grundform Fisch

  function fish(img, ox, oy, fw, fh, p, o, ramp) {
    const back = o.back ? rampOf(hex(o.back)) : ramp;
    const belly = rampOf(o.belly ? hex(o.belly) : mix(ramp.base, white, 0.55));
    const fin = rampOf(o.fin ? hex(o.fin) : mix(ramp.base, white, 0.25));
    const cx = fw * (o.cx ?? 0.56);
    const cy = fh * 0.5 + p.dy;
    const rx = fw * (o.len ?? 0.34) * p.squash;
    const ry = fh * (o.height ?? 0.36);
    // Schwanzflosse (gegabelt oder halbmondförmig)
    const tb = cx - rx * 0.85;
    const tl = fw * (o.tail ?? 0.18) * Math.max(0.6, p.squash);
    const sp = fh * (o.fork ?? 0.32);
    const sw = p.sway;
    poly(img, ox, oy, [[tb + 1, cy - ry * 0.3], [tb - tl, cy - sp + sw], [tb - tl * (o.lunate ? 0.35 : 0.55), cy + sw * 0.5], [tb - tl, cy + sp + sw], [tb + 1, cy + ry * 0.3]], (x, y) => shadeY(fin, y, cy - sp, cy + sp));
    // Rücken- und Afterflosse
    const dh = fh * (o.dorsal ?? 0.2);
    poly(img, ox, oy, [[cx - rx * 0.45, cy - ry * 0.75], [cx - rx * 0.15 - p.flap, cy - ry - dh], [cx + rx * 0.25, cy - ry * 0.85]], o.dorsalColor ? hex(o.dorsalColor) : fin.base);
    if (o.anal !== false) poly(img, ox, oy, [[cx - rx * 0.4, cy + ry * 0.8], [cx - rx * 0.2 + p.flap, cy + ry + dh * 0.5], [cx + rx * 0.05, cy + ry * 0.85]], fin.shadow);
    // Körper mit dunklerem Rücken und hellem Bauch
    blob(img, ox, oy, cx, cy, rx, ry, ramp);
    if (o.back) blob(img, ox, oy, cx, cy, rx, ry, back, 1, (x, y) => y < cy - ry * 0.15);
    blob(img, ox, oy, cx + rx * 0.08, cy + ry * 0.4, rx * 0.82, ry * 0.55, belly, 1, (x, y) => y > cy + ry * 0.12);
    if (o.bigBelly) blob(img, ox, oy, cx - rx * 0.1, cy + ry * 0.55, rx * 0.6, ry * 0.7, rampOf(hex(o.bigBelly)));
    // Muster
    pattern(img, ox, oy, cx, cy, rx, ry, o, ramp, p);
    // Kiemenbogen
    for (let y = -ry * 0.55; y <= ry * 0.45; y++) img.set(ox + cx + rx * 0.32 - Math.abs(y) * 0.25, oy + cy + y, ramp.shadow);
    // Brustflosse (bei Flügelfischen riesig)
    if (o.wings) {
      const wl = fw * 0.42;
      poly(img, ox, oy, [[cx + rx * 0.1, cy], [cx - wl, cy - fh * 0.42 - p.flap * 2], [cx - wl * 0.7, cy + 1]], mix(fin.light, white, 0.3), 0.92);
      line(img, ox, oy, cx + rx * 0.1, cy, cx - wl, cy - fh * 0.42 - p.flap * 2, fin.shadow);
    } else poly(img, ox, oy, [[cx + rx * 0.2, cy + 1], [cx - rx * 0.2, cy - 1 + p.flap], [cx - rx * 0.15, cy + ry * 0.45]], fin.light, 0.9);
    // Maul, beim Fang offen
    const mx = cx + rx * 0.95;
    const my = cy + ry * (o.mouthY ?? 0.15);
    if (p.catch) rect(img, ox, oy, mx - 2, my, 2, 2, hex('#5a2030'));
    else line(img, ox, oy, mx - 2, my, mx, my, ramp.outline);
    if (o.fangs) for (let i = 0; i < 3; i++) line(img, ox, oy, mx - 3 + i * 1.5, my - 1, mx - 3 + i * 1.5, my + 1 + (i % 2) * 2, white);
    if (o.barbel) line(img, ox, oy, mx - 2, my + 1, mx - 3, my + 3 + p.flap, ramp.shadow);
    // Auge
    const er = Math.max(1, fh * (o.eye ?? 0.13));
    fishEye(img, ox, oy, cx + rx * (o.eyeX ?? 0.55), cy - ry * (o.eyeY ?? 0.22), er, o.iris ? hex(o.iris) : ink, p.catch);
    return { cx, cy, rx, ry, mx, my };
  }

  function pattern(img, ox, oy, cx, cy, rx, ry, o, ramp, p) {
    const dark = ramp.shadow;
    switch (o.pattern) {
      case 'waves':
        for (let k = 0; k < 6; k++) for (let y = -ry; y < -ry * 0.1; y++) img.set(ox + cx - rx * 0.6 + k * rx * 0.25 + Math.sin(y * 0.9) * 1.2, oy + cy + y, rampOf(hex(o.back ?? '#2f4f6a')).shadow);
        break;
      case 'spots':
        for (let k = 0; k < 8; k++) img.set(ox + cx - rx * 0.6 + ((k * 37) % 10) / 10 * rx * 1.3, oy + cy - ry * 0.5 + ((k * 53) % 10) / 10 * ry * 0.9, o.spot ? hex(o.spot) : dark);
        break;
      case 'mottled':
        for (let k = 0; k < 14; k++) img.set(ox + cx - rx * 0.7 + ((k * 29) % 13) / 13 * rx * 1.5, oy + cy - ry * 0.6 + ((k * 17) % 7) / 7 * ry * 0.8, dark);
        break;
      case 'bars':
        for (let k = 0; k < 4; k++) for (let y = -ry * 0.8; y < ry * 0.3; y++) img.set(ox + cx - rx * 0.5 + k * rx * 0.33, oy + cy + y, dark);
        break;
      case 'photophores':
        for (let k = 0; k < 6; k++) img.set(ox + cx - rx * 0.6 + k * rx * 0.25, oy + cy + ry * 0.6, glowC);
        if (p.col % 2) for (let k = 0; k < 3; k++) img.set(ox + cx - rx * 0.4 + k * rx * 0.35, oy + cy + ry * 0.2, glowC);
        break;
      case 'finlets':
        for (let k = 0; k < 4; k++) {
          img.set(ox + cx - rx * 0.6 - k * 2, oy + cy - ry * 0.55, hex('#ffd23f'));
          img.set(ox + cx - rx * 0.6 - k * 2, oy + cy + ry * 0.55, hex('#ffd23f'));
        }
        break;
      case 'line':
        line(img, ox, oy, cx - rx * 0.8, cy - ry * 0.05, cx + rx * 0.3, cy - ry * 0.25, mix(ramp.light, white, 0.5));
        break;
    }
  }

  // ------------------------------------------------------------ Sonderformen

  const special = {
    sunfish(img, ox, oy, fw, fh, p, o, ramp) {
      const cx = fw * 0.55;
      const cy = fh / 2 + p.dy;
      poly(img, ox, oy, [[cx - 4, cy - fh * 0.3], [cx - 7 + p.sway, 1], [cx + 3, cy - fh * 0.3]], ramp.shadow);
      poly(img, ox, oy, [[cx - 4, cy + fh * 0.3], [cx - 7 - p.sway, fh - 2], [cx + 3, cy + fh * 0.3]], ramp.shadow);
      blob(img, ox, oy, cx, cy, fw * 0.36 * p.squash, fh * 0.34, ramp);
      for (let y = -fh * 0.3; y <= fh * 0.3; y += 2) img.set(ox + cx - fw * 0.36 * p.squash - 1, oy + cy + y, ramp.light);
      blob(img, ox, oy, cx + 2, cy + fh * 0.12, fw * 0.24, fh * 0.16, rampOf(mix(ramp.base, white, 0.5)), 1, (x, y) => y > cy);
      fishEye(img, ox, oy, cx + fw * 0.2, cy - fh * 0.08, Math.max(2, fh * 0.08), ink, p.catch);
      line(img, ox, oy, cx + fw * 0.3, cy + 2, cx + fw * 0.33, cy + 2, ramp.outline);
    },
    hatchet(img, ox, oy, fw, fh, p, o, ramp) {
      const cx = fw * 0.55;
      const cy = fh * 0.45 + p.dy;
      poly(img, ox, oy, [[cx - fw * 0.3 * p.squash, cy - fh * 0.15], [cx + fw * 0.3, cy - fh * 0.3], [cx + fw * 0.25, cy + fh * 0.2], [cx - fw * 0.05, cy + fh * 0.45], [cx - fw * 0.3 * p.squash, cy + fh * 0.05]], (x, y) => shadeY(ramp, y, cy - fh * 0.3, cy + fh * 0.45));
      poly(img, ox, oy, [[cx - fw * 0.3, cy - 1], [cx - fw * 0.45, cy - 3 + p.sway], [cx - fw * 0.45, cy + 3 + p.sway]], ramp.shadow);
      for (let k = 0; k < 4; k++) img.set(ox + cx - fw * 0.1 + k * 2, oy + cy + fh * 0.32 - k, glowC);
      fishEye(img, ox, oy, cx + fw * 0.15, cy - fh * 0.12, Math.max(1.5, fh * 0.12), ink, true);
    },
    eel(img, ox, oy, fw, fh, p, o, ramp) {
      const cy = fh / 2 + p.dy;
      const n = Math.round(fw * 0.82 * p.squash);
      const head = fw * 0.88;
      for (let i = n; i >= 0; i--) {
        const x = head - (fw * 0.06 + i);
        const y = cy + Math.sin(i * 0.28 + p.col * 1.3) * (fh * 0.12) * (i / n);
        const r = Math.max(1, (fh * (o.height ?? 0.3)) * (1 - (i / n) * 0.65));
        blob(img, ox, oy, x, y, 1.6, r, ramp);
        if (o.crest && i % 2 === 0) img.set(ox + x, oy + y - r - 1 - ((i + p.col) % 3 === 0 ? 1 : 0), hex(o.crest));
      }
      blob(img, ox, oy, head - fw * 0.04, cy, fw * 0.07, fh * (o.height ?? 0.3) * 1.05, ramp);
      if (o.beak) {
        line(img, ox, oy, head, cy, fw - 1, cy - 1, ramp.shadow);
        line(img, ox, oy, head, cy + 1, fw - 2, cy + 1, ramp.shadow);
      }
      if (o.fangs) for (let i = 0; i < 3; i++) line(img, ox, oy, head + 1 + i * 1.5, cy, head + 1 + i * 1.5, cy + 2 + (i % 2) * 2, white);
      if (o.pattern === 'photophores') for (let i = 4; i < n; i += 4) img.set(ox + head - fw * 0.06 - i, oy + cy + fh * 0.2, glowC);
      fishEye(img, ox, oy, head - fw * 0.02, cy - fh * 0.12, Math.max(1, fh * 0.12), ink, p.catch);
    },
    shark(img, ox, oy, fw, fh, p, o, ramp) {
      const cx = fw * 0.55;
      const cy = fh * 0.5 + p.dy;
      const rx = fw * 0.38 * p.squash;
      const ry = fh * 0.28;
      const fin = rampOf(mix(ramp.base, hex('#1b1030'), 0.15));
      // Schwanz mit langem oberen Lappen
      poly(img, ox, oy, [[cx - rx * 0.8, cy - 2], [cx - rx - fw * 0.18, cy - fh * 0.38 + p.sway], [cx - rx - fw * 0.06, cy + p.sway * 0.5], [cx - rx - fw * 0.1, cy + fh * 0.18 + p.sway], [cx - rx * 0.8, cy + 2]], fin.base);
      poly(img, ox, oy, [[cx - rx * 0.2, cy - ry * 0.8], [cx - rx * 0.35, cy - ry - fh * 0.28], [cx + rx * 0.2, cy - ry * 0.8]], fin.base);
      poly(img, ox, oy, [[cx - rx * 0.7, cy - ry * 0.5], [cx - rx * 0.75, cy - ry - fh * 0.08], [cx - rx * 0.5, cy - ry * 0.6]], fin.base);
      blob(img, ox, oy, cx, cy, rx, ry, ramp);
      blob(img, ox, oy, cx + rx * 0.15, cy + ry * 0.45, rx * 0.8, ry * 0.5, rampOf(mix(ramp.base, white, 0.6)), 1, (x, y) => y > cy + ry * 0.1);
      poly(img, ox, oy, [[cx + rx * 0.1, cy + ry * 0.4], [cx - rx * 0.15 + p.flap, cy + ry + fh * 0.16], [cx + rx * 0.3, cy + ry * 0.6]], fin.shadow);
      for (let k = 0; k < (o.gills ?? 3); k++) line(img, ox, oy, cx + rx * 0.35 - k * 2, cy - ry * 0.3, cx + rx * 0.35 - k * 2, cy + ry * 0.3, ramp.shadow);
      if (o.pattern === 'spots') pattern(img, ox, oy, cx, cy, rx, ry, o, ramp, p);
      if (o.gape) {
        const mx = cx + rx * 0.82;
        poly(img, ox, oy, [[mx, cy - ry * 0.45], [cx + rx + 1, cy - ry * 0.55], [cx + rx + 1, cy + ry * 0.5], [mx, cy + ry * 0.4]], hex('#3a2030'));
        line(img, ox, oy, mx, cy - ry * 0.45, cx + rx + 1, cy - ry * 0.55, mix(ramp.light, white, 0.4));
      } else line(img, ox, oy, cx + rx * 0.6, cy + ry * 0.35, cx + rx * 0.9, cy + ry * 0.25, ramp.outline);
      fishEye(img, ox, oy, cx + rx * 0.7, cy - ry * 0.3, Math.max(1, fh * 0.07), ink, p.catch);
    },
    flat(img, ox, oy, fw, fh, p, o, ramp) {
      const cx = fw * 0.52;
      const cy = fh * 0.52 + p.dy;
      const rx = fw * 0.34 * p.squash;
      const ry = fh * 0.34;
      // Flossensaum rundherum, wellt sich
      for (let a = 0; a < 48; a++) {
        const t = (a / 48) * Math.PI * 2;
        const w = 1.6 + Math.sin(t * 6 + p.col) * 0.8;
        blob(img, ox, oy, cx + Math.cos(t) * rx, cy + Math.sin(t) * ry, w, w, rampOf(mix(ramp.base, white, 0.2)));
      }
      poly(img, ox, oy, [[cx - rx, cy - 2], [cx - rx - fw * 0.1, cy - fh * 0.2 + p.sway], [cx - rx - fw * 0.1, cy + fh * 0.2 + p.sway], [cx - rx, cy + 2]], ramp.shadow);
      blob(img, ox, oy, cx, cy, rx * 0.92, ry * 0.88, ramp);
      pattern(img, ox, oy, cx, cy, rx * 0.8, ry * 0.8, o, ramp, p);
      fishEye(img, ox, oy, cx + rx * 0.55, cy - ry * 0.35, Math.max(1, fh * 0.1), ink, p.catch);
      fishEye(img, ox, oy, cx + rx * 0.7, cy - ry * 0.05, Math.max(1, fh * 0.1), ink, p.catch);
      line(img, ox, oy, cx + rx * 0.82, cy + ry * 0.3, cx + rx * 0.95, cy + ry * 0.2, ramp.outline);
    },
    angler(img, ox, oy, fw, fh, p, o, ramp) {
      const cx = fw * 0.5;
      const cy = fh * 0.55 + p.dy;
      const rx = fw * 0.36 * p.squash;
      const ry = fh * (o.height ?? 0.36);
      poly(img, ox, oy, [[cx - rx * 0.8, cy - 1], [cx - rx - fw * 0.14, cy - fh * 0.2 + p.sway], [cx - rx - fw * 0.14, cy + fh * 0.2 + p.sway], [cx - rx * 0.8, cy + 2]], ramp.shadow);
      blob(img, ox, oy, cx, cy, rx, ry, ramp);
      if (o.fringe) for (let x = -rx; x < rx; x += 2) img.set(ox + cx + x, oy + cy + ry + ((x + p.col) % 4 === 0 ? 1 : 0), ramp.shadow);
      // Riesiges Maul mit Zähnen
      const mx = cx + rx * 0.95;
      poly(img, ox, oy, [[cx + rx * 0.2, cy + ry * 0.15], [mx + 1, cy - ry * 0.25], [mx + 1, cy + ry * (p.catch ? 0.55 : 0.35)]], hex('#3a2030'));
      for (let x = cx + rx * 0.3; x < mx; x += 2) {
        img.set(ox + x, oy + cy + ry * 0.05 - (x - cx) * 0.25, white);
        img.set(ox + x, oy + cy + ry * 0.3, white);
      }
      // Köder an der Angel
      const ax = cx + rx * 0.4;
      const ay = cy - ry;
      const tx = Math.min(fw - 3, ax + fw * 0.25);
      const ty = Math.max(2, ay - fh * 0.25 + p.flap);
      line(img, ox, oy, ax, ay, tx, ty, ramp.outline);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) img.set(ox + tx + dx, oy + ty + dy, o.lureGlow === false ? hex('#d9c27a') : glowC);
      fishEye(img, ox, oy, cx + rx * 0.35, cy - ry * 0.45, Math.max(1, fh * 0.08), ink, p.catch);
    },
    gulper(img, ox, oy, fw, fh, p, o, ramp) {
      const cy = fh * 0.4 + p.dy;
      for (let i = 0; i < fw * 0.6; i++) img.set(ox + fw * 0.45 - i, oy + cy + Math.sin(i * 0.4 + p.col) * 1.5 * (i / (fw * 0.6)), i % 2 ? ramp.base : ramp.shadow);
      img.set(ox + 1, oy + cy + Math.sin(fw * 0.6 * 0.4 + p.col) * 1.5, hex('#ff4fd8'));
      poly(img, ox, oy, [[fw * 0.42, cy - 2], [fw - 2, cy - fh * 0.32], [fw - 1, cy + fh * (p.catch ? 0.5 : 0.4)], [fw * 0.42, cy + 2]], (x, y) => (y > cy + 1 ? hex('#3a2030') : ramp.base));
      line(img, ox, oy, fw * 0.42, cy - 2, fw - 2, cy - fh * 0.32, ramp.light);
      fishEye(img, ox, oy, fw * 0.55, cy - 2, 1, ink, p.catch);
    },
    tadpole(img, ox, oy, fw, fh, p, o, ramp) {
      const cx = fw * 0.62;
      const cy = fh / 2 + p.dy;
      for (let i = 0; i < fw * 0.55; i++) {
        const r = Math.max(1, fh * 0.32 * (1 - i / (fw * 0.6)));
        blob(img, ox, oy, cx - i * p.squash, cy + Math.sin(i * 0.4 + p.col) * (i / fw) * 3, 1.2, r, ramp, 0.9);
      }
      blob(img, ox, oy, cx, cy, fw * 0.2, fh * 0.36, ramp, 0.95);
      blob(img, ox, oy, cx - 1, cy + 2, fw * 0.12, fh * 0.15, rampOf(hex('#ff9ab0')), 0.5);
      fishEye(img, ox, oy, cx + fw * 0.1, cy - fh * 0.1, Math.max(1, fh * 0.12), ink, p.catch);
    },
    round(img, ox, oy, fw, fh, p, o, ramp) {
      const cx = fw * 0.52;
      const cy = fh * 0.52 + p.dy;
      poly(img, ox, oy, [[cx - fw * 0.3, cy - 1], [cx - fw * 0.46, cy - 4 + p.sway], [cx - fw * 0.46, cy + 4 + p.sway], [cx - fw * 0.3, cy + 1]], ramp.shadow);
      blob(img, ox, oy, cx, cy, fw * 0.36 * p.squash, fh * 0.4, ramp);
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 1.6 - Math.PI * 0.9;
        img.set(ox + cx + Math.cos(a) * fw * 0.3, oy + cy + Math.sin(a) * fh * 0.34, ramp.light);
        img.set(ox + cx + Math.cos(a) * fw * 0.3, oy + cy + Math.sin(a) * fh * 0.34 + 1, ramp.shadow);
      }
      blob(img, ox, oy, cx, cy + fh * 0.3, fw * 0.12, fh * 0.07, rampOf(hex('#e0a0a0')));
      fishEye(img, ox, oy, cx + fw * 0.18, cy - fh * 0.08, Math.max(1.5, fh * 0.1), ink, p.catch);
      line(img, ox, oy, cx + fw * 0.3, cy + 2, cx + fw * 0.34, cy + 2, ramp.outline);
    },
    stilts(img, ox, oy, fw, fh, p, o, ramp) {
      const cy = fh * 0.32 + p.dy * 0.5;
      fish(img, ox, oy, fw, fh * 0.65, p, { ...o, height: 0.32, dorsal: 0.12, anal: false }, ramp);
      for (const sx of [0.22, 0.5, 0.74]) line(img, ox, oy, fw * sx, cy + fh * 0.18, fw * sx + (sx - 0.5) * 3, fh - 1, ramp.shadow);
    },
    jelly(img, ox, oy, fw, fh, p, o, ramp) {
      const top = fh * (o.float ? 0.3 : 0.32) + (p.col % 2) + p.dy;
      const tent = o.tentacle ? hex(o.tentacle) : mix(ramp.base, white, 0.3);
      for (let k = 0; k < 5; k++)
        for (let y = top + fh * 0.1; y < fh - 1; y++) img.blend(ox + fw * 0.2 + k * fw * 0.15 + Math.sin(y * 0.6 + p.col + k) * 1.2, oy + y, k % 2 ? tent : ramp.shadow, 0.9);
      if (o.float) {
        blob(img, ox, oy, fw / 2, top, fw * 0.44 * p.squash, fh * 0.22, ramp, 0.9);
        for (let x = fw * 0.2; x < fw * 0.75; x++) img.set(ox + x, oy + top - fh * 0.22 - Math.sin((x / fw) * Math.PI) * 2 + 1, hex('#ff7ac8'));
      } else {
        blob(img, ox, oy, fw / 2, top, fw * 0.44 * p.squash, fh * 0.26, ramp, 0.88);
        for (let x = fw * 0.12; x < fw * 0.88; x += 2) img.set(ox + x, oy + top + fh * 0.04, ramp.light);
        if (o.rings) for (const dx of [-0.16, -0.05, 0.06, 0.17]) blob(img, ox, oy, fw / 2 + dx * fw, top - 1, 1.4, 1.4, rampOf(hex('#ff9ad8')), 0.8);
      }
      fishEye(img, ox, oy, fw * 0.62, top - 1, 1, ink, p.catch);
    },
    squid(img, ox, oy, fw, fh, p, o, ramp) {
      const cy = fh / 2 + p.dy;
      blob(img, ox, oy, fw * 0.3, cy, fw * 0.24 * p.squash, fh * 0.28, ramp);
      poly(img, ox, oy, [[fw * 0.1, cy], [2, cy - fh * 0.3], [2, cy + fh * 0.3]], ramp.shadow);
      for (let k = 0; k < 5; k++) for (let x = 0; x < fw * 0.44; x++) img.set(ox + fw * 0.52 + x, oy + cy - 3 + k * 1.6 + Math.sin(x * 0.4 + p.col + k) * (x / 10), k % 2 ? ramp.shadow : ramp.base);
      line(img, ox, oy, fw * 0.5, cy - 1, fw - 1, cy - 4 - p.flap, ramp.light);
      line(img, ox, oy, fw * 0.5, cy + 1, fw - 1, cy + 4 + p.flap, ramp.light);
      fishEye(img, ox, oy, fw * 0.5, cy - 1, Math.max(2, fh * 0.14), ink, p.catch);
    },
    vampire(img, ox, oy, fw, fh, p, o, ramp) {
      const cy = fh * 0.42 + p.dy;
      for (let y = fh * 0.5; y < fh - 1; y++) for (let x = fw * 0.12; x < fw * 0.88; x++) if (Math.abs(x - fw / 2) < (fh - y) * (0.9 + p.flap * 0.15) + 2) img.set(ox + x, oy + y, ramp.shadow);
      for (let k = 0; k < 6; k++) img.set(ox + fw * 0.18 + k * fw * 0.13, oy + fh - 2, white);
      blob(img, ox, oy, fw / 2, cy, fw * 0.3 * p.squash, fh * 0.32, ramp);
      for (const s of [-1, 1]) blob(img, ox, oy, fw / 2 + s * fw * 0.3, fh * 0.2, 2, 3, ramp);
      fishEye(img, ox, oy, fw * 0.6, cy, Math.max(2, fh * 0.1), hex('#5cf2ff'), p.catch);
    },
    shrimp(img, ox, oy, fw, fh, p, o, ramp) {
      const cy = fh * 0.45 + p.dy;
      const segs = 5;
      for (let k = 0; k < segs; k++) {
        const x = fw * 0.2 + k * (fw * 0.13) * p.squash;
        blob(img, ox, oy, x, cy + Math.sin(k * 0.5) * (k < 2 ? 1 : 0), fw * 0.09, fh * 0.28 * (0.75 + k * 0.06), ramp, o.clear ? 0.85 : 1);
      }
      poly(img, ox, oy, [[fw * 0.12, cy], [2, cy - fh * 0.25 + p.sway], [2, cy + fh * 0.25 + p.sway]], ramp.shadow);
      for (let k = 0; k < 5; k++) line(img, ox, oy, fw * 0.25 + k * 2.4, cy + fh * 0.22, fw * 0.23 + k * 2.4 + ((p.col + k) % 2), cy + fh * 0.42, ramp.shadow);
      line(img, ox, oy, fw * 0.8, cy - 2, fw - 1, cy - fh * 0.4 - p.flap, ramp.outline);
      line(img, ox, oy, fw * 0.8, cy - 1, fw - 1, cy - fh * 0.2 + p.flap, ramp.outline);
      if (o.claws) {
        line(img, ox, oy, fw * 0.72, cy + 2, fw - 2, cy + 1, ramp.base);
        blob(img, ox, oy, fw - 3, cy + 1, 2, 1.5, ramp);
      }
      fishEye(img, ox, oy, fw * 0.76, cy - 2, 1, ink, p.catch);
    },
    crab(img, ox, oy, fw, fh, p, o, ramp) {
      const cy = fh * 0.55 + p.dy;
      for (let k = 0; k < 4; k++)
        for (const s of [-1, 1]) line(img, ox, oy, fw / 2 + s * fw * 0.25, cy + 1 + k, fw / 2 + s * (fw * 0.42 + ((p.col + k) % 2)), cy + 3 + k * 1.4, ramp.shadow);
      blob(img, ox, oy, fw / 2, cy, fw * 0.36 * p.squash, fh * 0.28, ramp);
      for (let x = -fw * 0.32; x < fw * 0.32; x += 2) img.set(ox + fw / 2 + x, oy + cy - fh * 0.24 + Math.abs(x) * 0.1, ramp.light);
      for (const s of [-1, 1]) {
        const clawY = fh * 0.24 - (p.catch ? 2 : 0) - (p.col % 2);
        line(img, ox, oy, fw / 2 + s * fw * 0.22, cy - 2, fw / 2 + s * fw * 0.36, clawY + 2, ramp.base);
        blob(img, ox, oy, fw / 2 + s * fw * 0.38, clawY, 2.6, 2, ramp);
        rect(img, ox, oy, fw / 2 + s * fw * 0.38 - 1, clawY - 2, 2, 1, ink);
      }
      fishEye(img, ox, oy, fw / 2 - 2, cy - fh * 0.24, 1, ink, p.catch);
      fishEye(img, ox, oy, fw / 2 + 3, cy - fh * 0.24, 1, ink, p.catch);
    },
    star(img, ox, oy, fw, fh, p, o, ramp) {
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + p.col * 0.12 - Math.PI / 2;
        for (let r = 0; r < fw * 0.46; r++) {
          const w = Math.max(0, 2.4 - r * 0.28);
          for (let d = -w; d <= w; d++) img.set(ox + fw / 2 + Math.cos(a) * r - Math.sin(a) * d, oy + fh / 2 + Math.sin(a) * r + Math.cos(a) * d + p.dy, r % 3 === 0 ? ramp.light : d > 0 ? ramp.shadow : ramp.base);
        }
      }
      blob(img, ox, oy, fw / 2, fh / 2 + p.dy, 3, 3, ramp);
      fishEye(img, ox, oy, fw / 2 + 1, fh / 2 - 1 + p.dy, 1, ink, p.catch);
    },
    pig(img, ox, oy, fw, fh, p, o, ramp) {
      const cy = fh * 0.48 + p.dy;
      blob(img, ox, oy, fw / 2, cy, fw * 0.42 * p.squash, fh * 0.3, ramp, 0.92);
      for (let k = 0; k < 5; k++) line(img, ox, oy, fw * 0.2 + k * fw * 0.14, cy + fh * 0.22, fw * 0.2 + k * fw * 0.14 + ((k + p.col) % 2), cy + fh * 0.36, ramp.shadow);
      for (let k = 0; k < 3; k++) line(img, ox, oy, fw * 0.35 + k * 3, cy - fh * 0.24, fw * 0.33 + k * 3 + (p.flap ? 1 : 0), cy - fh * 0.42, ramp.light);
      fishEye(img, ox, oy, fw * 0.76, cy - 1, 1, ink, p.catch);
    },
    dumbo(img, ox, oy, fw, fh, p, o, ramp) {
      const cy = fh * 0.4 + p.dy;
      for (let k = 0; k < 4; k++) for (let y = cy + fh * 0.15; y < fh - 1; y++) img.set(ox + fw * 0.3 + k * fw * 0.13 + Math.sin(y * 0.5 + k + p.col) * 1, oy + y, ramp.shadow);
      blob(img, ox, oy, fw / 2, cy, fw * 0.3 * p.squash, fh * 0.3, ramp);
      for (const s of [-1, 1]) blob(img, ox, oy, fw / 2 + s * fw * 0.32, cy - fh * 0.12 + (p.flap ? -1 : 1) * s, 2.8, 3.6, ramp);
      fishEye(img, ox, oy, fw * 0.6, cy, Math.max(1.5, fh * 0.1), ink, p.catch);
    },
    barreleye(img, ox, oy, fw, fh, p, o, ramp) {
      const r = fish(img, ox, oy, fw, fh, p, { ...o, eye: 0.001 }, ramp);
      const ex = Math.round(ox + r.cx + r.rx * 0.5);
      const ey = Math.round(oy + r.cy - r.ry * 0.6);
      for (let x = -3; x <= 3; x++) for (let y = -4; y <= 0; y++) if (x * x + y * y * 0.6 < 10) img.blend(ex + x, ey + y, hex('#e8fff8'), 0.55);
      eye(img, 0, 0, ex - 1, ey - 2, 1, hex('#8cff5a'), 1, 1);
    },
  };

  /** Merkmale je Art (Form, Farben, Muster). Unbekannte Arten bekommen die Grundform. */
  const looks = {
    herring: { back: '#3f6f9a', belly: '#eef4f8', len: 0.38, height: 0.3 },
    mackerel: { back: '#2f8f7a', pattern: 'waves', len: 0.38, height: 0.3, fork: 0.36 },
    tuna: { back: '#1f3f7a', belly: '#dfe8f0', height: 0.4, pattern: 'finlets', fork: 0.45, lunate: true, fin: '#ffd23f' },
    flying_fish: { back: '#2f5f9a', wings: true, len: 0.36, height: 0.26 },
    sunfish: { kind: 'sunfish' },
    man_o_war: { kind: 'jelly', float: true, tentacle: '#5cf2ff' },
    hatchetfish: { kind: 'hatchet' },
    lanternfish: { pattern: 'photophores', eye: 0.2 },
    giant_squid: { kind: 'squid' },
    viperfish: { kind: 'eel', fangs: true, pattern: 'photophores', height: 0.26 },
    fangtooth: { height: 0.46, fangs: true, eye: 0.11, cx: 0.52 },
    barreleye: { kind: 'barreleye' },
    vampire_squid: { kind: 'vampire' },
    gulper: { kind: 'gulper' },
    black_swallower: { bigBelly: '#5a4a6a', height: 0.3 },
    anglerfish: { kind: 'angler', height: 0.4 },
    tripod_fish: { kind: 'stilts' },
    sea_pig: { kind: 'pig' },
    dumbo: { kind: 'dumbo' },
    snailfish: { kind: 'tadpole' },
    amphipod: { kind: 'shrimp', clear: true },
    oarfish: { kind: 'eel', crest: '#e0403a', height: 0.3 },
    brown_shrimp: { kind: 'shrimp' },
    moon_jelly: { kind: 'jelly', rings: true },
    plaice: { kind: 'flat', pattern: 'spots', spot: '#ff8a3d' },
    weever: { dorsalColor: '#1b1030', pattern: 'line', eyeY: 0.45, len: 0.38, height: 0.3 },
    garfish: { kind: 'eel', beak: true, height: 0.28 },
    starfish: { kind: 'star' },
    gurnard: { wings: true, height: 0.4, eye: 0.15, back: '#c0605a' },
    edible_crab: { kind: 'crab' },
    lumpsucker: { kind: 'round' },
    catshark: { kind: 'shark', pattern: 'spots', spot: '#5a4030' },
    cod: { pattern: 'mottled', barbel: true, height: 0.36 },
    turbot: { kind: 'flat', pattern: 'mottled' },
    monkfish: { kind: 'angler', height: 0.32, fringe: true, lureGlow: false },
    langoustine: { kind: 'shrimp', claws: true },
    basking_shark: { kind: 'shark', gape: true, gills: 5 },
  };

  function drawSpecies(def) {
    const fw = def.frame.width;
    const fh = def.frame.height;
    const ramp = rampOf(hex(def.placeholderColor));
    const look = looks[def.id] ?? {};
    const img = new Image(fw * 4, fh * 4);
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 4; col++) {
        // Jeder Frame auf eigener Fläche, damit nichts in den Nachbar-Frame ragt
        const frame = new Image(fw, fh);
        const p = poseOf(row, col);
        const draw = special[look.kind];
        if (draw) draw(frame, 0, 0, fw, fh, p, look, ramp);
        else fish(frame, 0, 0, fw, fh, p, look, ramp);
        outlineRegion(frame, 0, 0, fw, fh, ramp.outline);
        if (def.glow && !['lanternfish', 'viperfish', 'hatchetfish', 'anglerfish'].includes(def.id))
          for (let k = 0; k < 3; k++) frame.set(fw * 0.35 + k * 3, fh * 0.72, glowC);
        for (let y = 0; y < fh; y++)
          for (let x = 0; x < fw; x++) {
            const a = frame.alphaAt(x, y);
            if (a <= 0) continue;
            const k = (y * fw + x) * 4;
            img.set(col * fw + x, row * fh + y, [frame.px[k], frame.px[k + 1], frame.px[k + 2]], a);
          }
      }
    return img;
  }

  return { drawSpecies, looks };
}
