import Phaser from 'phaser';
import { EXTRACTION, FEATURES, GAME, PROGRESSION_TIERS } from '../core/config';
import type { HouseData } from '../core/session';
import { HOUSE_TYPES } from '../core/houses';
import { HOUSE_EVENT_INFO } from '../core/HouseEventManager';
import type { AtticData, HouseEventType } from '../core/HouseEventManager';

export interface Parallax { clouds: Phaser.GameObjects.TileSprite; skyline: Phaser.GameObjects.TileSprite }

export function sky(scene: Phaser.Scene, darker = false): Parallax {
  scene.cameras.main.setBackgroundColor(darker ? '#adcac6' : '#c7dfd4');
  scene.add.rectangle(640, 122, 1280, 244, darker ? 0xb4cfc8 : 0xc9e1d7).setScrollFactor(0).setDepth(-20);
  scene.add.rectangle(640, 350, 1280, 255, 0xd8dfc6).setScrollFactor(0).setDepth(-20);
  const clouds = scene.add.tileSprite(0, 88, 1280, 180, 'cloud').setOrigin(0).setTileScale(2.2).setScrollFactor(0).setAlpha(0.7).setDepth(-18);
  clouds.setTileScale(3.8, 2.2);
  const skyline = scene.add.tileSprite(0, 210, 1280, 310, 'skyline').setOrigin(0).setTileScale(2).setScrollFactor(0).setAlpha(0.7).setDepth(-17);
  return { clouds, skyline };
}

