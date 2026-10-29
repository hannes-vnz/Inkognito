import Phaser from 'phaser';
import { harbor, homeSpot, npcById, npcs, quiz, species, speciesById, spots, story, upgradeById } from '../data';
import { reachableMeters } from '../systems/seaMap';
import { play } from '../audio/sfx';
import { animKey } from '../entities/Octopus';
import { dialogNode, type NpcDef } from '../systems/dialog';
import { markSeen, nextBeat, npcMet } from '../systems/story';
import { fulfillRequest, newRequest } from '../systems/requests';
import { answerQuiz, pickQuiz, quizReady } from '../systems/quiz';
import { upgradeValue } from '../systems/economy';
import type { Save } from '../systems/save';
import { t } from '../i18n';
import type { Sheet } from '../ui/Sheet';
import { playReaction } from '../ui/ReactionShot';

export interface HarborHost {
  readonly save: Save;
  setSave(save: Save): void;
  /** Darf gerade jemand angesprochen werden (an Deck, nichts offen)? */
  canTalk(): boolean;
  say(text: string): void;
}

const SCALE = 2;

/**
 * Die Figuren am Hafen: Hilde auf dem Steg, Bruno am Fischstand, Professorin Qualle im Wasser.
 * Antippen öffnet ihren Dialog, Story-Momente spielen nach jeder Rückkehr an Deck.
 */
