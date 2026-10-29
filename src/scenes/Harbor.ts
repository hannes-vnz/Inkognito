import Phaser from 'phaser';
import { baitById, baits, gags, harbor, homeOf, npcById, npcs, quiz, species, speciesById, speciesIn, spotsIn, story, upgradeById } from '../data';
import { baitCost, buyBait } from '../systems/bait';
import { hintReady, hintsGiven, legendOf, takeHint } from '../systems/legend';
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
 * Der Hafen als kleine Stadt: Häuser und Leuchtturm im Hintergrund, Hilde und Opa Knut auf dem Steg,
 * Bruno am Fischstand mit Möwe Gisela auf dem Dach, Professorin Qualle im Wasser.
 * Antippen öffnet ihren Dialog, Story-Momente spielen nach jeder Rückkehr an Deck.
 */
export class Harbor {
  private readonly sprites = new Map<string, Phaser.GameObjects.Sprite>();
  private readonly markers = new Map<string, Phaser.GameObjects.Text>();
  private lastRequest: string | undefined;
  private gagIndex = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly uiRoot: HTMLElement,
    private readonly sheet: Sheet,
    private readonly host: HarborHost,
  ) {}

  build(width: number, height: number, surface: number): void {
    // Quer liegen rechts oben Münzen und Konto, unten rechts das Deck: Stand und Qualle rücken nach links.
    const wide = width > height;
    // Hafenstadt hinter dem Steg (Pixel ×6 im Bild, auf dem Schirm ×2)
    this.scene.add.image(0, surface + 4, 'bg_harbor_0').setOrigin(0, 1).setScale(1 / 3).setDepth(-18);
    this.gagIndex = this.host.save.stats.casts;
    const g = this.scene.add.graphics().setDepth(2);
    // Steg links mit Planken und Pfählen
    g.fillStyle(0x6b4a2b, 1);
    g.fillRect(0, surface - 6, 92, 8);
    g.fillStyle(0x8a6a3b, 1);
    for (let x = 0; x < 92; x += 10) g.fillRect(x, surface - 6, 8, 2);
    g.fillStyle(0x4a321d, 1);
    for (const x of [6, 46, 84]) g.fillRect(x, surface, 6, 40);
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
      pier: { x: 26, y: surface - 6 },
      bench: { x: 66, y: surface - 4 },
      stall: { x: sx, y: surface - 18 },
      roof: { x: sx - 16, y: surface - 90 },
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
      const legend = legendOf(species, save.sea.current);
      if (met && n.id === 'knut' && legend && !save.fishbook[legend.id] && hintReady(save, save.sea.current, legend.legend.hintKeys.length, harbor)) mark = '!';
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
      return this.scene.textures.getBase64(`portrait_${npc.id}`);
    } catch {
      return undefined;
    }
  }

  private anim(npc: NpcDef, key: 'idle' | 'talk' | 'react'): void {
    this.sprites.get(npc.id)?.play(animKey(npc.sprite, key));
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
      if (node.action?.type === 'legendHint') return this.legendHint(npc, portrait, done);
      if (node.action?.type === 'showBaits') return this.showBaits(npc, portrait, done);
      if (node.action?.type === 'gag') return this.gag(npc, portrait, done);
      this.anim(npc, 'talk');
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
    if (node.reaction && portrait) {
      this.anim(npc, 'react');
      playReaction(this.uiRoot, portrait, node.reaction, t(`reaction.${npc.id}.${node.id}`), show);
    }
    else show();
  }

  /** Möwe Gisela: der Reihe nach ihre Sprüche, mit Gekreische. */
  private gag(npc: NpcDef, portrait: string | undefined, done?: () => void): void {
    const key = gags[this.gagIndex++ % gags.length]!;
    this.anim(npc, 'react');
    play('bite', 1.6);
    this.sheet.show(t(npc.nameKey), t(key), [{ label: t('npc.ok'), onSelect: () => this.finish(npc, done) }], undefined, portrait);
  }

  /** Opa Knut erzählt von der Legende des Meeres: pro Besuch höchstens ein neuer, vager Hinweis. */
  private legendHint(npc: NpcDef, portrait: string | undefined, done?: () => void): void {
    const save = this.host.save;
    const sea = save.sea.current;
    const legend = legendOf(species, sea);
    let text: string;
    if (!legend) text = t('legend.noMore');
    else if (save.fishbook[legend.id]) text = t('legend.done');
    else if (hintReady(save, sea, legend.legend.hintKeys.length, harbor)) {
      this.host.setSave(takeHint(save, sea, harbor));
      text = t(legend.legend.hintKeys[hintsGiven(save, sea)]!);
      play('newSpecies', 0.8);
    } else {
      const given = hintsGiven(save, sea);
      // Schon Gesagtes wiederholen, dazu warum es gerade nicht mehr gibt
      const last = given > 0 ? `${t(legend.legend.hintKeys[given - 1]!)} ` : '';
      text = last + t(given >= legend.legend.hintKeys.length ? 'legend.noMore' : 'legend.later');
    }
    this.anim(npc, 'talk');
    const title = legend ? t(legend.legend.nameKey) : t(npc.nameKey);
    this.sheet.show(title, text, [{ label: t('npc.ok'), onSelect: () => this.finish(npc, done) }], undefined, portrait);
  }

  /** Brunos Köder: für den nächsten Wurf, Preis wächst mit den Upgrades. */
  private showBaits(npc: NpcDef, portrait: string | undefined, done?: () => void): void {
    const save = this.host.save;
    const active = baitById(save.bait);
    if (active) {
      this.sheet.show(t('bait.title'), t('bait.active', { name: t(active.nameKey) }), [{ label: t('npc.ok'), onSelect: () => this.finish(npc, done) }], undefined, portrait);
      return;
    }
    this.anim(npc, 'talk');
    this.sheet.show(
      t('bait.title'),
      t('bait.text'),
      [
        ...baits.map((b) => ({
          label: `${t(b.nameKey)} · ${t(b.descKey)}`,
          meta: baitCost(b, save).toLocaleString('de-DE'),
          onSelect: () => {
            const bought = buyBait(this.host.save, b);
            if (!bought) {
              play('wrong');
              this.host.say(t('bait.poor'));
              return;
            }
            this.host.setSave(bought);
            play('coin');
            this.host.say(t('bait.bought', { name: t(b.nameKey) }));
            this.finish(npc, done);
          },
        })),
        { label: t('npc.bye'), onSelect: () => this.finish(npc, done) },
      ],
      undefined,
      portrait,
    );
  }

  private showRequest(npc: NpcDef, portrait: string | undefined, done?: () => void): void {
    let save = this.host.save;
    if (!save.request) {
      const line = reachableMeters(
        upgradeValue(upgradeById('line'), save.upgrades.line),
        spotsIn(save.sea.current),
        homeOf(save.sea.current),
        upgradeValue(upgradeById('engine'), save.upgrades.engine),
      );
      const request = newRequest(`${save.createdAt}-request-${save.stats.casts}`, speciesIn(save.sea.current), line, harbor.requestReward, this.lastRequest);
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
