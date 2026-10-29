/**
 * Rechnet für eine wiederholte Parallax-Ebene aus, wo die erste Kachel liegen muss
 * und wie viele Kacheln den Bildschirm füllen.
 */
export interface TileLayout {
  offsetX: number;
  offsetY: number;
  cols: number;
  rows: number;
}

const wrap = (value: number, size: number): number => ((value % size) + size) % size;

export function layoutTiles(
  scrollX: number,
  scrollY: number,
  factorX: number,
  factorY: number,
  tileWidth: number,
  tileHeight: number,
  viewWidth: number,
  viewHeight: number,
): TileLayout {
  const offsetX = -wrap(scrollX * factorX, tileWidth);
  const offsetY = -wrap(scrollY * factorY, tileHeight);
  return {
    offsetX,
    offsetY,
    cols: Math.ceil((viewWidth - offsetX) / tileWidth),
    rows: Math.ceil((viewHeight - offsetY) / tileHeight),
  };
}
