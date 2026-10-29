import { el } from './dom';
import { setRichText } from './rich';

export type ReactionBackground = 'waves' | 'burst' | 'sparkle';
export type ReactionMood = 'shock' | 'joy' | 'smug';

export interface Reaction {
  background: ReactionBackground;
  mood: ReactionMood;
}

/** Kleine Leinwand, wird groß und scharf (pixelig) hochskaliert: Hintergrund im Pixel-Stil. */
const W = 160;
const H = 90;

function drawBackground(kind: ReactionBackground): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  if (kind === 'waves') {
    // Brandungswellen im Holzschnitt-Stil: Locken aus Kreisbögen in Blau und Weiß.
    g.fillStyle = '#0d2233';
    g.fillRect(0, 0, W, H);
    const blues = ['#1f5a80', '#2f7fa8', '#9fc6dc', '#e6f1f6'];
    for (let row = 0; row < 5; row++) {
      for (let i = 0; i < 9; i++) {
        const cx = i * 20 + (row % 2) * 10;
        const cy = H - row * 16 + 4;
        for (let k = 0; k < blues.length; k++) {
          g.strokeStyle = blues[k]!;
          g.lineWidth = 3;
          g.beginPath();
          g.arc(cx, cy, 14 - k * 3, Math.PI, Math.PI * 1.9);
          g.stroke();
        }
      }
    }
    g.fillStyle = '#e6f1f6';
    for (let i = 0; i < 26; i++) g.fillRect((i * 37) % W, (i * 23) % (H - 40), 2, 2);
  } else if (kind === 'burst') {
    // Strahlenkranz wie im Manga: abwechselnde Keile aus der Mitte.
    const cx = W / 2;
    const cy = H * 0.6;
    for (let i = 0; i < 24; i++) {
      const a0 = (i / 24) * Math.PI * 2;
      const a1 = ((i + 1) / 24) * Math.PI * 2;
      g.fillStyle = i % 2 ? '#ff9f43' : '#ffd23f';
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a0) * 200, cy + Math.sin(a0) * 200);
      g.lineTo(cx + Math.cos(a1) * 200, cy + Math.sin(a1) * 200);
      g.closePath();
      g.fill();
    }
  } else {
    // Glitzer: weicher Verlauf mit Sternchen.
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#ff8fb8');
    grad.addColorStop(1, '#7c5cff');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff6e0';
    for (let i = 0; i < 30; i++) {
      const x = (i * 53) % W;
      const y = (i * 29) % H;
      g.fillRect(x, y - 2, 1, 5);
      g.fillRect(x - 2, y, 5, 1);
    }
  }
  return c;
}

/**
 * Reaktions-Szene (wie die Zwischenschnitte bei Dave the Diver): Kinobalken, dramatischer Hintergrund,
 * Figur ploppt groß rein und reagiert. Antippen überspringt. Ruft `done` am Ende auf.
 */
export function playReaction(root: HTMLElement, portrait: string, reaction: Reaction, caption: string, done: () => void): void {
  const node = el('div', `reaction mood-${reaction.mood}`);
  const bg = drawBackground(reaction.background);
  bg.className = 'reaction-bg';
  const img = el('img', 'reaction-portrait');
  img.src = portrait;
  img.alt = '';
  const text = el('div', 'reaction-caption');
  setRichText(text, caption);
  const top = el('div', 'bar top');
  const bottom = el('div', 'bar bottom');
  node.append(bg, img, text, top, bottom);
  root.append(node);
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    node.classList.add('out');
    window.setTimeout(() => {
      node.remove();
      done();
    }, 220);
  };
  node.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    finish();
  });
  window.setTimeout(finish, 1900);
  navigator.vibrate?.(reaction.mood === 'shock' ? [20, 30, 20] : 15);
}
