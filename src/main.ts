import Phaser from 'phaser';
import { GAME } from './core/config';
import { BootScene, TitleScene, ResultScene } from './scenes/MenuScenes';
import { StreetScene, InteriorScene } from './scenes/PlayScene';
import { audio } from './audio/AudioEngine';
import './style.css';

const game = new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', width: GAME.width, height: GAME.height,
  backgroundColor: '#183235', pixelArt: true, roundPixels: true, antialias: false,
  powerPreference: 'high-performance',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: GAME.gravity }, debug: false, fixedStep: true, fps: 60 } },
  fps: { target: 60, forceSetTimeOut: false },
  audio: { noAudio: true }, // All original sound is synthesized by our single Web Audio engine.
  scene: [BootScene, TitleScene, StreetScene, InteriorScene, ResultScene]
});

const unlock = () => { void audio.unlock(); };
document.addEventListener('pointerdown', unlock, { once: true });
document.addEventListener('keydown', unlock, { once: true });
const soundButton = document.getElementById('sound-toggle')!;
document.querySelector('.brand')!.addEventListener('click', event => {
  event.preventDefault();
  for (const scene of game.scene.getScenes(true)) game.scene.stop(scene.sys.settings.key);
  game.scene.start('Title');
});
soundButton.addEventListener('click', () => {
  const muted = audio.toggleMute();
  soundButton.textContent = muted ? '♪ SOUND OFF' : '♪ SOUND ON';
  soundButton.setAttribute('aria-pressed', String(muted));
});
document.getElementById('fullscreen')!.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.getElementById('game-frame')!.requestFullscreen();
    game.scale.refresh();
  } catch { document.getElementById('scene-label')!.textContent = 'このブラウザでは全画面表示を利用できません'; }
});
if (import.meta.hot) import.meta.hot.dispose(() => game.destroy(true));
