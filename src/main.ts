import Phaser from 'phaser';
import './style.css';
import { BootScene } from './scenes/BootScene';
import { DiveScene } from './scenes/DiveScene';
import { RiffScene } from './scenes/RiffScene';
import { t } from './i18n';

document.title = t('game.title');
const loading = document.getElementById('loading');
if (loading) loading.textContent = t('ui.loading');

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b3550',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  input: {
    activePointers: 3,
  },
  scene: [BootScene, RiffScene, DiveScene],
});

// iOS meldet die neue Größe nach dem Drehen verspätet: mehrfach nachmessen und Scroll-Versatz zurücksetzen.
const settle = (): void => {
  window.scrollTo(0, 0);
  game.scale.refresh();
};
const onViewportChange = (): void => {
  settle();
  for (const ms of [100, 300, 700]) window.setTimeout(settle, ms);
};
window.addEventListener('orientationchange', onViewportChange);
window.visualViewport?.addEventListener('resize', onViewportChange);
