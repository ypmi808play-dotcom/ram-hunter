/** Original hand-authored pixel caricature. No photographs, tracing or external assets. */
export const SAM_ART = { width: 48, height: 64, scale: 1.5, bodyWidth: 28, bodyHeight: 58 } as const;
export const SAM_FRAMES = { idle: 4, run: 6, jump: 2, collect: 4, hurt: 2, victory: 4, attack: 3, cast: 4, crouch: 4 } as const;

export function paintSam(c: CanvasRenderingContext2D, pose: string, frame: number) {
  const r = (x: number, y: number, w: number, h: number, color: string) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
  const p = (points: number[][], color: string) => { c.fillStyle = color; c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); };
  const running = pose === 'run', crouching = pose === 'crouch', happy = pose === 'collect' || pose === 'victory';
  const crouchDrop = crouching ? 11 + (frame % 2) : 0;
  const bob = running ? [0, 1, 1, 0, 1, 1][frame % 6] : pose === 'idle' ? Math.floor(frame / 2) : crouchDrop;
  const stride = running ? [-4, -2, 2, 4, 2, -2][frame % 6] : crouching ? [-2, 0, 2, 0][frame % 4] : pose === 'jump' ? (frame ? 3 : 5) : 0;
  const ink = '#28343c', skin = '#f0cfb7', skinShade = '#cda591', hair = '#493b35';

  if (crouching) {
    // Bent knees and low stealth stance
    r(14 + stride, 52, 8, 8, '#293b4b'); r(27 - stride, 52, 8, 8, '#34495a');
    r(13 + stride, 59, 10, 4, '#d7d9cf'); r(26 - stride, 59, 10, 4, '#e9e7d8');
    r(13 + stride, 63, 10, 1, ink); r(26 - stride, 63, 10, 1, ink);
  } else {
    // Separate legs and shoes give six distinct run silhouettes.
    r(16 + stride, 48, 7, 13, '#293b4b'); r(28 - stride, 48, 7, 13, '#34495a');
    r(15 + stride, 59, 10, 4, '#d7d9cf'); r(27 - stride, 59, 10, 4, '#e9e7d8');
    r(15 + stride, 63, 10, 1, ink); r(27 - stride, 63, 10, 1, ink);
  }

  c.save(); c.translate(crouching ? 2 : 0, bob);
  // A tapered jaw, high forehead, asymmetric short hair and subtle cheek shading.
  p([[18, 8], [22, 5], [29, 6], [33, 10], [34, 15], [34, 22], [32, 22], [32, 25], [30, 25], [30, 28], [24, 29], [21, 27], [18, 23], [16, 19], [16, 12]], ink);
  p([[19, 9], [23, 7], [29, 8], [32, 12], [33, 18], [32, 23], [29, 27], [25, 28], [21, 25], [18, 21], [18, 14]], skin);
  r(17, 16, 3, 6, skinShade); r(18, 16, 2, 4, '#edc5ad');
  r(20, 22, 2, 3, '#ddb19a'); r(22, 25, 3, 2, '#ddb19a'); r(31, 19, 4, 3, skin); r(33, 21, 2, 1, skinShade);
  p([[16, 8], [18, 8], [18, 5], [21, 5], [21, 3], [28, 3], [28, 4], [32, 4], [32, 6], [34, 6], [34, 10], [32, 10], [32, 12], [29, 12], [29, 10], [23, 10], [23, 11], [20, 11], [20, 17], [17, 17], [17, 13], [16, 13]], hair);
  r(20, 6, 6, 2, '#695045'); r(27, 6, 4, 1, '#695045'); r(18, 9, 2, 5, '#5b463b'); r(20, 12, 1, 5, '#806150');
  r(23, 14, 4, 1, '#6b4e43'); r(30, 14, 3, 1, '#6b4e43');
  if (pose === 'hurt') {
    r(23, 17, 3, 1, ink); r(30, 17, 3, 1, ink); r(27, 24, 4, 1, '#855e53');
  } else if (happy) {
    r(23, 16, 3, 1, ink); r(22, 17, 1, 1, ink); r(30, 16, 3, 1, ink);
    r(26, 23, 6, 3, '#9a6a5e'); r(26, 23, 6, 1, '#fff1dc'); r(27, 26, 4, 1, skinShade);
  } else {
    r(23, 17, 4, 2, '#fff0db'); r(30, 17, 3, 2, '#fff0db'); r(25, 17, 2, 2, '#4d646d'); r(31, 17, 2, 2, '#4d646d');
    r(26, 24, 5, 1, '#9d7161'); r(31, 23, 1, 1, '#9d7161');
    if (pose === 'idle' && frame === 3) { r(23, 17, 4, 2, skin); r(30, 17, 3, 2, skin); r(23, 18, 3, 1, ink); r(30, 18, 3, 1, ink); }
  }
  r(24, 28, 7, 5, skinShade); r(25, 29, 5, 4, skin);
  // Charcoal sweater, narrow neckline and a ribbed hem.
  const torsoH = crouching ? 12 : 16;
  r(17, 33, 17, torsoH, '#30343b'); r(14, 35, 23, crouching ? 8 : 11, '#3d4148'); r(19, 32, 14, 3, '#4e5056');
  r(23, 32, 8, 2, '#626065'); r(24, 32, 6, 1, skinShade); r(20, 36, 2, crouching ? 6 : 9, '#4b4e54');
  const hemY = crouching ? 42 : 46;
  r(17, hemY, 18, 3, '#292e35'); for (let i = 0; i < 6; i++) r(18 + i * 3, hemY, 1, 3, '#46474b');
  if (pose === 'victory' || pose === 'cast') {
    r(11, 28, 6, 12, '#3d4148'); r(10, 25, 5, 6, skin); r(9, 23, 2, 4, skin);
    r(35, 28, 6, 12, '#4b4d53'); r(37, 24, 5, 6, skin); r(41, 22, 2, 5, skin);
    if (pose === 'cast') { r(8, 17 - frame % 2 * 2, 2, 4, '#bdffb0'); r(5, 19 - frame % 2 * 2, 7, 1, '#bdffb0'); r(40, 15 + frame % 2, 5, 2, '#b8e9e1'); }
  } else if (pose === 'attack') {
    const reach = frame === 0 ? 2 : frame === 1 ? 9 : 6;
    r(33, 36, 5 + reach, 5, '#4b4d53'); r(36 + reach, 36, 3, 4, skin); r(12, 38, 6, 9, '#30343b'); r(12, 45, 5, 4, skin);
  } else if (pose === 'collect') {
    r(33, 36, 8, 5, '#4b4d53'); r(39, 37, 5, 4, skin); r(14, 38, 4, 9, '#30343b'); r(14, 45, 4, 4, skin);
    r(41, 34 - frame % 2, 7, 3, '#a6ee9c'); r(43, 35 - frame % 2, 2, 1, '#346b54');
  } else if (crouching) {
    const swing = stride;
    r(12, 35 + swing, 6, 8, '#30343b'); r(12, 42 + swing, 5, 3, skin);
    r(33, 35 - swing, 6, 7, '#4b4d53'); r(35, 41 - swing, 4, 3, skin);
  } else {
    const swing = running ? -stride : 0;
    r(11, 36 + swing, 6, 11, '#30343b'); r(11, 45 + swing, 5, 4, skin);
    r(34, 36 - swing, 5, 10, '#4b4d53'); r(34, 44 - swing, 4, 4, skin);
  }
  c.restore();
}