export class Harbor {
  private readonly sprites = new Map<string, Phaser.GameObjects.Sprite>();
  private readonly markers = new Map<string, Phaser.GameObjects.Text>();
  private lastRequest: string | undefined;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly uiRoot: HTMLElement,
    private readonly sheet: Sheet,
    private readonly host: HarborHost,
  ) {}

  build(width: number, height: number, surface: number): void {
    // Quer liegen rechts oben Münzen und Konto, unten rechts das Deck: Stand und Qualle rücken nach links.
    const wide = width > height;
    const g = this.scene.add.graphics().setDepth(2);
    // Steg links
    g.fillStyle(0x6b4a2b, 1);
    g.fillRect(0, surface - 6, 86, 8);
    g.fillStyle(0x4a321d, 1);
    for (const x of [8, 44, 78]) g.fillRect(x, surface, 6, 40);
    // Fischstand rechts: Markise und Theke
    const sx = wide ? width - 150 : width - 46;
    g.fillStyle(0x8a5a2b, 1);
    g.fillRect(sx - 34, surface - 26, 68, 22);
    for (let i = 0; i < 6; i++) {
      g.fillStyle(i % 2 ? 0xf4f1e8 : 0xc23b3b, 1);
      g.fillRect(sx - 36 + i * 12, surface - 92, 12, 14);
    }
    g.fillStyle(0x4a321d, 1);
    for (const x of [sx - 34, sx + 30]) g.fillRect(x, surface - 80, 4, 76);

    const spots: Record<NpcDef['place'], { x: number; y: number }> = {
      pier: { x: 40, y: surface - 6 },
      stall: { x: sx, y: surface - 18 },
      water: wide ? { x: width * 0.3, y: surface + 80 } : { x: width / 2 + 80, y: surface + 96 },
    };
    for (const n of npcs) {
      const p = spots[n.place];
      const s = this.scene.add.sprite(p.x, p.y, n.sprite, 0).setOrigin(0.5, 1).setScale(SCALE).setDepth(n.place === 'stall' ? 1 : 3);
      s.play(animKey(n.sprite, 'idle'));
      s.setInteractive({ useHandCursor: true });
      s.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.host.canTalk() && this.talk(n, 'start'));
      if (n.place === 'water') this.scene.tweens.add({ targets: s, y: '-=10', duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      const m = this.scene.add
        .text(p.x, p.y - n.frame.height * SCALE - 6, '', { fontFamily: '"Baloo 2", sans-serif', fontSize: '26px', color: '#ffd23f', stroke: '#1b1030', strokeThickness: 6 })
        .setOrigin(0.5, 1)
        .setDepth(11);
      this.scene.tweens.add({ targets: m, y: '-=6', duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.sprites.set(n.id, s);
      this.markers.set(n.id, m);
    }
    this.refresh();
  }

  /** Sichtbarkeit und Hinweisblasen: „!“ wenn Bruno einen neuen Wunsch hat, „?“ wenn ein Quiz wartet. */
  refresh(): void {
    const save = this.host.save;
    for (const n of npcs) {
      const met = npcMet(save, story, n.id);
      this.sprites.get(n.id)?.setVisible(met);
      let mark = '';
      if (met && n.id === 'bruno' && save.story.seen.includes(harbor.requestRequires) && save.request === null) mark = '!';
      if (met && n.id === 'qualle' && quizReady(save, quiz, harbor)) mark = '?';
      this.markers.get(n.id)?.setText(mark).setVisible(mark !== '');
    }
  }

  /** Höchstens ein fälliger Story-Moment, danach `done`. */
  playNext(done: () => void): void {
    const beat = nextBeat(this.host.save, story);
    if (!beat) {
      done();
      return;
    }
    this.host.setSave(markSeen(this.host.save, beat.id));
    const npc = npcById.get(beat.npc)!;
    const s = this.sprites.get(npc.id);
    if (s && !s.visible) {
      s.setVisible(true).setScale(0);
      this.scene.tweens.add({ targets: s, scale: SCALE, duration: 260, ease: 'Back.Out' });
    }
    this.scene.time.delayedCall(300, () => this.talk(npc, beat.node, done));
  }

  /** Gelandete Arten gegen Brunos Wunschfisch prüfen. */
  landed(caught: readonly string[]): void {
    const r = fulfillRequest(this.host.save, caught);
    if (!r.speciesId) return;
    this.lastRequest = r.speciesId;
    this.host.setSave(r.save);
    play('fanfare');
    this.host.say(t('request.done', { fish: t(speciesById.get(r.speciesId)!.nameKey), reward: r.reward }));
    this.refresh();
  }

  private portrait(npc: NpcDef): string | undefined {
    try {
      return this.scene.textures.getBase64(npc.sprite, 0);
    } catch {
      return undefined;
    }
  }

  private setTalking(npc: NpcDef, talking: boolean): void {
    this.sprites.get(npc.id)?.play(animKey(npc.sprite, talking ? 'talk' : 'idle'));
  }

  private finish(npc: NpcDef, done?: () => void): void {
    this.sheet.close();
    this.setTalking(npc, false);
    this.refresh();
    done?.();
  }

  private talk(npc: NpcDef, nodeId: string, done?: () => void): void {
    const node = dialogNode(npc.dialog, nodeId, this.host.save.story.seen);
    const portrait = this.portrait(npc);
    this.setTalking(npc, true);
    play('talk');
    const show = () => {
      if (node.action?.type === 'showRequest') return this.showRequest(npc, portrait, done);
      if (node.action?.type === 'startQuiz') return this.startQuiz(npc, portrait, done);
      this.sheet.show(
        t(npc.nameKey),
        t(node.textKey),
        node.options.map((o) => ({
          label: t(o.textKey),
          onSelect: () => {
            play('tap');
            if (o.next) this.talk(npc, o.next, done);
            else this.finish(npc, done);
          },
        })),
        undefined,
        portrait,
      );
    };
    if (node.reaction && portrait) playReaction(this.uiRoot, portrait, node.reaction, t(`reaction.${npc.id}.${node.id}`), show);
    else show();
  }

  private showRequest(npc: NpcDef, portrait: string | undefined, done?: () => void): void {
    let save = this.host.save;
    if (!save.request) {
      const line = reachableMeters(
        upgradeValue(upgradeById('line'), save.upgrades.line),
        spots,
        homeSpot,
        upgradeValue(upgradeById('engine'), save.upgrades.engine),
      );
      const request = newRequest(`${save.createdAt}-request-${save.stats.casts}`, species, line, harbor.requestReward, this.lastRequest);
      save = { ...save, request };
      this.host.setSave(save);
    }
    const r = save.request;
    const def = r ? speciesById.get(r.speciesId) : undefined;
    const text = r && def
      ? t('request.text', { fish: t(def.nameKey), reward: r.reward, min: def.depthMeters[0], max: def.depthMeters[1] })
      : t('request.none');
    this.sheet.show(t('request.title'), text, [{ label: t('npc.ok'), color: def?.placeholderColor, onSelect: () => this.finish(npc, done) }], undefined, portrait);
  }

  private startQuiz(npc: NpcDef, portrait: string | undefined, done?: () => void): void {
    const save = this.host.save;
    const round = quizReady(save, quiz, harbor) ? pickQuiz(`${save.createdAt}-quiz-${save.quiz.asked}`, save, quiz) : null;
    if (!round) {
      this.sheet.show(t(npc.nameKey), t('quiz.notReady'), [{ label: t('npc.ok'), onSelect: () => this.finish(npc, done) }], undefined, portrait);
      return;
    }
    const def = speciesById.get(round.species)!;
    this.sheet.show(
      t('quiz.title'),
      t(round.questionKey),
      round.answerKeys.map((key, i) => ({
        label: t(key),
        onSelect: () => {
          const result = answerQuiz(this.host.save, round, i, def.value, harbor);
          this.host.setSave(result.save);
          play(result.right ? 'fanfare' : 'wrong');
          const text = result.right
            ? `${t('quiz.right', { reward: result.reward })} ${t(def.factKey)}`
            : `${t('quiz.wrong', { answer: t(round.answerKeys[round.correct]!) })} ${t(def.factKey)}`;
          const after = () => this.sheet.show(t(npc.nameKey), text, [{ label: t('quiz.next'), onSelect: () => this.finish(npc, done) }], undefined, portrait);
          this.sheet.close();
          if (portrait) {
            const reaction = result.right ? ({ background: 'sparkle', mood: 'joy' } as const) : ({ background: 'waves', mood: 'shock' } as const);
            playReaction(this.uiRoot, portrait, reaction, t(result.right ? 'reaction.right' : 'reaction.wrong'), after);
          } else after();
        },
      })),
      undefined,
      portrait,
    );
  }
}
