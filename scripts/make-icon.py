"""App-Icon aus Berts Schreck-Porträt bauen (Pixelraster passend zur Spielgrafik).

Aufruf: python3 scripts/make-icon.py
Schreibt assets/icons/: app-512.png, app-192.png, apple-180.png, maskable-512.png, favicon-32.png
"""
import math
from PIL import Image

OUT = 'assets/icons/'
FACE = 'assets/sprites/portrait_bert_shock.png'
BANDS = [(0.0, (110, 230, 236)), (0.30, (54, 186, 214)), (0.52, (26, 128, 180)), (0.74, (16, 78, 132)), (1.0, (11, 48, 90))]


def canvas(g: int, off: tuple[int, int]) -> Image.Image:
    im = Image.new('RGBA', (g, g))
    px = im.load()
    cx, cy = g / 2, g * 0.44
    for y in range(g):
        for x in range(g):
            # Lichtkreis hinter dem Kopf, an den Bandgrenzen geditherte Pixel
            d = math.hypot(x - cx, y - cy) / (g * 0.7) + ([[0, 2], [3, 1]][y % 2][x % 2] / 4 - 0.375) * 0.06
            px[x, y] = next((c for t, c in BANDS if d <= t), BANDS[-1][1]) + (255,)
    s = g / 86
    for bx, by, r in [(8, 62, 2), (12, 54, 1), (76, 20, 2), (72, 12, 1), (6, 30, 1), (80, 66, 1)]:
        bx, by = round(bx * s), round(by * s)
        for y in range(by - r - 1, by + r + 2):
            for x in range(bx - r - 1, bx + r + 2):
                if 0 <= x < g and 0 <= y < g and r - 0.5 <= math.hypot(x - bx, y - by) <= r + 0.5:
                    px[x, y] = (200, 245, 250, 255)
    im.alpha_composite(Image.open(FACE).convert('RGBA'), off)
    return im


def upscale(small: Image.Image, size: int) -> Image.Image:
    # erst ganzzahlig hoch (scharfe Pixel), dann auf Zielgröße
    k = max(1, round(size / small.width))
    big = small.resize((small.width * k, small.height * k), Image.NEAREST)
    return big.resize((size, size), Image.LANCZOS) if big.width != size else big


icon = canvas(86, (-5, 6))
big = icon.resize((516, 516), Image.NEAREST).crop((2, 2, 514, 514)).convert('RGB')
big.save(OUT + 'app-512.png')
big.resize((192, 192), Image.LANCZOS).save(OUT + 'app-192.png')
big.resize((180, 180), Image.LANCZOS).save(OUT + 'apple-180.png')
big.resize((32, 32), Image.LANCZOS).save(OUT + 'favicon-32.png')
# Maskable: Android schneidet bis zu 20 % Rand weg, also mehr Hintergrund um den Kopf
mask = canvas(108, (6, 14))
upscale(mask, 512).convert('RGB').save(OUT + 'maskable-512.png')
