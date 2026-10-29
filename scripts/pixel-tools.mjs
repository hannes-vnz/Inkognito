/**
 * Gemeinsame Pixel-Werkzeuge für die Platzhalter-Grafik (Figuren, Fische):
 * Schattierung mit Licht von oben links, Formen, Linien, Augen mit Glanzpunkt.
 */
export function makeTools({ hex, mix, white }) {
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

  function poly(img, ox, oy, pts, color, alpha = 1) {
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
        if (!inside) continue;
        const c = typeof color === 'function' ? color(x, y) : color;
        if (alpha < 1) img.blend(ox + x, oy + y, c, alpha);
        else img.set(ox + x, oy + y, c);
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

  return { ink, DARK, tone, blob, poly, line, rect, eye, blush };
}
