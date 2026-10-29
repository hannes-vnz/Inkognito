import type Phaser from 'phaser';
import { anims, cutscenes, speciesById } from '../data';
import { t } from '../i18n';
import { playCutscene, type CutsceneArt, type Shot, type ShotBackground } from '../ui/Cutscene';

/** Bilder für Zwischensequenzen aus den geladenen Texturen. */
export function cutsceneArt(scene: Phaser.Scene): CutsceneArt {
  const base64 = (key: string, frame?: number): string | undefined => {
    try {
      return scene.textures.exists(key) ? scene.textures.getBase64(key, frame) : undefined;
    } catch {
      return undefined;
    }
  };
  return {
    portrait: (who, face) => base64(face === 'normal' ? `portrait_${who}` : `portrait_${who}_${face}`) ?? base64(`portrait_${who}`),
    speciesImage: (id) => {
      const def = speciesById.get(id);
      return def ? base64(def.sprite, 0) : undefined;
    },
    text: (key) => t(key),
    anim: (key) => anims[key],
    texture: (key) => base64(key),
  };
}

/** Szene aus data/cutscenes.json abspielen; {platzhalter} in Bild und Text werden ersetzt. */
export function playScene(scene: Phaser.Scene, root: HTMLElement, id: string, vars: Record<string, string>, done: () => void): void {
  const fill = (s: string | undefined) => s?.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
  const shots = (cutscenes[id] ?? []).map((s) => ({
    ...s,
    species: fill(s.species),
    caption: s.caption ? fill(s.caption) : s.captionKey ? t(s.captionKey, vars) : undefined,
    captionKey: undefined,
  }));
  playCutscene(root, shots, cutsceneArt(scene), done);
}

const MOOD_FACE = { shock: 'shock', joy: 'happy', smug: 'annoyed' } as const;
const MOOD_FX = { shock: ['sweat'], joy: ['sparkle'], smug: ['question'] } as const;

/** Einzelne Reaktions-Einstellung (für Story-Momente und Quiz). */
export function playReactionShot(
  scene: Phaser.Scene,
  root: HTMLElement,
  who: string,
  reaction: { background: ShotBackground; mood: 'shock' | 'joy' | 'smug' },
  caption: string,
  done: () => void,
): void {
  const shot: Shot = {
    bg: reaction.background,
    ms: 1700,
    cam: reaction.mood === 'shock' ? 'shake' : 'pushIn',
    flash: true,
    figures: [{ who, face: MOOD_FACE[reaction.mood] }],
    fx: [...MOOD_FX[reaction.mood]],
    caption,
  };
  playCutscene(root, [shot], cutsceneArt(scene), done);
}
