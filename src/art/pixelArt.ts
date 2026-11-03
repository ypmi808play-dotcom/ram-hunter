import Phaser from 'phaser';
import { SAM_ART, SAM_FRAMES, paintSam } from './sam';

type Painter = (c: CanvasRenderingContext2D) => void;
const ink = '#263f48';
export const HOUSE_COLORS = [
  { wall: '#ecd8b6', shade: '#c9b99d', roof: '#7a9297', trim: '#f7edcf' },
  { wall: '#bed4c1', shade: '#95b4a2', roof: '#647d87', trim: '#f2e7cd' },
  { wall: '#d9b9ab', shade: '#bc9b93', roof: '#656d85', trim: '#f7dfbb' },
  { wall: '#bbc7d2', shade: '#97acbd', roof: '#6f8390', trim: '#e9e2ce' }
];

function texture(scene: Phaser.Scene, key: string, width: number, height: number, paint: Painter) {
  if (scene.textures.exists(key)) return;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const c = canvas.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  paint(c);
  scene.textures.addCanvas(key, canvas);
}

function rect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function poly(c: CanvasRenderingContext2D, points: number[][], color: string) {
  c.fillStyle = color; c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill();
}

function person(c: CanvasRenderingContext2D, kind: string, pose: string, frame: number) {
  const sam = kind === 'sam';
  const skin = sam ? '#eec7a9' : kind === 'engineer' ? '#cc947c' : '#e5b89c';
  const shirt =
    sam ? '#879fa8' :
    kind === 'eliteGuard' ? '#2c3d44' :
    kind === 'heavy' ? '#536b67' :
    kind === 'privateGuard' ? '#365d63' :
    kind === 'guard' ? '#475b78' :
    kind === 'alertResident' ? '#e0b354' :
    kind === 'engineer' ? '#a782af' : '#dc977b';
  const shade =
    sam ? '#5f7988' :
    kind === 'eliteGuard' ? '#1c282e' :
    kind === 'privateGuard' ? '#244247' :
    kind === 'guard' ? '#31445f' :
    kind === 'alertResident' ? '#b08432' : '#976d77';
  const run = pose === 'run';
  const bob = run ? frame % 2 : pose === 'idle' ? frame : 0;
  const handsUp = pose === 'victory';
  const y = bob;

  rect(c, 9, 4 + y, 15, 13, ink); rect(c, 8, 7 + y, 18, 7, ink);
  rect(c, 10, 5 + y, 13, 11, skin); rect(c, 23, 9 + y, 3, 4, skin);
  rect(c, 10, 3 + y, 13, 5, sam ? '#6f605b' : '#514d55');
  rect(c, 9, 5 + y, 4, 5, sam ? '#78665d' : '#514d55'); rect(c, 12, 3 + y, 8, 2, '#908074');
  rect(c, 20, 9 + y, 2, 2, ink); rect(c, 16, 9 + y, 1, 2, ink);
  rect(c, 20, 14 + y, 4, 1, '#a06b62'); rect(c, 12, 13 + y, 2, 2, '#e2ab92');

  if (kind === 'engineer') {
    rect(c, 14, 8 + y, 10, 4, ink); rect(c, 15, 9 + y, 3, 2, '#8bd6d2'); rect(c, 20, 9 + y, 3, 2, '#8bd6d2');
  }
  if (kind === 'alertResident') {
    // Neighborhood watch headband & alert eyebrows
    rect(c, 9, 5 + y, 15, 3, '#e87a48'); rect(c, 21, 5 + y, 4, 2, '#ffd984');
    rect(c, 15, 8 + y, 8, 1, ink);
  }
  if (kind === 'guard' || kind === 'privateGuard') {
    const capColor = kind === 'privateGuard' ? '#27494e' : '#31445f';
    const bandColor = kind === 'privateGuard' ? '#7ec4b8' : '#557496';
    rect(c, 8, 2 + y, 16, 4, capColor); rect(c, 12, 1 + y, 11, 2, bandColor); rect(c, 22, 5 + y, 6, 2, ink);
  }
  if (kind === 'heavy' || kind === 'eliteGuard') {
    const helmColor = kind === 'eliteGuard' ? '#2c3d44' : '#506761';
    const visorColor = kind === 'eliteGuard' ? '#ff8570' : '#8ec7bd';
    rect(c, 8, 1 + y, 18, 7, helmColor); rect(c, 10, 0 + y, 14, 3, '#809188'); rect(c, 12, 8 + y, 13, 4, visorColor);
  }

  rect(c, 14, 17 + y, 7, 3, skin);
  rect(c, 10, 20 + y, 14, 11, ink); rect(c, 11, 20 + y, 12, 10, shirt); rect(c, 11, 27 + y, 12, 3, shade);
  rect(c, 16, 20 + y, 3, 7, '#a8bac0');
  if (kind === 'guard' || kind === 'privateGuard') rect(c, 20, 22 + y, 2, 3, '#e0c084');
  if (kind === 'heavy' || kind === 'eliteGuard') {
    rect(c, 9, 19 + y, 16, 11, kind === 'eliteGuard' ? '#26383f' : '#334e47');
    rect(c, 12, 22 + y, 4, 5, kind === 'eliteGuard' ? '#e88b74' : '#71897a');
    rect(c, 18, 22 + y, 4, 5, kind === 'eliteGuard' ? '#e88b74' : '#71897a');
  }
  if (pose === 'collect') {
    rect(c, 23, 21 + y, 5, 4, shirt); rect(c, 26, 22 + y, 5, 3, skin);
    rect(c, 28, 20 + y + frame, 3, 2, '#a8ed99');
  } else if (handsUp) {
    rect(c, 7, 14, 4, 10, shirt); rect(c, 7, 11, 4, 5, skin);
    rect(c, 23, 13, 4, 11, shirt); rect(c, 23, 10, 4, 5, skin);
  } else {
    const arm = run ? [1, -2, 0, 3][frame % 4] : 1;
    rect(c, 7, 22 + y + arm, 4, 8, shade); rect(c, 7, 28 + y + arm, 4, 3, skin);
    rect(c, 23, 21 + y - arm, 4, 7, shirt); rect(c, 23, 27 + y - arm, 4, 3, skin);
    if (kind === 'privateGuard') {
      // Baton held in front hand
      rect(c, 26, 17 + y - arm, 3, 12, '#23383c');
      rect(c, 26, 16 + y - arm, 3, 3, '#a6e8d9');
    } else if (kind === 'eliteGuard') {
      // Tactical riot shield outline on front arm
      rect(c, 25, 17 + y, 5, 16, '#39555e');
      rect(c, 26, 19 + y, 3, 12, '#8de8d6');
    }
  }
  const leg = run ? [3, 0, -3, 0][frame % 4] : pose === 'jump' ? 3 : 0;
  rect(c, 11 + leg, 30 + y, 5, 7 - y, '#30495a'); rect(c, 19 - leg, 30 + y, 5, 7 - y, '#3f5867');
  rect(c, 10 + leg, 36, 7, 3, '#e5e1cf'); rect(c, 18 - leg, 36, 8, 3, '#e5e1cf');
  rect(c, 10 + leg, 39, 7, 1, ink); rect(c, 18 - leg, 39, 8, 1, ink);
  if (pose === 'hurt') { rect(c, 16, 9 + y, 2, 2, '#fff4e0'); rect(c, 20, 9 + y, 2, 2, '#fff4e0'); }
}

