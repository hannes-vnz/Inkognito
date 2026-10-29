import Phaser from 'phaser';
import './style.css';
import { BootScene } from './scenes/BootScene';
import { DiveScene } from './scenes/DiveScene';
import { t } from './i18n';

document.title = t('game.title');
const loading = document.getElementById('loading');
if (loading) loading.textContent = t('ui.loading');

new Phaser.Game({
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
  scene: [BootScene, DiveScene],
});
