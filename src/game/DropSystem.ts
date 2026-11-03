import Phaser from 'phaser';
import { RunSession } from '../core/session';
import type { DropRecord } from '../core/drops';
import { DROPS } from '../core/balance';
import { Player } from './Player';
import { audio } from '../audio/AudioEngine';

interface DropView { record: DropRecord; body: Phaser.Physics.Arcade.Image; image: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text }
export class DropSystem {
  private views = new Map<string, DropView>();
  private scene: Phaser.Scene; private run: RunSession; private sceneId: string; private player: Player;
  private solids: Phaser.Physics.Arcade.StaticGroup; private onPickup: (text: string, ram: number) => void;
  constructor(scene: Phaser.Scene, run: RunSession, sceneId: string, player: Player, solids: Phaser.Physics.Arcade.StaticGroup, onPickup: (text: string, ram: number) => void) {
    this.scene = scene; this.run = run; this.sceneId = sceneId; this.player = player; this.solids = solids; this.onPickup = onPickup;
  }
  update() {
    for (const record of this.run.drops.values()) {
      if (record.sceneId !== this.sceneId || record.status !== 'pending' || this.views.has(record.id)) continue;
      const key = record.kind === 'ram' ? 'ram' : 'energy-drink';
      const body = this.scene.physics.add.image(record.x, record.y, key).setOrigin(.5, 1).setScale(1.5).setAlpha(0).setCollideWorldBounds(true).setBounce(.15).setDragX(180).setVelocityY(-100);
      this.scene.physics.add.collider(body, this.solids);
      const image = this.scene.add.image(record.x, record.y, key).setOrigin(.5, 1).setScale(1.5).setDepth(5);
      const label = this.scene.add.text(record.x, record.y - 35, '', { fontFamily: 'monospace', fontSize: '11px', color: record.kind === 'ram' ? '#c8f3b0' : '#ffd2dc', backgroundColor: '#31534a', padding: { x: 4, y: 2 } }).setOrigin(.5, 1).setDepth(6);
      const view = { record, body, image, label }; this.views.set(record.id, view);
      this.scene.physics.add.overlap(this.player, body, () => {
        const picked = this.run.claimDrop(record.id);
        if (!picked.claimed) return;
        const text = record.kind === 'ram' ? picked.ram ? `+${picked.ram} GB RAM` : 'DRONE RAM LIMIT / 64GB' : picked.healed ? '+1 LIFE / ENERGY DRINK' : 'ENERGY DRINK / MAX HP';
        audio.play(record.kind === 'ram' ? 'collect' : 'heal', picked.ram);
        this.onPickup(text, picked.ram);
        const popup = this.scene.add.text(body.x, body.y - 40, text, { fontFamily: 'monospace', fontSize: '18px', color: record.kind === 'ram' ? '#c6f4a4' : '#ffcedc', stroke: '#284c41', strokeThickness: 4 }).setOrigin(.5).setDepth(9);
        this.scene.tweens.add({ targets: popup, y: popup.y - 45, alpha: 0, duration: 850, onComplete: () => popup.destroy() });
        for (let i = 0; i < 10; i++) { const p = this.scene.add.image(body.x, body.y - 15, 'spark').setTint(record.kind === 'ram' ? 0xc6f4a4 : 0xffb7ca).setDepth(7); this.scene.tweens.add({ targets: p, x: p.x + Math.cos(i * .63) * 45, y: p.y + Math.sin(i * .63) * 35, alpha: 0, duration: 400, onComplete: () => p.destroy() }); }
      });
    }
    for (const [id, view] of this.views) {
      if (view.record.status !== 'pending') { view.body.destroy(); view.image.destroy(); view.label.destroy(); this.views.delete(id); continue; }
      view.record.x = view.body.x; view.record.y = view.body.y;
      view.image.setPosition(view.body.x, view.body.y - 3 + Math.sin(this.run.elapsedMs / 170) * 3);
      const ram = Math.min(view.record.gb, Math.max(0, DROPS.droneRunCapGB - this.run.stats.ramFromDrones));
      view.label.setText(view.record.kind === 'ram' ? ram ? `${ram} GB` : 'CAP 64GB' : 'ENERGY +1').setPosition(view.body.x, view.body.y - 34);
      const flash = view.record.expiresAt - this.run.elapsedMs < 2500 && Math.floor(this.run.elapsedMs / 130) % 2;
      view.image.setAlpha(flash ? .35 : 1);
    }
  }
}