export function generatePixelAssets(scene: Phaser.Scene) {
  for (const [pose, count] of Object.entries(SAM_FRAMES)) {
    for (let f = 0; f < count; f++) texture(scene, `sam-${pose}-${f}`, SAM_ART.width, SAM_ART.height, c => paintSam(c, pose, f));
    scene.anims.create({
      key: `sam-${pose}`,
      frames: Array.from({ length: count }, (_, f) => ({ key: `sam-${pose}-${f}` })),
      frameRate: pose === 'run' || pose === 'attack' ? 14 : pose === 'crouch' ? 8 : 6,
      repeat: -1
    });
  }
  for (const kind of ['resident', 'guard', 'engineer', 'heavy', 'alertResident', 'privateGuard', 'eliteGuard']) {
    for (let f = 0; f < 4; f++) texture(scene, `${kind}-${f}`, 32, 40, c => person(c, kind, 'run', f));
    scene.anims.create({ key: `${kind}-run`, frames: Array.from({ length: 4 }, (_, f) => ({ key: `${kind}-${f}` })), frameRate: 9, repeat: -1 });
    texture(scene, `${kind}-idle`, 32, 40, c => person(c, kind, 'idle', 0));
    texture(scene, `${kind}-work`, 32, 40, c => person(c, kind, 'collect', 0));
    texture(scene, `${kind}-sleep`, 32, 40, c => {
      rect(c, 2, 31, 20, 8, kind === 'engineer' ? '#a782af' : '#d49a7a');
      rect(c, 1, 35, 11, 4, '#405b6b'); rect(c, 22, 28, 9, 10, '#e9bd9e');
      rect(c, 23, 27, 8, 3, '#60514c'); rect(c, 26, 32, 3, 1, '#3e4f52');
    });
  }

  // Enemy E: Indoor Security Robot (distinctive bipedal/tracked chassis with EMP coil & sensor visor)
  for (let f = 0; f < 4; f++) {
    texture(scene, `securityRobot-${f}`, 32, 40, c => {
      const bob = f % 2;
      rect(c, 14, 2 + bob, 4, 5, '#78b8bd'); rect(c, 15, 0 + bob, 2, 3, '#b5f7e6');
      rect(c, 7, 7 + bob, 18, 12, ink); rect(c, 8, 8 + bob, 16, 10, '#58787c');
      rect(c, 10, 10 + bob, 12, 5, '#1f3438'); rect(c, 14 + (f % 2), 11 + bob, 6, 3, '#8cf5e0');
      rect(c, 6, 19 + bob, 20, 12, ink); rect(c, 8, 20 + bob, 16, 10, '#415d63');
      // EMP side coils
      rect(c, 3, 21 + bob, 4, 7, '#8adfd2'); rect(c, 25, 21 + bob, 4, 7, '#8adfd2');
      rect(c, 11, 22 + bob, 10, 6, '#273d42'); rect(c, 13, 24 + bob, 6, 2, '#f2c97d');
      // Treads / legs
      rect(c, 7, 31, 18, 8, ink); rect(c, 9, 32, 14, 6, '#33474b');
      for (let i = 0; i < 3; i++) rect(c, 10 + i * 4 + (f % 2), 34, 2, 3, '#9cb5b0');
    });
  }
  scene.anims.create({
    key: 'securityRobot-run',
    frames: Array.from({ length: 4 }, (_, f) => ({ key: `securityRobot-${f}` })),
    frameRate: 8,
    repeat: -1
  });
  texture(scene, 'securityRobot-idle', 32, 40, c => {
    c.drawImage(scene.textures.get('securityRobot-0').getSourceImage() as HTMLCanvasElement, 0, 0);
  });

  texture(scene, 'ram', 28, 14, c => {
    rect(c, 1, 1, 26, 10, ink); rect(c, 2, 2, 24, 8, '#a5ed99'); rect(c, 3, 3, 22, 1, '#dbffc0');
    for (let i = 0; i < 4; i++) { rect(c, 4 + i * 6, 4, 4, 5, '#327462'); rect(c, 4 + i * 6, 11, 3, 3, '#edc474'); }
  });
  texture(scene, 'spark', 5, 5, c => { rect(c, 2, 0, 1, 5, '#dcffbf'); rect(c, 0, 2, 5, 1, '#dcffbf'); });
  texture(scene, 'money', 32, 20, c => {
    rect(c, 1, 5, 30, 14, '#416e58'); rect(c, 1, 2, 30, 14, '#91b879'); rect(c, 3, 3, 26, 10, '#c3dca0');
    rect(c, 5, 5, 22, 6, '#6f9e70'); rect(c, 13, 0, 6, 17, '#eddbac'); rect(c, 15, 0, 2, 17, '#d3b47e');
    rect(c, 4, 17, 25, 1, '#adc78f');
  });
  texture(scene, 'confusion', 14, 18, c => {
    rect(c, 4, 0, 7, 2, '#e4c1ff'); rect(c, 2, 2, 3, 3, '#e4c1ff'); rect(c, 9, 2, 3, 5, '#e4c1ff');
    rect(c, 6, 6, 5, 3, '#e4c1ff'); rect(c, 5, 9, 3, 3, '#e4c1ff'); rect(c, 5, 15, 3, 3, '#e4c1ff');
  });
  texture(scene, 'drone', 38, 24, c => {
    rect(c, 5, 3, 3, 11, ink); rect(c, 30, 3, 3, 11, ink); rect(c, 1, 2, 12, 2, '#bcc8b8'); rect(c, 25, 2, 12, 2, '#bcc8b8');
    rect(c, 7, 10, 25, 10, '#4b626d'); rect(c, 11, 8, 17, 12, '#849c9b'); rect(c, 15, 12, 10, 5, '#263e4b');
    rect(c, 20, 13, 3, 3, '#f5c989'); rect(c, 10, 20, 4, 3, '#344d56'); rect(c, 26, 20, 4, 3, '#344d56'); rect(c, 8, 13, 3, 2, '#e5aa85');
  });
  texture(scene, 'dust', 4, 4, c => { rect(c, 0, 1, 4, 3, '#e6dec1'); rect(c, 1, 0, 2, 1, '#e6dec1'); });
  texture(scene, 'enhanced-drone', 38, 24, c => {
    c.drawImage(scene.textures.get('drone').getSourceImage() as HTMLCanvasElement, 0, 0);
    rect(c, 11, 8, 17, 3, '#d0ad70'); rect(c, 16, 12, 9, 5, '#638b9c'); rect(c, 20, 13, 3, 3, '#d7edbc');
  });
  // Enemy F: Indoor Combat Drone (sleek crimson-gold chassis with glowing plasma core)
  texture(scene, 'combat-drone', 38, 24, c => {
    c.drawImage(scene.textures.get('drone').getSourceImage() as HTMLCanvasElement, 0, 0);
    rect(c, 9, 8, 21, 4, '#b85349'); rect(c, 11, 10, 17, 8, '#3d2830');
    rect(c, 15, 12, 10, 5, '#ff9478'); rect(c, 19, 13, 4, 3, '#fff3c4');
  });
  texture(scene, 'energy-drink', 18, 28, c => { rect(c, 3, 2, 12, 24, '#5d4652'); rect(c, 4, 3, 10, 22, '#e68da3'); rect(c, 5, 0, 8, 3, '#d2d9c9'); rect(c, 6, 1, 6, 1, '#778e88'); rect(c, 5, 6, 8, 15, '#f4b1c0'); rect(c, 8, 8, 3, 4, '#fff0d5'); rect(c, 6, 12, 5, 3, '#fff0d5'); rect(c, 7, 15, 3, 4, '#fff0d5'); rect(c, 5, 23, 8, 2, '#c5d0c5'); });
  texture(scene, 'security-bolt', 10, 10, c => { rect(c, 3, 0, 4, 10, '#e69aa0'); rect(c, 0, 3, 10, 4, '#e69aa0'); rect(c, 3, 3, 4, 4, '#ffdfb6'); });
  texture(scene, 'security-terminal-on', 28, 52, c => {
    rect(c, 2, 2, 24, 48, ink); rect(c, 4, 4, 20, 44, '#476568');
    rect(c, 6, 7, 16, 12, '#22383d'); rect(c, 8, 9, 12, 8, '#f09d7c');
    rect(c, 10, 11, 8, 2, '#ffe5cf'); rect(c, 7, 23, 6, 4, '#a8e89c'); rect(c, 15, 23, 6, 4, '#f2b880');
    for (let y = 31; y < 44; y += 4) rect(c, 7, y, 14, 2, '#304c4f');
  });
  texture(scene, 'security-terminal-off', 28, 52, c => {
    rect(c, 2, 2, 24, 48, ink); rect(c, 4, 4, 20, 44, '#476568');
    rect(c, 6, 7, 16, 12, '#22383d'); rect(c, 8, 9, 12, 8, '#6ea388');
    rect(c, 10, 12, 8, 2, '#d5f7c8'); rect(c, 7, 23, 6, 4, '#799c88'); rect(c, 15, 23, 6, 4, '#516c68');
    for (let y = 31; y < 44; y += 4) rect(c, 7, y, 14, 2, '#304c4f');
  });
  texture(scene, 'extract-van', 116, 56, c => {
    rect(c, 4, 16, 104, 30, ink); rect(c, 6, 18, 98, 26, '#3b645c');
    rect(c, 8, 20, 74, 12, '#628e80'); rect(c, 84, 20, 18, 12, '#99c9c4');
    rect(c, 6, 33, 98, 5, '#b3ee9c');
    rect(c, 18, 40, 16, 14, ink); rect(c, 78, 40, 16, 14, ink);
    rect(c, 22, 44, 8, 6, '#9eb5ae'); rect(c, 82, 44, 8, 6, '#9eb5ae');
    rect(c, 34, 8, 28, 8, '#304c4f'); rect(c, 44, 2, 8, 6, '#b3ee9c');
    rect(c, 46, 0, 4, 3, '#efffe0');
  });
  texture(scene, 'bed', 90, 40, c => { rect(c, 1, 8, 88, 28, '#7a7b69'); rect(c, 3, 5, 84, 27, '#e7dcc1'); rect(c, 27, 6, 60, 25, '#b77f86'); rect(c, 29, 7, 55, 3, '#d7a1a5'); rect(c, 8, 6, 18, 13, '#fbedd2'); rect(c, 4, 36, 6, 4, '#586d61'); rect(c, 81, 36, 6, 4, '#586d61'); });
  texture(scene, 'shelf', 32, 78, c => { rect(c, 0, 0, 32, 78, '#787d6b'); for (let y = 4; y < 72; y += 18) { rect(c, 3, y, 26, 14, '#d3c8a7'); for (let i = 0; i < 5; i++) rect(c, 4 + i * 5, y + 2, 4, 11, ['#6b918b', '#bd927e', '#d5b783'][i % 3]); } });
  texture(scene, 'tv', 44, 54, c => { rect(c, 1, 0, 42, 30, '#2a4952'); rect(c, 4, 3, 36, 24, '#81a5ad'); rect(c, 7, 7, 15, 15, '#b6d0b6'); rect(c, 24, 11, 12, 11, '#5d8999'); rect(c, 20, 30, 4, 8, '#627e79'); rect(c, 4, 38, 36, 5, '#ac9c7d'); rect(c, 7, 43, 3, 11, '#60786e'); rect(c, 34, 43, 3, 11, '#60786e'); });
  HOUSE_COLORS.forEach((p, variant) => texture(scene, `house-${variant}`, 144, 128, c => {
    rect(c, 8, 112, 128, 4, '#789785'); rect(c, 28, 60, 91, 53, ink); rect(c, 30, 60, 87, 51, p.wall);
    rect(c, 106, 60, 11, 51, p.shade);
    for (let y = 67; y < 108; y += 7) rect(c, 30, y, 76, 1, p.shade);
    rect(c, 20, 54, 108, 9, ink);
    poly(c, [[17, 54], [71, 12], [129, 54]], ink);
    poly(c, [[25, 51], [71, 17], [120, 51]], p.roof);
    for (let y = 28; y < 50; y += 6) rect(c, 52 - (y - 28), y, 39 + (y - 28) * 2, 2, variant % 2 ? '#566f7e' : '#657c86');
    rect(c, 98, 19, 10, 25, ink); rect(c, 99, 18, 9, 4, '#e4c9ae'); rect(c, 100, 23, 6, 15, '#aa9891');
    rect(c, 64, 80, 22, 33, p.trim); rect(c, 67, 82, 16, 29, '#455f62'); rect(c, 69, 84, 12, 10, '#c6ddc3'); rect(c, 78, 99, 2, 2, '#eac780');
    for (const x of [37, 91]) {
      rect(c, x - 2, 72, 20, 24, p.trim); rect(c, x, 74, 16, 19, '#405f70');
      rect(c, x + 2, 76, 6, 7, '#9bc9c9'); rect(c, x + 10, 76, 4, 7, '#7dafbc'); rect(c, x + 7, 74, 2, 19, p.trim); rect(c, x, 83, 16, 2, p.trim);
      rect(c, x - 3, 96, 22, 3, p.trim);
    }
    rect(c, 60, 112, 30, 3, '#b6b0a1'); rect(c, 56, 115, 38, 3, '#d2c8b1'); rect(c, 53, 118, 44, 3, '#b7b29d');
    for (let i = 0; i < 12; i++) rect(c, 8 + i * 11, 109 - i % 3, 6, 5, ['#7e9f7a', '#88ad80', '#6f9276'][i % 3]);
    rect(c, 15, 100, 3, 12, '#4d6765'); rect(c, 12, 98, 10, 6, '#d9b1a3'); rect(c, 12, 96, 10, 3, '#72908f');
    rect(c, 60, 121, 29, 7, '#bfbda8');
  }));
  texture(scene, 'tree', 60, 94, c => {
    rect(c, 27, 37, 8, 57, '#6b6d5c'); rect(c, 31, 43, 4, 51, '#525f55');
    rect(c, 16, 21, 31, 44, '#477965'); rect(c, 6, 31, 49, 22, '#477965');
    rect(c, 13, 15, 33, 34, '#65947a'); rect(c, 20, 6, 23, 43, '#65947a');
    rect(c, 9, 30, 21, 15, '#83ad86'); rect(c, 20, 11, 16, 20, '#83ad86'); rect(c, 31, 21, 17, 17, '#759f7d');
    rect(c, 8, 51, 18, 6, '#3b6d60'); rect(c, 37, 44, 17, 7, '#3b6d60');
  });
  texture(scene, 'cloud', 130, 42, c => {
    rect(c, 0, 22, 129, 13, '#f3efda'); rect(c, 14, 12, 88, 22, '#f3efda'); rect(c, 31, 2, 43, 31, '#f3efda'); rect(c, 73, 15, 40, 19, '#f3efda');
    rect(c, 4, 35, 117, 4, '#d6e4d5'); rect(c, 13, 39, 92, 3, '#d6e4d5');
  });
  texture(scene, 'skyline', 512, 156, c => {
    for (let i = 0; i < 32; i++) { const h = 15 + ((i * 31 + 17) % 80); rect(c, i * 17, 156 - h, 15, h, '#a2beb7'); rect(c, i * 17 + 3, 152 - h, 8, 4, '#a2beb7'); }
    for (let i = 0; i < 17; i++) { const h = 18 + ((i * 47) % 50); rect(c, i * 33, 156 - h, 29, h, '#87a99f'); }
  });
  texture(scene, 'fence', 52, 28, c => {
    rect(c, 0, 9, 52, 3, '#dbcbb1'); rect(c, 0, 21, 52, 3, '#bda98e');
    for (let x = 2; x < 52; x += 9) { rect(c, x, 4, 5, 24, '#e9dcc0'); rect(c, x + 1, 2, 3, 2, '#e9dcc0'); rect(c, x + 4, 5, 1, 23, '#baa88e'); }
  });
  texture(scene, 'lamp', 26, 104, c => {
    rect(c, 13, 10, 3, 94, '#546d6c'); rect(c, 10, 100, 9, 4, '#435c60'); rect(c, 5, 9, 12, 3, '#546d6c');
    rect(c, 2, 11, 9, 5, '#f3d99b'); rect(c, 4, 8, 7, 3, '#435c60'); rect(c, 15, 29, 10, 9, '#a3d4b0');
  });
  for (const gb of [4, 8, 16, 32, 64, 128, 256]) for (const state of ['on', 'blue', 'off']) texture(scene, `pc-${gb}-${state}`, 68, 46, c => {
    const laptop = gb === 4 || gb === 16;
    const tower = gb >= 32;
    rect(c, 4, 5, 39, 27, ink); rect(c, 6, 7, 35, 23, '#738b91');
    const screen = state === 'on' ? '#86d5ba' : state === 'blue' ? '#405ecd' : '#263d49';
    rect(c, 8, 9, 31, 19, screen);
    if (state === 'on') { rect(c, 11, 12, 15, 2, '#dcf3cc'); rect(c, 11, 17, 21, 1, '#3f8d81'); rect(c, 11, 20, 12, 1, '#3f8d81'); rect(c, 29, 22, 6, 3, '#bee1bd'); }
    if (state === 'blue') { rect(c, 12, 12, 2, 6, '#d8e3fc'); rect(c, 17, 12, 2, 6, '#d8e3fc'); rect(c, 12, 22, 18, 1, '#d8e3fc'); }
    rect(c, 21, 32, 6, 6, '#5c747c'); rect(c, 16, 38, 17, 3, ink);
    rect(c, laptop ? 2 : 7, 40, laptop ? 46 : 35, 4, '#a9bdba'); rect(c, 10, 40, 28, 2, '#60777c');
    if (tower) {
      rect(c, 49, 13, 16, 31, ink); rect(c, 51, 15, 12, 27, '#536b7b');
      for (const y of [21, 32]) { rect(c, 54, y - 3, 6, 6, state === 'on' ? (gb === 128 ? '#ecbe7f' : gb === 64 ? '#bba5e0' : '#8fe3c0') : '#374d58'); rect(c, 56, y - 1, 2, 2, ink); }
      rect(c, 53, 16, 2, 1, state === 'on' ? '#c7f6ad' : '#536b7b');
    }
  });
  texture(scene, 'desk', 82, 44, c => {
    rect(c, 2, 4, 78, 5, ink); rect(c, 2, 2, 78, 5, '#c4aa87'); rect(c, 6, 9, 5, 35, '#7d7d6a'); rect(c, 71, 9, 5, 35, '#7d7d6a');
    rect(c, 50, 10, 20, 20, '#ad957d'); rect(c, 52, 13, 16, 2, '#8a806e'); rect(c, 57, 17, 7, 2, '#d7b79a');
  });
  texture(scene, 'sofa', 82, 39, c => {
    rect(c, 8, 4, 66, 30, '#3f6968'); rect(c, 11, 2, 60, 28, '#72968b'); rect(c, 7, 22, 67, 11, '#5a827b');
    rect(c, 2, 16, 11, 19, '#7e9d8d'); rect(c, 69, 16, 11, 19, '#7e9d8d'); rect(c, 15, 23, 24, 4, '#9bb29a'); rect(c, 42, 23, 25, 4, '#9bb29a');
    rect(c, 8, 35, 5, 4, '#4a625d'); rect(c, 69, 35, 5, 4, '#4a625d'); rect(c, 17, 7, 14, 14, '#dec89e');
  });
  texture(scene, 'robot', 28, 15, c => {
    rect(c, 2, 6, 24, 7, ink); rect(c, 4, 2, 20, 10, '#bcc5bb'); rect(c, 7, 0, 14, 4, '#dae0c9'); rect(c, 9, 5, 10, 2, '#8caaa2'); rect(c, 20, 7, 3, 2, '#ee986f'); rect(c, 4, 13, 4, 2, ink); rect(c, 20, 13, 4, 2, ink);
  });
  texture(scene, 'server', 36, 72, c => {
    rect(c, 1, 1, 34, 70, '#233e48'); rect(c, 3, 3, 30, 66, '#45606a'); rect(c, 5, 5, 26, 62, '#2c444f');
    for (let y = 8; y < 64; y += 9) { rect(c, 7, y, 22, 6, '#5c747a'); rect(c, 9, y + 2, 12, 1, '#263f4b'); rect(c, 25, y + 2, 2, 2, '#a3ef9a'); }
    rect(c, 5, 69, 5, 3, '#152d37'); rect(c, 26, 69, 5, 3, '#152d37');
  });
  texture(scene, 'car', 104, 48, c => {
    rect(c, 6, 24, 90, 17, '#b99a62'); rect(c, 10, 21, 83, 17, '#e5c17e');
    poly(c, [[22, 23], [32, 6], [67, 6], [83, 23]], '#e5c17e'); poly(c, [[29, 21], [36, 9], [49, 9], [49, 21]], '#57767d'); poly(c, [[53, 9], [65, 9], [75, 21], [53, 21]], '#57767d');
    rect(c, 16, 34, 16, 14, ink); rect(c, 67, 34, 16, 14, ink); rect(c, 20, 38, 8, 7, '#80928f'); rect(c, 71, 38, 8, 7, '#80928f'); rect(c, 89, 27, 8, 5, '#fff0be'); rect(c, 7, 28, 4, 5, '#c97e70');
    rect(c, 34, 3, 34, 4, '#4f6c68'); rect(c, 38, 0, 26, 4, '#a9ed99');
  });
}
