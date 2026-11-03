export const GAME_TITLE = {
  english: 'For the Greater Compute',
  subtitle: 'すべてのRAMは、データセンターのために。',
  brand: 'RAM HUNTER'
} as const;

export const GAME = {
  width: 1280, height: 720, durationMs: 270_000, lives: 3,
  gravity: 1450, walkSpeed: 320, dashSpeed: 520, acceleration: 2600,
  jumpSpeed: 580, coyoteMs: 105, jumpBufferMs: 125, invincibleMs: 1750,
  collectMs: 1050, streetGround: 588, houseCount: 14, houseSpacing: 660,
  streetWidth: 10_040, interiorWidth: 1640, interiorGround: 590
} as const;

export const FEATURES = {
  stealth: true,
  noise: true,
  houseEvents: true,
  extraction: true,
  riskModeDefault: false,
  debugStealth: false
};

export const STEALTH = {
  crouchSpeedRatio: 0.55,
  crouchVisionRatio: 0.6,
  crouchEyeHeightOffset: 22,
  standEyeHeightOffset: 40,
  noiseCooldownMs: 800,
  suspiciousMs: 950,
  noiseSearchMs: 3200,
  sleepWakeThreshold: 45,
  sleepDecayPerSecond: 12,
  noiseLevels: {
    crouchWalk: { volume: 5, radius: 35 },
    walk: { volume: 15, radius: 90 },
    jumpLand: { volume: 25, radius: 130 },
    collect: { volume: 30, radius: 150 },
    dash: { volume: 35, radius: 180 },
    attack: { volume: 45, radius: 210 },
    special: { volume: 65, radius: 280 },
    alarm: { volume: 100, radius: 10_000 }
  }
};
export type NoiseAction = keyof typeof STEALTH.noiseLevels;

export const VISION_PROFILES = {
  resident:      { fovDeg: 110, range: 210, speedMul: 1.0,  verticalRange: 110 },
  engineer:      { fovDeg: 115, range: 220, speedMul: 1.05, verticalRange: 110 },
  alertResident: { fovDeg: 120, range: 255, speedMul: 1.25, verticalRange: 120 },
  privateGuard:  { fovDeg: 125, range: 270, speedMul: 1.4,  verticalRange: 125 },
  guard:         { fovDeg: 125, range: 310, speedMul: 1.45, verticalRange: 125 },
  eliteGuard:    { fovDeg: 135, range: 330, speedMul: 1.75, verticalRange: 135 },
  heavy:         { fovDeg: 135, range: 320, speedMul: 1.65, verticalRange: 130 },
  securityRobot: { fovDeg: 140, range: 300, speedMul: 1.45, verticalRange: 130 },
  drone:         { fovDeg: 135, range: 380, speedMul: 1.5,  verticalRange: 230 },
  enhancedDrone: { fovDeg: 140, range: 380, speedMul: 1.6,  verticalRange: 230 },
  combatDrone:   { fovDeg: 145, range: 360, speedMul: 1.7,  verticalRange: 240 },
  robot:         { fovDeg: 0,   range: 0,   speedMul: 0,    verticalRange: 0   },
  camera:        { fovDeg: 90,  range: 370, speedMul: 1.85, verticalRange: 220 }
} as const;

export const DETECTION = {
  maxGauge: 100,
  suspiciousThreshold: 1,
  alertThreshold: 40,
  confirmedThreshold: 100,
  closeDistanceRatio: 0.40,
  midDistanceRatio: 0.75,
  closeRatePerSec: 100,
  midRatePerSec: 65,
  farRatePerSec: 35,
  crouchRateMultiplier: 0.48,
  collectingRateMultiplier: 1.35,
  pointBlankDistance: 56,
  decayPerSec: 28
} as const;

