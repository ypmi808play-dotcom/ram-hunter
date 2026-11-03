import Phaser from 'phaser';

export class CombatEffects {
  private scene: Phaser.Scene;
  constructor(scene: Phaser.Scene) { this.scene = scene; }
  burst(x: number, y: number, radius: number, color: number, label: string, intense = false) {
    const g = this.scene.add.graphics({ x, y }).setDepth(7);
    const points = Array.from({ length: 8 }, (_, i) => ({ x: Math.round(Math.cos(i * Math.PI / 4) * radius), y: Math.round(Math.sin(i * Math.PI / 4) * radius) }));
    g.lineStyle(intense ? 5 : 3, color, 0.9).strokePoints(points, true);
    g.lineStyle(2, color, 0.4).strokeRect(-radius * 0.5, -radius * 0.5, radius, radius);
    g.setScale(0.08);
    this.scene.tweens.add({ targets: g, scale: 1, alpha: 0, duration: intense ? 750 : 500, ease: 'Cubic.easeOut', onComplete: () => g.destroy() });
    for (let i = 0; i < (intense ? 48 : 18); i++) {
      const angle = i * Math.PI * 2 / (intense ? 48 : 18);
      const spark = this.scene.add.image(x, y, i % 4 ? 'spark' : 'ram').setTint(color).setDepth(8).setScale(i % 4 ? 2 : 0.6);
      this.scene.tweens.add({ targets: spark, x: x + Math.cos(angle) * radius * 0.85, y: y + Math.sin(angle) * radius * 0.65, angle: 160, alpha: 0, duration: 450 + i * 7, ease: 'Quad.easeOut', onComplete: () => spark.destroy() });
    }
    const text = this.scene.add.text(x, y - 95, label, { fontFamily: 'monospace', fontSize: intense ? '29px' : '21px', fontStyle: 'bold', color: `#${color.toString(16).padStart(6, '0')}`, stroke: '#1a3739', strokeThickness: 5 }).setOrigin(0.5).setDepth(9);
    this.scene.tweens.add({ targets: text, y: y - 145, alpha: 0, duration: 1100, onComplete: () => text.destroy() });
  }
  hit(x: number, y: number) {
    for (let i = 0; i < 8; i++) {
      const spark = this.scene.add.image(x, y, 'spark').setScale(1.8).setTint(0xffd99b).setDepth(8);
      this.scene.tweens.add({ targets: spark, x: x + Math.cos(i * Math.PI / 4) * 42, y: y + Math.sin(i * Math.PI / 4) * 42, alpha: 0, duration: 280, onComplete: () => spark.destroy() });
    }
  }
}