export function street(scene: Phaser.Scene, houses: HouseData[]): Parallax {
  const parallax = sky(scene);
  const g = scene.add.graphics().setDepth(-10);
  g.fillStyle(0x90ad89).fillRect(0, 493, GAME.streetWidth, 96);
  g.fillStyle(0xabc29a).fillRect(0, 504, GAME.streetWidth, 57);
  g.fillStyle(0xd5ceb2).fillRect(0, 565, GAME.streetWidth, 23);
  g.fillStyle(0xa7ad9e).fillRect(0, 587, GAME.streetWidth, 5);
  g.fillStyle(0x4e6669).fillRect(0, 592, GAME.streetWidth, 128);
  g.fillStyle(0x405a60).fillRect(0, 594, GAME.streetWidth, 5);
  g.fillStyle(0xb8bea4);
  for (let x = 0; x < GAME.streetWidth; x += 160) g.fillRect(x, 665, 72, 5);
  for (let x = 0; x < GAME.streetWidth; x += 90) { g.fillStyle(0xb5b79f).fillRect(x, 566, 2, 19); g.fillStyle(0x5c7472).fillRect(x + 31, 610 + x % 19, 9, 2); }
  houses.forEach((h, i) => {
    const size = h.tier === 'EASY' ? 2.55 : h.tier === 'NORMAL' ? 2.9 : h.tier === 'HARD' ? 3.15 : h.tier === 'VERY_HARD' ? 3.35 : 3.6;
    scene.add.image(h.x, 568, `house-${h.palette}`).setOrigin(0.5, 1).setScale(size).setDepth(-4);
    scene.add.image(h.x + 294, 574, 'tree').setOrigin(0.5, 1).setScale(2.8).setDepth(-3);
    scene.add.image(h.x - 278, 586, 'lamp').setOrigin(0.5, 1).setScale(2.4).setDepth(-2);
    scene.add.text(h.x, 486, `${String(i + 1).padStart(2, '0')} / ${HOUSE_TYPES[h.type]}`, { fontFamily: 'monospace', fontSize: '13px', color: '#405b59', backgroundColor: '#e7dfc2', padding: { x: 7, y: 3 } }).setOrigin(0.5).setDepth(-1);
    const tierColor = PROGRESSION_TIERS[h.tier]?.color ?? 0xb6dd9b;
    scene.add.text(h.x, 521, h.tierLabel, { fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold', color: '#284b43', backgroundColor: `#${tierColor.toString(16).padStart(6, '0')}`, padding: { x: 10, y: 4 } }).setOrigin(.5).setDepth(0);
    if (h.specialEvent && FEATURES.houseEvents) {
      const evInfo = HOUSE_EVENT_INFO[h.specialEvent as HouseEventType];
      if (evInfo) {
        scene.add.text(h.x, 308, evInfo.badge, {
          fontFamily: 'monospace',
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#1b3532',
          backgroundColor: `#${evInfo.color.toString(16).padStart(6, '0')}`,
          padding: { x: 8, y: 3 }
        }).setOrigin(0.5).setDepth(0);
      }
    }
    if (h.tier === 'HARD' || h.tier === 'VERY_HARD' || h.tier === 'EXTREME') {
      const camera = scene.add.graphics().setDepth(-1); camera.fillStyle(0x3c5960).fillRect(h.x + 164, 401, 33, 18).fillRect(h.x + 178, 419, 6, 15); camera.fillStyle(0xb7df99).fillRect(h.x + 167, 405, 7, 7);
      if (h.tier === 'VERY_HARD' || h.tier === 'EXTREME') { for (const side of [-1, 1]) { camera.fillStyle(0x597875).fillRect(h.x + side * 224 - 7, 490, 14, 76); camera.fillStyle(0xd1bc82).fillRect(h.x + side * 224 - 10, 485, 20, 8); camera.lineStyle(3, 0x597875).lineBetween(h.x + side * 220, 518, h.x + side * 94, 518); } }
    }
    if (i % 3 === 1) scene.add.image(h.x - 186, 649, 'car').setScale(1.7).setAlpha(0.9).setDepth(4);
  });

  if (FEATURES.extraction) {
    for (const pt of EXTRACTION.points) {
      const van = scene.add.image(pt.x, 594, 'extract-van').setOrigin(0.5, 1).setScale(1.55).setDepth(-1);
      scene.tweens.add({ targets: van, y: 592, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      scene.add.text(pt.x, 488, `📡 ${pt.name}`, {
        fontFamily: 'monospace',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#183430',
        backgroundColor: '#b3ee9c',
        padding: { x: 7, y: 3 }
      }).setOrigin(0.5).setDepth(0);
    }
  }

  sign(scene, 110, 481, 'MAPLEWOOD', 'NO RAM LEFT BEHIND', 0xe8d9b1);
  sign(scene, 9800, 474, 'BUILD YOUR EMPIRE →', 'E / FINISH THE RUN', 0xa8e9a1);
  return parallax;
}

function sign(scene: Phaser.Scene, x: number, y: number, title: string, sub: string, color: number) {
  const g = scene.add.graphics().setDepth(-2);
  g.fillStyle(0x496462).fillRect(x - 68, y, 8, 108).fillRect(x + 68, y, 8, 108);
  g.fillStyle(0x2b494c).fillRect(x - 128, y - 42, 262, 72);
  g.fillStyle(color).fillRect(x - 124, y - 38, 254, 64);
  scene.add.text(x + 3, y - 25, title, { fontFamily: 'monospace', fontSize: '18px', fontStyle: 'bold', color: '#2c4a4c' }).setOrigin(0.5, 0).setDepth(-1);
  scene.add.text(x + 3, y + 2, sub, { fontFamily: 'monospace', fontSize: '10px', color: '#49645e' }).setOrigin(0.5, 0).setDepth(-1);
}

export function interior(scene: Phaser.Scene, h: HouseData, atticHatchX?: number, atticDiscovered = false) {
  const ground = GAME.interiorGround, w = h.width;
  const wall = { family: 0xe5d6bd, elderly: 0xe4d4c0, gamer: 0xc1c9d3, engineer: 0xc5d3c4, wealthy: 0xdfd3be, office: 0xcbd4c7, enthusiast: 0xd5d8bd, research: 0xb9cdcd }[h.type];
  scene.cameras.main.setBackgroundColor(wall);
  const g = scene.add.graphics().setDepth(-10);
  g.fillStyle(wall).fillRect(0, 0, Math.max(w, 1280), ground); g.fillStyle(0x708b7a).fillRect(w - 10, 145, 10, ground - 145);
  for (let x = 0; x < w; x += h.type === 'research' ? 48 : 32) g.fillStyle(0xf8edd2, .17).fillRect(x, 150, 2, ground - 150);
  g.fillStyle(0x98ab99).fillRect(0, 135, w, 9).fillRect(0, ground - 14, w, 7);
  g.fillStyle(0xeee0bc).fillRect(0, ground - 7, w, 7);
  g.fillStyle(h.type === 'research' ? 0x869c99 : 0xb3a38b).fillRect(0, ground, w, 130);
  for (let y = ground + 17; y < 720; y += 29) { g.fillStyle(0x7e8b7c, .38).fillRect(0, y, w, 2); for (let x = y % 60 * 3; x < w; x += 195) g.fillRect(x, y, 2, 29); }
  const d = h.doorX;
  g.fillStyle(0x516e6a).fillRect(d - 52, ground - 220, 104, 210);
  g.fillStyle(0xe5d4ae).fillRect(d - 46, ground - 214, 92, 204);
  g.fillStyle(0x7c9487).fillRect(d - 38, ground - 207, 76, 197);
  g.fillStyle(0xc7d9c0).fillRect(d - 30, ground - 194, 60, 66);
  g.fillStyle(0xe5c67e).fillRect(d + (d < w / 2 ? 25 : -30), ground - 100, 6, 6);
  scene.add.text(d, ground - 244, 'EXIT / E', { fontFamily: 'monospace', fontSize: '17px', color: '#45665c' }).setOrigin(.5).setDepth(-2);

  if (atticHatchX !== undefined) {
    g.fillStyle(0x4a5d52).fillRect(atticHatchX - 48, 132, 96, 16);
    g.fillStyle(0xd8c38f).fillRect(atticHatchX - 42, 135, 84, 10);
    const ladderBottom = atticDiscovered ? ground - 16 : 380;
    g.lineStyle(3, 0x8b7355, 0.85).lineBetween(atticHatchX - 18, 148, atticHatchX - 18, ladderBottom);
    g.lineStyle(3, 0x8b7355, 0.85).lineBetween(atticHatchX + 18, 148, atticHatchX + 18, ladderBottom);
    for (let ry = 172; ry < ladderBottom; ry += 28) {
      g.fillStyle(0xcbb389).fillRect(atticHatchX - 18, ry, 36, 4);
    }
    scene.add.text(atticHatchX, 162, atticDiscovered ? '🪜 ATTIC ROUTE / E' : '✦ SECRET HATCH / E', {
      fontFamily: 'monospace',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#2c4a3e',
      backgroundColor: '#f2dfb3',
      padding: { x: 6, y: 3 }
    }).setOrigin(0.5, 0).setDepth(-1);
  }

  for (let x = 300; x < w - 100; x += h.layout === 'hall' ? 410 : 510) {
    if (Math.abs(x - d) < 150) continue;
    const y = h.layout === 'loft' ? 210 : 246;
    g.fillStyle(0x7f978b).fillRect(x - 60, y, 120, 125);
    g.fillStyle(0xf4e5c2).fillRect(x - 54, y + 6, 108, 113);
    g.fillStyle(h.type === 'gamer' ? 0x7fa7b1 : 0xa8c7b7).fillRect(x - 47, y + 12, 94, 99);
    g.fillStyle(0xf4e5c2).fillRect(x - 3, y + 8, 6, 106).fillRect(x - 49, y + 55, 98, 6);
    g.fillStyle(h.type === 'elderly' ? 0xb39189 : 0x90a38c).fillRect(x - 74, y - 2, 19, 130).fillRect(x + 55, y - 2, 19, 130);
  }
  if (h.type === 'gamer') { g.fillStyle(0x8ab6b5).fillRect(0, 146, w, 4); for (let x = 0; x < w; x += 80) g.fillStyle([0x98c4bd, 0xb7acd2, 0xc7b3b2][Math.floor(x / 80) % 3]).fillRect(x, 146, 60, 4); }
  if (h.type === 'wealthy') for (let x = 180; x < w; x += 650) { g.fillStyle(0xe9dbb7).fillRect(x, 154, 17, ground - 170); g.fillStyle(0xb7a987).fillRect(x - 5, 154, 27, 8); }
  if (h.type === 'research' || h.type === 'engineer') {
    const x = w * .4; g.fillStyle(0x607e76).fillRect(x, 220, 130, 95); g.fillStyle(0xe1e3c7).fillRect(x + 5, 225, 120, 85);
    for (let i = 0; i < 5; i++) { g.fillStyle(0x86a69a).fillRect(x + 16, 240 + i * 12, 80 - i * 8, 2).fillRect(x + 24 + i * 13, 238, 2, 58); }
  }
  for (const p of h.platforms) {
    g.fillStyle(0x536f68).fillRect(p.x - p.width / 2, p.y, p.width, p.height); g.fillStyle(0xcac6a5).fillRect(p.x - p.width / 2, p.y, p.width, 5);
    g.fillStyle(0x759184).fillRect(p.x - p.width / 2 + 8, p.y + p.height, 6, ground - p.y - p.height);
  }
  for (const f of h.furniture) {
    if (f.kind === 'partition') { const partition = scene.add.graphics().setDepth(-1); partition.fillStyle(0x647f71).fillRect(f.x - f.width / 2, f.floorY - f.height, f.width, f.height); partition.fillStyle(0xa0b394).fillRect(f.x - f.width / 2 + 3, f.floorY - f.height + 3, f.width - 6, f.height - 6); partition.fillStyle(0x466b60).fillRect(f.x - 5, f.floorY - 8, 10, 8); }
    else { const key = f.kind === 'shelf' ? 'shelf' : f.kind === 'bed' ? 'bed' : f.kind === 'tv' ? 'tv' : f.kind; scene.add.image(f.x, f.floorY, key).setOrigin(.5, 1).setDisplaySize(f.width, f.height + (f.kind === 'desk' ? 6 : 0)).setDepth(-1); }
  }
  const carpet = h.furniture.find(f => f.kind === 'bed' || f.kind === 'sofa');
  if (carpet) { g.fillStyle(h.type === 'wealthy' ? 0xb49a8d : 0x93a58b).fillRect(carpet.x - 130, ground + 16, 260, 42); g.fillStyle(0xc7c6a3, .4).fillRect(carpet.x - 121, ground + 23, 242, 28); }
  const evText = h.specialEvent && FEATURES.houseEvents ? ` · ${HOUSE_EVENT_INFO[h.specialEvent as HouseEventType]?.badge ?? ''}` : '';
  scene.add.text(w / 2, 178, `${HOUSE_TYPES[h.type]} / ${h.layout.toUpperCase()} / ${h.tierLabel}${evText}`, { fontFamily: 'monospace', fontSize: '14px', color: '#507263', backgroundColor: '#e1dec2', padding: { x: 10, y: 5 } }).setOrigin(.5).setDepth(-2);
}

export function atticInterior(scene: Phaser.Scene, h: HouseData, attic: AtticData) {
  const ground = GAME.interiorGround, w = attic.width;
  scene.cameras.main.setBackgroundColor(0x302b27);
  const g = scene.add.graphics().setDepth(-10);
  g.fillStyle(0x423a32).fillRect(0, 0, Math.max(w, 1280), ground);
  g.fillStyle(0x635547).fillRect(0, 165, w, ground - 165);
  for (let x = 0; x < w; x += 64) {
    g.fillStyle(0x4d4136, 0.7).fillRect(x, 165, 8, ground - 165);
  }
  g.fillStyle(0x3a3028).fillRect(0, 155, w, 14);
  g.fillStyle(0x8c775c).fillRect(0, ground - 10, w, 10);
  g.fillStyle(0x4e4237).fillRect(0, ground, Math.max(w, 1280), 130);

  const lx = attic.exitLadderX;
  g.fillStyle(0x2a231d).fillRect(lx - 38, ground - 12, 76, 22);
  g.lineStyle(4, 0xcab183).lineBetween(lx - 18, ground - 160, lx - 18, ground + 20);
  g.lineStyle(4, 0xcab183).lineBetween(lx + 18, ground - 160, lx + 18, ground + 20);
  for (let ry = ground - 140; ry <= ground + 10; ry += 26) {
    g.fillStyle(0xe0cba3).fillRect(lx - 18, ry, 36, 4);
  }
  scene.add.text(lx, ground - 190, 'DOWN TO ROOM / E', {
    fontFamily: 'monospace',
    fontSize: '14px',
    fontStyle: 'bold',
    color: '#f4e7c8',
    backgroundColor: '#3f5950',
    padding: { x: 7, y: 4 }
  }).setOrigin(0.5).setDepth(-2);

  for (const p of attic.platforms) {
    g.fillStyle(0x536f68).fillRect(p.x - p.width / 2, p.y, p.width, p.height);
    g.fillStyle(0xd8c38f).fillRect(p.x - p.width / 2, p.y, p.width, 5);
  }
  for (const f of attic.obstacles) {
    if (f.kind === 'partition') {
      const partition = scene.add.graphics().setDepth(-1);
      partition.fillStyle(0x647f71).fillRect(f.x - f.width / 2, f.floorY - f.height, f.width, f.height);
      partition.fillStyle(0xa0b394).fillRect(f.x - f.width / 2 + 3, f.floorY - f.height + 3, f.width - 6, f.height - 6);
    } else {
      scene.add.image(f.x, f.floorY, f.kind).setOrigin(0.5, 1).setDisplaySize(f.width, f.height + (f.kind === 'desk' ? 6 : 0)).setDepth(-1);
    }
  }
  scene.add.text(w / 2, 195, `🪜 SECRET ATTIC / ${HOUSE_TYPES[h.type]}`, {
    fontFamily: 'monospace',
    fontSize: '14px',
    fontStyle: 'bold',
    color: '#2e4a41',
    backgroundColor: '#e9d8ab',
    padding: { x: 10, y: 4 }
  }).setOrigin(0.5).setDepth(-2);
}

export function titleArt(scene: Phaser.Scene) {
  sky(scene, true);
  const g = scene.add.graphics();
  g.fillStyle(0x90ab8d).fillRect(0, 490, 1280, 106);
  g.fillStyle(0xd1ccb1).fillRect(0, 576, 1280, 15);
  g.fillStyle(0x4d6669).fillRect(0, 591, 1280, 129);
  for (let x = 0; x < 1280; x += 155) g.fillStyle(0xb8bea4).fillRect(x, 672, 75, 5);
  scene.add.image(970, 572, 'house-0').setOrigin(0.5, 1).setScale(3.5);
  scene.add.image(1210, 579, 'tree').setOrigin(0.5, 1).setScale(3.2);
  scene.add.image(723, 580, 'tree').setOrigin(0.5, 1).setScale(2.2);
  for (let i = 0; i < 3; i++) {
    const rack = scene.add.image(1098 + i * 39, 562, 'server').setOrigin(0.5, 1).setScale(1.08).setDepth(2);
    scene.tweens.add({ targets: rack, alpha: { from: 0.8, to: 1 }, duration: 650 + i * 140, yoyo: true, repeat: -1 });
  }
  scene.add.image(820, 654, 'car').setOrigin(0.5, 1).setScale(2.9).setDepth(5);
  const hero = scene.add.sprite(966, 586, 'sam-idle-0').setOrigin(0.5, 1).setScale(3.2).setDepth(6).play('sam-victory');
  scene.tweens.add({ targets: hero, y: 582, duration: 850, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  for (let i = 0; i < 5; i++) {
    const ram = scene.add.image(796 + (i % 3) * 110, 190 + i * 39, 'ram').setScale(1.4 + i % 2 * 0.4).setRotation((i - 2) * 0.11).setDepth(7);
    scene.tweens.add({ targets: ram, y: ram.y - 15, duration: 1000 + i * 130, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 120 });
  }
  const shade = scene.add.graphics().setDepth(10);
  shade.fillStyle(0x173134, 0.97).fillRect(0, 0, 621, 720);
  shade.fillStyle(0x173134, 0.94).fillRect(621, 0, 30, 720);
  shade.fillStyle(0x173134, 0.8).fillRect(651, 0, 24, 720);
  shade.fillStyle(0x173134, 0.42).fillRect(675, 0, 12, 720);
  shade.fillStyle(0xa9e79c, 0.07);
  for (let y = 0; y < 720; y += 24) for (let x = 0; x < 620; x += 24) shade.fillRect(x, y, 2, 2);
}
