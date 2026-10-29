import Phaser from 'phaser';
import { layoutTiles } from '../systems/parallax';
import type { BackgroundLayerDef } from '../data';

const DEPTH_BASE = -100;

/**
 * Hintergrund aus 1920×1080-Ebenen. Ebene mit `fixed` deckt den Bildschirm ab,
 * die anderen werden gekachelt und mit eigenem Faktor gegen die Kamera verschoben.
 */
export class Parallax {
  private readonly fixed: Phaser.GameObjects.Image[] = [];
  private readonly tiled: { def: BackgroundLayerDef; pool: Phaser.GameObjects.Image[]; depth: number }[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    layers: BackgroundLayerDef[],
    /** Welthöhe, nötig für Ebenen mit `anchorBottom`. */
    private readonly worldHeight = 0,
  ) {
    layers.forEach((def, i) => {
      const depth = DEPTH_BASE + i * 2;
      if (def.fixed) {
        const img = scene.add.image(0, 0, def.key).setScrollFactor(0).setDepth(depth);
        this.fixed.push(img);
      } else {
        this.tiled.push({ def, pool: [], depth });
      }
    });
  }

  /** Tiefe direkt über einer Ebene, z. B. für den Tiefen-Dunst. */
  static depthAbove(layerIndex: number): number {
    return DEPTH_BASE + layerIndex * 2 + 1;
  }

  setFixedTint(color: number): void {
    for (const img of this.fixed) img.setTint(color);
  }

  update(camera: Phaser.Cameras.Scene2D.Camera): void {
    const w = camera.width;
    const h = camera.height;

    for (const img of this.fixed) {
      // Bild zentrieren, nur vergrößern, wenn der Bildschirm größer ist als die Vorlage.
      const scale = Math.max(1, w / img.width, h / img.height);
      img.setScale(scale).setPosition(Math.round(w / 2), Math.round(h / 2));
    }

    for (const layer of this.tiled) {
      const tex = this.scene.textures.get(layer.def.key).getSourceImage();
      const tw = tex.width;
      const th = tex.height;
      const l = layoutTiles(camera.scrollX, camera.scrollY, layer.def.factorX, layer.def.factorY, tw, th, w, h);
      if (layer.def.anchorBottom) {
        // Unterkante liegt auf dem Bildschirmboden, wenn die Kamera ganz unten ist.
        const anchorY = h - th + (this.worldHeight - h) * layer.def.factorY;
        l.offsetY = anchorY - camera.scrollY * layer.def.factorY;
        l.rows = 1;
      }
      const needed = l.cols * l.rows;
      while (layer.pool.length < needed) {
        layer.pool.push(
          this.scene.add.image(0, 0, layer.def.key).setOrigin(0, 0).setScrollFactor(0).setDepth(layer.depth),
        );
      }
      layer.pool.forEach((img, i) => {
        if (i >= needed) {
          img.setVisible(false);
          return;
        }
        const col = i % l.cols;
        const row = Math.floor(i / l.cols);
        img.setVisible(true).setPosition(Math.round(l.offsetX + col * tw), Math.round(l.offsetY + row * th));
      });
    }
  }
}