export type ProgressionTier = 'EASY' | 'NORMAL' | 'HARD' | 'VERY_HARD' | 'EXTREME';
export const PROGRESSION_TIERS: Record<ProgressionTier, {
  label: string;
  minHouse: number;
  maxHouse: number;
  minRamGB: number;
  maxRamGB: number;
  color: number;
}> = {
  EASY:      { label: 'EASY',      minHouse: 1,  maxHouse: 3,  minRamGB: 4,   maxRamGB: 16,  color: 0xb6dd9b },
  NORMAL:    { label: 'NORMAL',    minHouse: 4,  maxHouse: 6,  minRamGB: 16,  maxRamGB: 64,  color: 0xe8d6a0 },
  HARD:      { label: 'HARD',      minHouse: 7,  maxHouse: 10, minRamGB: 32,  maxRamGB: 128, color: 0xe6b38e },
  VERY_HARD: { label: 'VERY HARD', minHouse: 11, maxHouse: 13, minRamGB: 64,  maxRamGB: 256, color: 0xe5988e },
  EXTREME:   { label: 'EXTREME',   minHouse: 14, maxHouse: 14, minRamGB: 128, maxRamGB: 512, color: 0xd5b4e8 }
} as const;

export const RISK_MODE = {
  lossRates: {
    goal: 0,
    extract: 0,
    boss_win: 0,
    life: 0.20,
    time: 0.10,
    boss_loss: 0.20
  }
};

export const EXTRACTION = {
  holdMs: 900,
  interactRadius: 72,
  points: [
    { id: 'extract:start', name: 'START EXTRACT', label: 'スタート地点付近・撤退バン', x: 260 },
    { id: 'extract:mid', name: 'MIDPOINT EXTRACT', label: 'ステージ中盤・中継撤退バン', x: 5460 }
  ]
} as const;

export const HOUSE_EVENT_CONFIG = {
  minEventsPerRun: 2,
  maxEventsPerRun: 4,
  jackpotMultipliers: [1.5, 2.0] as const,
  alarmPcMultiplier: 1.5,
  emptyHouseMultiplier: 0.75,
  atticWidth: 920
} as const;

export const RUN_MODES = {
  normal: { label: 'NORMAL', durationMs: 270_000 },
  classic: { label: 'CLASSIC', durationMs: 180_000 }
} as const;
export type RunMode = keyof typeof RUN_MODES;

export const PC_TYPES = [
  { gb: 4, name: '古いノートPC', short: 'OLD LAPTOP', color: 0xa9b7b4 },
  { gb: 8, name: '一般家庭用PC', short: 'FAMILY PC', color: 0xe8c8a3 },
  { gb: 16, name: '高性能ノートPC', short: 'PRO LAPTOP', color: 0xc8d7db },
  { gb: 32, name: 'ゲーミングPC', short: 'GAMING RIG', color: 0x9ce6cf },
  { gb: 64, name: 'ハイエンドPC', short: 'HIGH-END PC', color: 0xbdafe0 },
  { gb: 128, name: 'ワークステーション', short: 'WORKSTATION', color: 0xf0b86e },
  { gb: 256, name: 'AIワークステーション', short: 'AI WORKSTATION', color: 0xe9c379 }
] as const;

export const GROWTH_LEVELS = [
  { min: 0, name: 'THE HUMBLE RACK', label: '小さなサーバーラック', quote: '壮大な夢も、まずはコンセントから。' },
  { min: 32, name: 'BEDROOM CLOUD', label: '自宅のサーバールーム', quote: 'おめでとう。寝室はもうサーバールームです。' },
  { min: 128, name: 'STARTUP SCALE', label: '小型データセンター', quote: 'ご近所のPCが、急に静かになりました。' },
  { min: 256, name: 'SERIOUS COMPUTE', label: '大型データセンター', quote: '冷却費のことは、未来の自分に任せよう。' },
  { min: 512, name: 'CAMPUS OF AMBITION', label: '複数棟のデータセンター', quote: '街のRAMが、足りなくなってきた。' },
  { min: 1024, name: 'THE AI EMPIRE', label: '超巨大AIデータセンター都市', quote: 'AGIまで、あと何GB？' }
] as const;

export const STAGES = [
  { id: 'suburb', name: 'MAPLEWOOD SUBURBS', subtitle: '01 / 郊外の住宅街', implemented: true },
  { id: 'heights', name: 'SILICON HEIGHTS', subtitle: '高級住宅街', implemented: false },
  { id: 'gaming', name: 'RGB DISTRICT', subtitle: 'ゲーミングPC愛好家の街', implemented: false },
  { id: 'engineers', name: 'STACK OVERFLOW LANE', subtitle: 'ITエンジニアの住宅街', implemented: false },
  { id: 'research', name: 'THE BIG TECH LAB', subtitle: '巨大テック企業の研究施設', implemented: false }
] as const;
