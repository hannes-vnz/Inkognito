import Phaser from 'phaser';
import { baitById, baits, gadgets, gags, harbor, homeOf, marketParams, params, npcById, npcs, perkParams, quiz, species, speciesById, speciesIn, spotById, spotsIn, story, upgradeById } from '../data';
import { baitCost, buyBait } from '../systems/bait';
import { hintReady, hintsGiven, legendOf, takeHint } from '../systems/legend';
import { reachableMeters, unlockedSpots } from '../systems/seaMap';
import { boardCharter, buyTip, charterReady, tipPrice } from '../systems/perks';
import { dayKey } from '../systems/daily';
import { play } from '../audio/sfx';
import { animKey } from '../entities/Octopus';
import { dialogNode, faceOf, type Face, type NpcDef } from '../systems/dialog';
import { markSeen, nextBeat, npcMet } from '../systems/story';
import { newRequest } from '../systems/requests';
import { buyGadget, equipGadget } from '../systems/gadgets';
import { castsUntilTick, crateCount, marketTick, priceTrend, sellFish } from '../systems/market';
import { answerQuiz, pickQuiz, quizReady } from '../systems/quiz';
import { upgradeValue } from '../systems/economy';
import type { Save } from '../systems/save';
import { t } from '../i18n';
import type { Sheet } from '../ui/Sheet';
import { playReactionShot, playScene } from './cutscenes';
import { HarborLife } from './HarborLife';

export interface HarborHost {
  readonly save: Save;
  setSave(save: Save): void;
  /** Darf gerade jemand angesprochen werden (an Deck, nichts offen)? */
  canTalk(): boolean;
  say(text: string): void;
  /** Heutiger Stückpreis einer Art bei Bruno (angetippt: `combo`). */
  priceOf(speciesId: string, combo?: boolean): number;
  /** Münzen fliegen von dieser Stelle (Weltkoordinaten) zum Zähler. */
  celebrate(coins: number, x: number, y: number): void;
}

const SCALE = 2;

