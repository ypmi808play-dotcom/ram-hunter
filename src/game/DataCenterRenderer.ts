import Phaser from 'phaser';
import { createDataCenterPlan } from '../core/empire';
import type { BuildingPlan, DataCenterPlan } from '../core/empire';
import { audio } from '../audio/AudioEngine';

const project = (col: number, row: number) => ({ x: (col - row) * 92, y: (col + row) * 46 });
interface Structure { root: Phaser.GameObjects.Container; at: number; sounded: boolean; light?: Phaser.GameObjects.Graphics }

/** Deterministic geometry; animation state never changes the generated plan. */
export class DataCenterRenderer {
  readonly plan: DataCenterPlan;
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private structures: Structure[] = [];
  private elapsed = 0;
  private done = false;
  private powered = false;
  private readonly duration = 5400;

  constructor(scene: Phaser.Scene, totalRamGB: number) {
    this.scene = scene; this.plan = createDataCenterPlan(totalRamGB);
    const p = this.plan;
    const count = p.buildingCount;
    const cols = count ? p.columns : 1;
    const rows = count ? p.rows : 1;
    const center = project((cols - 1) / 2, (rows - 1) / 2);
    const groundWidth = (cols + rows + 2.6) * 92;
    const groundHeight = (cols + rows + 2.6) * 46 + 115;
    const zoom = Math.min(1.3, 910 / groundWidth, 290 / groundHeight);
    const zoomX = zoom * 1.35, zoomY = zoom * 0.92;
    this.root = scene.add.container(640 - center.x * zoomX, 340 - center.y * zoomY).setScale(zoomX, zoomY).setDepth(0);
    this.terrain(cols, rows);
    if (count === 0) {
      // A literal rack, not a building-shaped icon, is the starting point.
      if (p.rackCount) {
        const root = scene.add.container(0, -8);
        const racks = Math.min(7, p.rackCount);
        for (let i = 0; i < racks; i++) root.add(scene.add.image((i - (racks - 1) / 2) * 31, (i % 2) * 10, 'server').setOrigin(0.5, 1).setScale(1.05));
        this.root.add(root); this.structures.push({ root, at: 0.08, sounded: false });
      } else {
        const nothing = scene.add.text(0, -40, 'FUTURE SITE OF SOMETHING BIG', { fontFamily: 'monospace', fontSize: '12px', color: '#d2e3bf', backgroundColor: '#53795e', padding: { x: 12, y: 8 } }).setOrigin(0.5);
        this.root.add(nothing);
      }
    } else {
      const sorted = [...p.buildings].sort((a, b) => a.col + a.row - b.col - b.row || a.col - b.col);
      sorted.forEach((building, i) => {
        const pos = project(building.col, building.row);
        const structure = this.building(building, pos.x, pos.y, p.level === 2);
        structure.at = 0.08 + i / Math.max(1, sorted.length) * 0.65;
        this.root.add(structure.root); this.structures.push(structure);
      });
      // Support infrastructure grows with RAM as well as the primary buildings.
      for (let i = 0; i < Math.min(p.coolingCount, Math.max(2, count * 2)); i++) {
        const at = project(i % cols, rows + 0.25 + Math.floor(i / cols) * 0.24);
        this.cooler(at.x, at.y, i, 0.25 + i / Math.max(1, p.coolingCount) * 0.5);
      }
      for (let i = 0; i < Math.min(p.powerCount, rows + 1); i++) {
        const at = project(cols + 0.35, i * 0.8);
        this.substation(at.x, at.y, 0.36 + i * 0.035);
      }
    }
    this.structures.forEach(s => s.root.setVisible(false));
    scene.add.text(640, 452, `${p.rackCount} RACKS  /  ${p.buildingCount} BUILDINGS  /  ${p.coolingCount} COOLING UNITS`, { fontFamily: 'monospace', fontSize: '10px', letterSpacing: 1.5, color: '#a8c4a3', backgroundColor: '#193b39', padding: { x: 8, y: 4 } }).setOrigin(0.5).setName('infrastructure-count');
  }
  private polygon(g: Phaser.GameObjects.Graphics, points: { x: number; y: number }[], color: number, alpha = 1) {
    g.fillStyle(color, alpha).fillPoints(points, true);
  }
  private terrain(cols: number, rows: number) {
    const g = this.scene.add.graphics(); this.root.add(g);
    const a = project(-1.1, -1.1), b = project(cols + 0.4, -1.1), c = project(cols + 0.4, rows + 0.8), d = project(-1.1, rows + 0.8);
    this.polygon(g, [a, b, c, d].map(p => ({ x: p.x, y: p.y + 10 })), 0x214d43);
    this.polygon(g, [a, b, c, d], 0x6e9475);
    for (let col = -1; col <= cols; col++) for (let row = -1; row <= rows; row++) {
      const t = project(col, row);
      this.polygon(g, [{ x: t.x, y: t.y - 40 }, { x: t.x + 80, y: t.y }, { x: t.x, y: t.y + 40 }, { x: t.x - 80, y: t.y }], (row + col) % 2 ? 0x719779 : 0x759b7b);
    }
    this.polygon(g, [project(-0.9, -0.75), project(cols + 0.2, -0.75), project(cols + 0.2, -0.46), project(-0.9, -0.46)], 0x446a60);
    this.polygon(g, [project(-0.75, -0.8), project(-0.46, -0.8), project(-0.46, rows + 0.5), project(-0.75, rows + 0.5)], 0x446a60);
    // Road markings and perimeter hedge are pixel-sized rectangles.
    for (let i = 0; i < cols * 3 + 3; i++) { const t = project(-0.8 + i * 0.33, -0.61); g.fillStyle(0xd8d5ac).fillRect(t.x, t.y, 8, 3); }
    for (let i = 0; i < rows + 2; i++) { const t = project(-1, i - 0.5); g.fillStyle(0x497c58).fillRect(t.x - 9, t.y - 16, 20, 15).fillRect(t.x - 5, t.y - 20, 12, 6); }
    // Entry signage.
    const sign = project(-1, -0.7);
    g.fillStyle(0x305d50).fillRect(sign.x - 15, sign.y - 39, 4, 32).fillRect(sign.x + 15, sign.y - 39, 4, 32);
    g.fillStyle(0xd7dfb1).fillRect(sign.x - 22, sign.y - 44, 48, 18);
    g.fillStyle(0x3f6d57).fillRect(sign.x - 16, sign.y - 39, 35, 3).fillRect(sign.x - 10, sign.y - 33, 22, 2);
  }
  private building(plan: BuildingPlan, x: number, y: number, room: boolean): Structure {
    const root = this.scene.add.container(x, y);
    const g = this.scene.add.graphics(); root.add(g);
    const w = plan.width, d = Math.floor(w / 2), h = room ? 40 : plan.height;
    this.polygon(g, [{ x: -w - 8, y: 1 }, { x: 0, y: d + 11 }, { x: w + 24, y: 1 }, { x: 14, y: -d - 6 }], 0x365f55, 0.4);
    const left = [0x839e97, 0x8caba2, 0x789b9b][plan.variant];
    const right = [0x4f7976, 0x5c837a, 0x527785][plan.variant];
    this.polygon(g, [{ x: -w, y: -h }, { x: 0, y: -h + d }, { x: 0, y: d }, { x: -w, y: 0 }], left);
    this.polygon(g, [{ x: 0, y: -h + d }, { x: w, y: -h }, { x: w, y: 0 }, { x: 0, y: d }], right);
    this.polygon(g, [{ x: 0, y: -h - d }, { x: w, y: -h }, { x: 0, y: -h + d }, { x: -w, y: -h }], 0xb2c0a5);
    // Roof rim and rooftop ventilation boxes.
    g.lineStyle(2, 0xd3d5b2, 0.8).strokePoints([{ x: -w + 4, y: -h }, { x: 0, y: -h - d + 4 }, { x: w - 4, y: -h }]);
    this.cube(g, -20, -h - 5, 18, 10, 10, 0x829c91, 0x496f6a, 0xc3c9a9);
    this.cube(g, 16, -h - 1, 13, 7, 8, 0x829c91, 0x496f6a, 0xc3c9a9);
    for (let i = 0; i < 3; i++) g.fillStyle(0x647f76).fillRect(-30 + i * 7, -h - 12 + i % 2, 4, 2);
    if (room) {
      // A cutaway front makes the bedroom-server tier visibly distinct.
      this.polygon(g, [{ x: -w + 9, y: -h + 12 }, { x: -4, y: -h + d + 8 }, { x: -4, y: d - 4 }, { x: -w + 9, y: -4 }], 0x284b4a);
      for (let i = 0; i < Math.min(6, this.plan.rackCount); i++) {
        const rack = this.scene.add.image(-w + 19 + i * 9, i * 4.4 - 2, 'server').setOrigin(0.5, 1).setScale(0.32);
        root.add(rack);
      }
    }
    const lights = this.scene.add.graphics(); root.add(lights); lights.setVisible(false);
    for (let row = 0; row < Math.max(1, Math.floor(h / 14) - 1); row++) for (let col = 0; col < 4; col++) {
      const lx = -w + 11 + col * (w - 18) / 4, ly = -h + 13 + row * 13 + (col + 0.5) * d / 4;
      g.fillStyle(0x43685f).fillRect(lx, ly, 8, 4);
      if (!room) lights.fillStyle((row + col) % 3 ? 0xc9e8a0 : 0xe5d69a).fillRect(lx, ly, 8, 4);
      const rx = 10 + col * (w - 18) / 4, ry = -h + d + 7 + row * 13 - (col + 0.5) * d / 4;
      g.fillStyle(0x2f5b56).fillRect(rx, ry, 8, 4); lights.fillStyle((row + col) % 4 ? 0xa8dda0 : 0xf0d797).fillRect(rx, ry, 8, 4);
    }
    g.fillStyle(0x294f4d).fillRect(8, d - 20, 12, 15); lights.fillStyle(0xe9dda3).fillRect(12, d - 19, 4, 7);
    return { root, at: 0, sounded: false, light: lights };
  }
  private cube(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, d: number, h: number, left: number, right: number, top: number) {
    this.polygon(g, [{ x: x - w, y: y - h }, { x, y: y - h + d }, { x, y: y + d }, { x: x - w, y }], left);
    this.polygon(g, [{ x, y: y - h + d }, { x: x + w, y: y - h }, { x: x + w, y }, { x, y: y + d }], right);
    this.polygon(g, [{ x, y: y - h - d }, { x: x + w, y: y - h }, { x, y: y - h + d }, { x: x - w, y: y - h }], top);
  }
  private cooler(x: number, y: number, i: number, at: number) {
    const root = this.scene.add.container(x, y);
    const g = this.scene.add.graphics(); root.add(g);
    this.cube(g, 0, 0, 13, 7, 12, 0x9bb4a0, 0x648d7d, 0xd6d6b1);
    g.fillStyle(0x557e70).fillRect(-7, -18, 14, 4).fillRect(-4, -21, 8, 3);
    g.fillStyle(0xc3d6b7).fillRect(-4, -16, 8, 2);
    const steam = this.scene.add.graphics().fillStyle(0xe2ebd0, 0.2).fillRect(-3, -32 - i % 3 * 4, 5, 8).fillRect(0, -43 - i % 2 * 4, 6, 7);
    root.add(steam); this.root.add(root); this.structures.push({ root, at, sounded: false });
  }
  private substation(x: number, y: number, at: number) {
    const root = this.scene.add.container(x, y);
    const g = this.scene.add.graphics(); root.add(g);
    this.cube(g, 0, 0, 16, 8, 15, 0xa2a88d, 0x667d6b, 0xc5c7a3);
    g.lineStyle(3, 0x3f6b59).lineBetween(-13, -4, 0, -78).lineBetween(13, -4, 0, -78).lineBetween(-9, -26, 10, -50).lineBetween(9, -26, -10, -50).lineBetween(-18, -58, 18, -58).lineBetween(-14, -68, 14, -68);
    g.lineStyle(1, 0xbccc9e).lineBetween(-18, -58, -46, -45).lineBetween(18, -58, 44, -72);
    this.root.add(root); this.structures.push({ root, at, sounded: false });
  }
  update(delta: number) {
    if (this.done) return;
    this.elapsed = Math.min(this.duration, this.elapsed + delta);
    const p = this.elapsed / this.duration;
    for (const s of this.structures) {
      const grow = Phaser.Math.Clamp((p - s.at) / 0.13, 0, 1);
      s.root.setVisible(grow > 0).setScale(1, Phaser.Math.Easing.Cubic.Out(grow));
      if (grow > 0 && !s.sounded) { s.sounded = true; audio.play('build'); }
      if (p >= 0.94) s.light?.setVisible(true);
    }
    document.getElementById('build-meter')!.style.width = `${p * 100}%`;
    document.getElementById('build-percent')!.textContent = `${Math.floor(p * 100)}%`;
    const state = document.getElementById('build-status')!;
    state.textContent = p < 0.1 ? 'BREAKING GROUND…' : p < 0.74 ? `INSTALLING ${Math.floor(this.plan.rackCount * p / 0.74)} / ${this.plan.rackCount} RACKS` : p < 0.94 ? 'CONNECTING THE GRID…' : 'LIGHTS ON. AMBITION UNLIMITED.';
    if (p >= 0.94 && !this.powered) { this.powered = true; audio.play('fanfare'); this.scene.cameras.main.flash(160, 190, 237, 153, false); }
    if (p === 1) {
      this.done = true; document.getElementById('build-light')?.classList.add('complete'); document.getElementById('skip-build')?.classList.add('hidden');
    }
  }
  skip() { this.elapsed = this.duration - 1; this.update(1); }
  destroy() { this.root.destroy(true); this.scene.children.getByName('infrastructure-count')?.destroy(); }
}
