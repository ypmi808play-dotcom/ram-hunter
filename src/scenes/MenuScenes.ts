import Phaser from 'phaser';
import { generatePixelAssets } from '../art/pixelArt';
import { titleArt } from '../art/worldArt';
import { RunSession, previewResult } from '../core/session';
import { FEATURES, RUN_MODES } from '../core/config';
import type { RunMode } from '../core/config';
import type { RunResult } from '../core/session';
import { createDataCenterPlan } from '../core/empire';
import { DataCenterRenderer } from '../game/DataCenterRenderer';
import { audio } from '../audio/AudioEngine';
import * as ui from '../ui/interface';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  create() {
    generatePixelAssets(this);
    document.getElementById('loading')?.remove();
    this.scene.start('Title');
  }
}

export class TitleScene extends Phaser.Scene {
  private starting = false;
  private mode: RunMode = 'normal';
  private riskMode: boolean = FEATURES.riskModeDefault;
  constructor() { super('Title'); }
  create() {
    this.starting = false;
    audio.setMode('title'); this.cameras.main.setScroll(0, 0); titleArt(this);
    const start = () => {
      if (this.starting || ui.hasModal()) return;
      this.starting = true; void audio.unlock(); audio.play('enter');
      this.scene.start('Street', { run: new RunSession(undefined, this.mode, this.riskMode) });
    };
    ui.titleUI(
      start,
      () => this.scene.start('Result', { preview: true, mode: this.mode }),
      this.mode,
      mode => { this.mode = mode; },
      this.riskMode,
      risk => { this.riskMode = risk; }
    );
    this.input.keyboard!.on('keydown-ENTER', start);
    this.events.once('shutdown', () => this.input.keyboard?.off('keydown-ENTER', start));
  }
  update() { audio.tick(); }
}

export class ResultScene extends Phaser.Scene {
  private dataCenter!: DataCenterRenderer;
  private result!: RunResult;
  private preview = false;
  private previewTimer?: Phaser.Time.TimerEvent;
  constructor() { super('Result'); }
  create(data: { result?: RunResult; preview?: boolean; mode?: RunMode }) {
    this.preview = !!data.preview;
    this.result = data.result ?? { ...previewResult(), mode: data.mode ?? 'normal', durationMs: RUN_MODES[data.mode ?? 'normal'].durationMs };
    audio.setMode('result');
    this.cameras.main.setBackgroundColor('#193b39').setScroll(0, 0);
    const g = this.add.graphics().setDepth(-10);
    g.fillStyle(0xa5d69a, 0.09);
    for (let y = 155; y < 500; y += 20) for (let x = 40; x < 1240; x += 20) g.fillRect(x, y, 1, 1);
    const skyline = this.add.tileSprite(0, 245, 1280, 190, 'skyline').setOrigin(0).setTileScale(1.3).setTint(0x4d7969).setAlpha(0.1).setDepth(-9);
    let best = this.result.score;
    if (!this.preview) {
      try {
        const key = this.result.riskMode
          ? `ram-hunter-best-v1.2:${this.result.mode}:risk`
          : `ram-hunter-best-v1.2:${this.result.mode}`;
        const legacy = !this.result.riskMode && this.result.mode === 'classic' ? Number(localStorage.getItem('ram-hunter-best-v1')) || 0 : 0;
        best = Math.max(Number(localStorage.getItem(key)) || legacy, this.result.score);
        localStorage.setItem(key, String(best));
      } catch { /* Private browsing still supports a full run. */ }
    }
    const securedRam = this.result.securedRamGB ?? this.result.availableRamGB;
    const plan = createDataCenterPlan(securedRam);
    ui.resultUI(this.result, plan, this.preview, best);
    skyline.setAlpha(plan.level >= 6 ? 0.45 : 0.1);
    this.dataCenter = new DataCenterRenderer(this, securedRam);
    const start = () => {
      void audio.unlock();
      this.scene.start('Street', { run: new RunSession(undefined, this.result.mode, this.result.riskMode) });
    };
    const title = () => this.scene.start('Title');
    const skip = () => this.dataCenter.skip();
    ui.button('play-again', start); ui.button('back-title', title); ui.button('skip-build', skip);
    if (this.preview) {
      const slider = document.getElementById('lab-ram') as HTMLInputElement;
      slider.addEventListener('input', () => {
        document.getElementById('lab-value')!.textContent = slider.value;
        this.previewTimer?.remove(); this.previewTimer = this.time.delayedCall(160, () => this.changePreview(Number(slider.value), skyline));
      });
      document.querySelectorAll<HTMLButtonElement>('[data-ram]').forEach(btn => btn.addEventListener('click', () => {
        slider.value = btn.dataset.ram!; document.getElementById('lab-value')!.textContent = slider.value;
        this.previewTimer?.remove(); this.changePreview(Number(slider.value), skyline);
      }));
    }
    this.input.keyboard!.on('keydown-SPACE', skip);
    this.input.keyboard!.on('keydown-ESC', title);
    this.events.once('shutdown', () => { this.input.keyboard?.off('keydown-SPACE', skip); this.input.keyboard?.off('keydown-ESC', title); });
  }
  private changePreview(gb: number, skyline: Phaser.GameObjects.TileSprite) {
    this.result = { ...this.result, totalRamGB: gb, totalCollectedRamGB: gb, availableRamGB: gb, securedRamGB: gb, lostRamGB: 0, spentRamGB: 0 };
    const plan = createDataCenterPlan(gb);
    this.dataCenter.destroy(); this.dataCenter = new DataCenterRenderer(this, gb);
    document.getElementById('result-available')!.innerHTML = `${gb.toLocaleString()}<small> GB</small>`;
    document.getElementById('result-collected')!.textContent = String(gb);
    document.getElementById('result-spent')!.textContent = '0';
    const lostEl = document.getElementById('result-lost');
    if (lostEl) lostEl.textContent = '0';
    const secEl = document.getElementById('result-secured');
    if (secEl) secEl.textContent = String(gb);
    document.getElementById('result-level')!.innerHTML = `${String(plan.level).padStart(2, '0')}<small> / 06</small>`;
    document.getElementById('empire-quote')!.textContent = plan.quote;
    document.getElementById('empire-level')!.textContent = `LEVEL ${plan.level} / ${plan.name}`;
    document.getElementById('empire-kind')!.textContent = plan.label;
    document.getElementById('build-light')?.classList.remove('complete');
    document.getElementById('skip-build')?.classList.remove('hidden');
    skyline.setAlpha(plan.level >= 6 ? 0.45 : 0.1);
  }
  update(_time: number, delta: number) { this.dataCenter?.update(delta); }
}