/** Heutiger Tag (Ortszeit) für tägliche Angebote. */
const today = (): string => {
  const now = new Date();
  return dayKey(now.getTime(), now.getTimezoneOffset());
};

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
  private life: HarborLife | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly uiRoot: HTMLElement,
    private readonly sheet: Sheet,
    private readonly host: HarborHost,
  ) {}

  build(width: number, surface: number): void {
    // Breiter Hafen (quer oder hochkant als Promenade): Hütte hat Platz, Stand und Qualle rücken nach innen.
    const wide = width >= 600;
    // Hafenstadt hinter dem Steg (Pixel ×6 im Bild, auf dem Schirm ×2)
    this.scene.add.image(0, surface + 4, 'bg_harbor_0').setOrigin(0, 1).setScale(1 / 3).setDepth(-18);
    this.gagIndex = this.host.save.stats.casts;
    const g = this.scene.add.graphics().setDepth(2);
    if (wide) {
      // Quer ist Platz für die Fischerhütte auf Stelzen (CraftPix, siehe CREDITS.md); ihr Steg liegt auf Höhe der Figuren
      this.scene.add.image(0, surface - 6 - 62 * 1.5, 'harbor_hut').setOrigin(0, 0).setScale(1.5).setDepth(-17);
      this.scene.add.image(150, surface - 6, 'harbor_barrel').setOrigin(0.5, 1).setScale(2).setDepth(2.5);
    } else {
      // Hochkant: schmaler Steg mit Planken und Pfählen
      g.fillStyle(0x6b4a2b, 1);
      g.fillRect(0, surface - 6, 92, 8);
      g.fillStyle(0x8a6a3b, 1);
      for (let x = 0; x < 92; x += 10) g.fillRect(x, surface - 6, 8, 2);
      g.fillStyle(0x4a321d, 1);
      for (const x of [6, 46, 84]) g.fillRect(x, surface, 6, 40);
    }
    // Fischstand rechts: Markise und Theke
    // Quer bleibt rechts oben Platz für Münzen und Konto; die schmale Promenade schiebt den Stand am Leuchtturm vorbei
    const sx = !wide ? width - 46 : width < 800 ? width - 90 : width - 150;
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
      // Auf dem Steg der Fischerhütte: Professor Blinkers Werkstatt
      hut: { x: wide ? 190 : 46, y: surface - 6 },
      // Zwischen Boot und Fischstand
      promenade: { x: (width / 2 + 96 + sx - 34) / 2, y: surface - 4 },
    };
    for (const n of npcs) {
      const p = spots[n.place];
      const s = this.scene.add.sprite(p.x, p.y, n.sprite, 0).setOrigin(0.5, 1).setScale(SCALE).setDepth(n.place === 'stall' ? 1 : 3);
      s.play(animKey(n.sprite, 'idle'));
      s.setInteractive({ useHandCursor: true });
      // Nur echte Tipps aufs Spielfeld: Ein Knopf darüber (z. B. die Kiste) soll nicht durchreichen
      s.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (p: Phaser.Input.Pointer) => p.downElement === this.scene.game.canvas && this.host.canTalk() && this.talk(n, 'start'));
      if (n.place === 'water') this.scene.tweens.add({ targets: s, y: '-=10', duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      const m = this.scene.add
        .text(p.x + (n.place === 'stall' ? 30 : 0), p.y - n.frame.height * SCALE - 6 + (n.place === 'stall' ? 24 : 0), '', { fontFamily: '"Baloo 2", sans-serif', fontSize: '26px', color: '#ffd23f', stroke: '#1b1030', strokeThickness: 6 })
        .setOrigin(0.5, 1)
        .setDepth(11);
      this.scene.tweens.add({ targets: m, y: '-=6', duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.sprites.set(n.id, s);
      this.markers.set(n.id, m);
    }
    const host = this.host;
    const sprites = this.sprites;
    this.life = new HarborLife(this.scene, {
      get save() {
        return host.save;
      },
      setSave: (s) => host.setSave(s),
      canTalk: () => host.canTalk(),
      say: (text) => host.say(text),
      npcSprite: (id) => sprites.get(id),
    });
    this.life.build({ surface, worldW: width, pierEnd: wide ? 280 : 92, boatRight: width / 2 + 96, stallLeft: sx - 34 });
    this.refresh();
  }

  /** Neue Hafenbewohner ankündigen (nach Story-Momenten, wenn das Deck frei ist). */
  announceLife(): void {
    this.life?.announce();
  }

  /** Sprite einer Figur oder eines Bewohners (für Spezial-Animationen). */
  figure(id: string): Phaser.GameObjects.Sprite | undefined {
    return this.sprites.get(id) ?? this.life?.sprite(id);
  }

  /** Sichtbarkeit und Hinweisblasen: „!“ wenn Bruno einen neuen Wunsch hat, „?“ wenn ein Quiz wartet. */
  refresh(): void {
    const save = this.host.save;
    for (const n of npcs) {
      const met = npcMet(save, story, n.id);
      this.sprites.get(n.id)?.setVisible(met);
      let mark = '';
      if (met && n.id === 'bruno' && ((save.story.seen.includes(harbor.requestRequires) && save.request === null) || crateCount(save.crate) > 0)) mark = '!';
      if (met && n.id === 'qualle' && quizReady(save, quiz, harbor)) mark = '?';
      const legend = legendOf(species, save.sea.current);
      if (met && n.id === 'knut' && legend && !save.fishbook[legend.id] && hintReady(save, save.sea.current, legend.legend.hintKeys.length, harbor)) mark = '!';
      if (met && n.id === 'schulze' && charterReady(save, today())) mark = '!';
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

  /** Professor Blinkers Werkstatt: Gadgets kaufen oder das angehängte wechseln. */
  private showGadgets(npc: NpcDef, portrait: string | undefined, done?: () => void): void {
    const save = this.host.save;
    this.anim(npc, 'talk');
    this.sheet.show(
      t('gadget.title'),
      t('gadget.text'),
      [
        ...gadgets.map((g) => {
          const owned = save.gadgets.owned.includes(g.id);
          const on = save.gadgets.equipped === g.id;
          return {
            label: `${t(g.nameKey)} · ${t(g.descKey)}`,
            meta: on ? t('gadget.equipped') : owned ? t('gadget.equip') : g.price.toLocaleString('de-DE'),
            onSelect: () => {
              if (on) return;
              if (owned) {
                this.host.setSave(equipGadget(this.host.save, g.id));
                play('tap');
                return this.showGadgets(npc, portrait, done);
              }
              const bought = buyGadget(this.host.save, g);
              if (!bought) {
                play('error');
                this.host.say(t('gadget.poor'));
                return;
              }
              this.host.setSave(bought);
              play('upgrade');
              this.anim(npc, 'react');
              this.host.say(t('gadget.bought', { name: t(g.nameKey) }));
              this.finish(npc, done);
            },
          };
        }),
        { label: t('npc.bye'), onSelect: () => this.finish(npc, done) },
      ],
      undefined,
      portrait,
    );
  }

  /** Bruno steht am Stand und darf angesprochen werden. */
  canOpenSale(): boolean {
    return Boolean(this.sprites.get('bruno')?.visible) && this.host.canTalk();
  }

  /** Kiste antippen im Hafen: direkt zu Brunos Ankauf. */
  openSale(): void {
    const bruno = npcById.get('bruno');
    if (bruno) this.talk(bruno, 'sell');
  }

  /** Bruno kauft den Fang zum Tageskurs; einzeln oder alles. Der Wunschfisch bringt die Prämie obendrauf. */
  private sellFish(npc: NpcDef, portrait: string | undefined, done?: () => void): void {
    const save = this.host.save;
    const ids = Object.keys(save.crate).filter((id) => (save.crate[id]?.n ?? 0) > 0);
    if (ids.length === 0) {
      this.sheet.show(t('sell.title'), t('sell.empty'), [{ label: t('npc.ok'), onSelect: () => this.finish(npc, done) }], undefined, portrait);
      return;
    }
    const tick = marketTick(save.stats.casts, marketParams);
    const seed = String(save.createdAt);
    const arrows = ['↘', '→', '↗'];
    const total = (id: string) => {
      const c = save.crate[id]!;
      const price = this.host.priceOf(id);
      return price * (c.n - c.premium) + Math.round(price * params.comboMultiplier) * c.premium;
    };
    const sorted = [...ids].sort((x, y) => total(y) - total(x));
    const sell = (which: readonly string[]) => {
      const r = sellFish(this.host.save, which, (id) => this.host.priceOf(id), params.comboMultiplier);
      this.host.setSave(r.save);
      const at = this.sprites.get('bruno');
      if (at) this.host.celebrate(r.coins, at.x, at.y - 40);
      play('coin', 1.2);
      this.anim(npc, 'react');
      if (r.request) {
        this.lastRequest = r.request.speciesId;
        const fish = t(speciesById.get(r.request.speciesId)!.nameKey);
        this.sheet.close();
        playScene(this.scene, this.uiRoot, 'bruno_deal', { fish }, () => this.host.say(t('request.done', { fish, reward: r.request!.reward })));
        this.refresh();
        return true;
      }
      this.host.say(t('sell.done', { coins: r.coins.toLocaleString('de-DE') }));
      return false;
    };
    const wish = save.request ? speciesById.get(save.request.speciesId) : undefined;
    this.anim(npc, 'talk');
    this.sheet.show(
      t('sell.title'),
      `${castsUntilTick(save.stats.casts, marketParams) === 1 ? t('sell.textSoon') : t('sell.text', { casts: castsUntilTick(save.stats.casts, marketParams) })}${wish ? ` ${t('sell.wish', { fish: t(wish.nameKey), reward: save.request!.reward })}` : ''}`,
      [
        ...sorted.map((id) => ({
          label: t('sell.line', { name: t(speciesById.get(id)!.nameKey), n: save.crate[id]!.n, price: this.host.priceOf(id), trend: arrows[priceTrend(seed, id, tick, marketParams) + 1]! }),
          meta: total(id).toLocaleString('de-DE'),
          onSelect: () => {
            if (sell([id])) return;
            if (crateCount(this.host.save.crate) > 0) this.sellFish(npc, portrait, done);
            else this.finish(npc, done);
          },
        })),
        {
          label: t('sell.all'),
          meta: sorted.reduce((a, id) => a + total(id), 0).toLocaleString('de-DE'),
          onSelect: () => {
            if (!sell(sorted)) this.finish(npc, done);
          },
        },
        { label: t('sell.later'), onSelect: () => this.finish(npc, done) },
      ],
      undefined,
      portrait,
    );
  }

  private portrait(npc: NpcDef, face: Face = 'normal'): string | undefined {
    try {
      return this.scene.textures.getBase64(face === 'normal' ? `portrait_${npc.id}` : `portrait_${npc.id}_${face}`);
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
    const portrait = this.portrait(npc, faceOf(node));
    this.setTalking(npc, true);
    play('talk');
    const show = () => {
      if (node.action?.type === 'showRequest') return this.showRequest(npc, portrait, done);
      if (node.action?.type === 'startQuiz') return this.startQuiz(npc, portrait, done);
      if (node.action?.type === 'legendHint') return this.legendHint(npc, portrait, done);
      if (node.action?.type === 'showBaits') return this.showBaits(npc, portrait, done);
      if (node.action?.type === 'showGadgets') return this.showGadgets(npc, portrait, done);
      if (node.action?.type === 'sellFish') return this.sellFish(npc, portrait, done);
      if (node.action?.type === 'giselaTip') return this.giselaTip(npc, portrait, done);
      if (node.action?.type === 'charter') return this.charter(npc, portrait, done);
      if (node.action?.type === 'gag') return this.gag(npc, this.portrait(npc, 'annoyed'), done);
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
    if (node.cutscene) {
      this.anim(npc, 'react');
      playScene(this.scene, this.uiRoot, node.cutscene, {}, show);
    } else if (node.reaction) {
      this.anim(npc, 'react');
      playReactionShot(this.scene, this.uiRoot, npc.id, node.reaction, t(`reaction.${npc.id}.${node.id}`), show);
    } else show();
  }

  /** Möwe Gisela: der Reihe nach ihre Sprüche, mit Gekreische. */
  private gag(npc: NpcDef, portrait: string | undefined, done?: () => void): void {
    const key = gags[this.gagIndex++ % gags.length]!;
    this.anim(npc, 'react');
    play('talk', 0.7);
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
  /** Möwe Gisela: Fischbrötchen gegen einen Schwarm-Platz mit doppelten Münzen. */
  private giselaTip(npc: NpcDef, portrait: string | undefined, done?: () => void): void {
    const save = this.host.save;
    const ok = () => [{ label: t('npc.ok'), onSelect: () => this.finish(npc, done) }];
    if (save.perks.tip) {
      const spot = spotById(save.perks.tip.spot);
      this.sheet.show(t('tip.title'), t('tip.active', { spot: t(spot.nameKey), casts: save.perks.tip.casts }), ok(), undefined, portrait);
      return;
    }
    const sea = save.sea.current;
    const range = upgradeValue(upgradeById('engine'), save.upgrades.engine);
    const ids = unlockedSpots(spotsIn(sea), homeOf(sea), range)
      .filter((s) => !s.harbor)
      .map((s) => s.id);
    if (ids.length === 0) {
      this.sheet.show(t('tip.title'), t('tip.none'), ok(), undefined, portrait);
      return;
    }
    this.anim(npc, 'talk');
    this.sheet.show(
      t('tip.title'),
      t('tip.offer', { casts: perkParams.tip.casts }),
      [
        {
          label: t('tip.buy'),
          meta: tipPrice(save, perkParams).toLocaleString('de-DE'),
          onSelect: () => {
            const bought = buyTip(this.host.save, ids, `${save.createdAt}-tip-${save.stats.casts}`, perkParams);
            if (!bought) {
              play('error');
              this.host.say(t('tip.poor'));
              return;
            }
            this.host.setSave(bought);
            play('coin');
            this.anim(npc, 'react');
            const spot = spotById(bought.perks.tip!.spot);
            this.sheet.show(t('tip.title'), t('tip.given', { spot: t(spot.nameKey) }), ok(), undefined, this.portrait(npc, 'happy'));
          },
        },
        { label: t('npc.bye'), onSelect: () => this.finish(npc, done) },
      ],
      undefined,
      portrait,
    );
  }

  /** Herr Schulze fährt einmal am Tag mit: doppelte Münzen, ein Haken weniger, neue Arten ins Album. */
  private charter(npc: NpcDef, portrait: string | undefined, done?: () => void): void {
    const save = this.host.save;
    if (save.perks.charter.aboard || !charterReady(save, today())) {
      this.sheet.show(t('charter.title'), t('charter.done', { album: save.perks.charter.album.length }), [{ label: t('npc.ok'), onSelect: () => this.finish(npc, done) }], undefined, portrait);
      return;
    }
    this.anim(npc, 'talk');
    this.sheet.show(
      t('charter.title'),
      t('charter.offer'),
      [
        {
          label: t('charter.go'),
          onSelect: () => {
            this.host.setSave(boardCharter(this.host.save, today()));
            play('fanfare', 1.4);
            this.anim(npc, 'react');
            this.finish(npc, done);
            this.host.say(t('charter.aboard'));
          },
        },
        { label: t('charter.later'), onSelect: () => this.finish(npc, done) },
      ],
      undefined,
      portrait,
    );
  }

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
              play('error');
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
          const face = this.portrait(npc, result.right ? 'happy' : 'shock');
          const after = () => this.sheet.show(t(npc.nameKey), text, [{ label: t('quiz.next'), onSelect: () => this.finish(npc, done) }], undefined, face);
          this.sheet.close();
          const reaction = result.right ? ({ background: 'sparkle', mood: 'joy' } as const) : ({ background: 'waves', mood: 'shock' } as const);
          playReactionShot(this.scene, this.uiRoot, npc.id, reaction, t(result.right ? 'reaction.right' : 'reaction.wrong'), after);
        },
      })),
      undefined,
      portrait,
    );
  }
}
