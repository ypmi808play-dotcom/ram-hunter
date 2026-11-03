import { GAME, PROGRESSION_TIERS } from './config.ts';
import type { ProgressionTier } from './config.ts';
import { seededRandom } from './random.ts';
import type { EnemyKind, ResidentActivity } from './enemies.ts';

export type Difficulty = 'EASY' | 'NORMAL' | 'HARD' | 'EXTREME';
export const HOUSE_TYPES = {
  family: '一般家庭', elderly: '高齢者の住宅', gamer: 'ゲーマーの家', engineer: 'ITエンジニアの家',
  wealthy: '富裕層の住宅', office: '小規模オフィス兼住宅', enthusiast: '電子機器マニアの住宅', research: '個人AI研究室'
} as const;
export type HouseType = keyof typeof HOUSE_TYPES;

export interface PCData {
  id: string;
  gb: number;
  x: number;
  floorY: number;
  tierBonusGb?: number;
  bonusGb?: number;
  eventTag?: 'ALARM_PC' | 'RAM_JACKPOT' | 'ATTIC_ROUTE' | 'EMPTY_HOUSE';
}

export function effectivePcRam(pc: PCData): number {
  return Math.max(4, Math.round(pc.gb + (pc.tierBonusGb ?? 0) + (pc.bonusGb ?? 0)));
}

export interface FurnitureData {
  id: string;
  kind: 'desk' | 'sofa' | 'bed' | 'shelf' | 'partition' | 'tv';
  x: number;
  floorY: number;
  width: number;
  height: number;
  solid: boolean;
  blocksSight: boolean;
}
export interface PlatformData { x: number; y: number; width: number; height: number }
export interface ResidentData { id: string; kind: EnemyKind; x: number; y: number; activity: ResidentActivity; facing: number }
export interface SecurityCameraData {
  id: string;
  x: number;
  y: number;
  range: number;
  fovDeg: number;
  sweepPeriodMs: number;
}

export interface HouseData {
  id: number;
  x: number;
  palette: number;
  type: HouseType;
  difficulty: Difficulty;
  tier: ProgressionTier;
  tierLabel: string;
  layout: string;
  width: number;
  doorX: number;
  spawnX: number;
  pcs: PCData[];
  furniture: FurnitureData[];
  platforms: PlatformData[];
  residents: ResidentData[];
  alarmX?: number;
  security: ResidentData[];
  cameras: SecurityCameraData[];
  allowIndoorSecurity: boolean;
  specialEvent?: string;
}

export const DIFFICULTY_COLORS = { EASY: 0xb6dd9b, NORMAL: 0xe8d6a0, HARD: 0xe6b38e, EXTREME: 0xd5b4e8 } as const;
export const HOUSE_REWARDS = {
  EASY: { minPCs: 1, maxPCs: 2, capacities: [4, 8, 16] },
  NORMAL: { minPCs: 2, maxPCs: 3, capacities: [16, 32, 64] },
  HARD: { minPCs: 2, maxPCs: 4, capacities: [32, 64, 128] },
  EXTREME: { minPCs: 3, maxPCs: 4, capacities: [64, 128, 256] }
} as const;

const assignments: { type: HouseType; layout: string; width: number }[] = [
  { type: 'family', layout: 'studio', width: 1120 }, { type: 'elderly', layout: 'retreat', width: 1260 },
  { type: 'gamer', layout: 'split', width: 1340 }, { type: 'engineer', layout: 'studio', width: 1280 },
  { type: 'enthusiast', layout: 'gallery', width: 1400 }, { type: 'family', layout: 'hall', width: 1600 },
  { type: 'gamer', layout: 'loft', width: 1780 }, { type: 'wealthy', layout: 'hall', width: 1880 },
  { type: 'office', layout: 'office', width: 1860 }, { type: 'enthusiast', layout: 'split', width: 1820 },
  { type: 'engineer', layout: 'office', width: 2060 }, { type: 'wealthy', layout: 'loft', width: 2140 },
  { type: 'office', layout: 'gallery', width: 2200 }, { type: 'research', layout: 'laboratory', width: 2300 }
];

export function houseTierForIndex(id: number): ProgressionTier {
  if (id < 3) return 'EASY';
  if (id < 6) return 'NORMAL';
  if (id < 10) return 'HARD';
  if (id < 13) return 'VERY_HARD';
  return 'EXTREME';
}

export function createNeighborhood(seed: number): HouseData[] {
  const random = seededRandom(seed);
  return assignments.map((a, id) => {
    const difficulty: Difficulty = id < 5 ? 'EASY' : id < 10 ? 'NORMAL' : id < 13 ? 'HARD' : 'EXTREME';
    const tier = houseTierForIndex(id);
    const tierCfg = PROGRESSION_TIERS[tier];
    const reward = HOUSE_REWARDS[difficulty], width = a.width + Math.floor(random() * 3) * 20;
    const count = id === 0 ? 1 : reward.minPCs + Math.floor(random() * (reward.maxPCs - reward.minPCs + 1));
    const doorX = id % 3 === 1 ? width - 100 : 100;

    const pcs: PCData[] = Array.from({ length: count }, (_, j) => {
      const forced: Record<number, number> = { 0: 8, 1: 4, 2: 16, 5: 32, 6: 64, 10: 128, 11: 128, 12: 128, 13: 256 };
      const gb = j === 0 && forced[id] ? forced[id] : reward.capacities[Math.floor(random() * reward.capacities.length)];
      const x = Math.round((count === 1 ? width * 0.66 : 420 + j * (width - 740) / (count - 1)) + (id === 0 ? 0 : Math.floor(random() * 31) - 15));
      const elevated = (a.layout === 'loft' || a.layout === 'laboratory' || a.layout === 'gallery' && id > 4) && j === count - 1;

      // Scale effective RAM to match the 5-tier progression curve while keeping base `gb` in PC_TYPES
      let tierBonusGb = 0;
      if (tier === 'NORMAL' && gb < 16) tierBonusGb = 16 - gb;
      else if (tier === 'HARD' && gb < 32) tierBonusGb = 32 - gb;
      else if (tier === 'VERY_HARD') {
        if (id !== 10 || j > 0) {
          if (gb < 64) tierBonusGb = 64 - gb;
          else if (gb === 128 && j === count - 1) tierBonusGb = 128; // 256GB top-end in VERY_HARD
        }
      } else if (tier === 'EXTREME') {
        if (gb < 128) tierBonusGb = 128 - gb;
        else if (gb === 256 && j === 0) tierBonusGb = 256; // 512GB flagship AI rack in EXTREME!
      }
      return { id: `${id}:${j}`, gb, tierBonusGb: tierBonusGb || undefined, x, floorY: elevated ? 440 : GAME.interiorGround };
    });

    const furniture: FurnitureData[] = pcs.map(pc => ({
      id: `desk:${pc.id}`,
      kind: 'desk',
      x: pc.x,
      floorY: pc.floorY,
      width: 148,
      height: 58,
      solid: true,
      blocksSight: false
    }));
    const platforms: PlatformData[] = [];
    for (const pc of pcs.filter(p => p.floorY === 440)) {
      platforms.push({ x: pc.x, y: 440, width: 330, height: 16 }, { x: pc.x - 220, y: 520, width: 110, height: 16 });
    }
    const freeSlots = [0.22, 0.36, 0.54, 0.72, 0.85].map(n => Math.round(width * n)).filter(x =>
      Math.abs(x - doorX) > 180 &&
      pcs.every(pc => Math.abs(pc.x - x) > 155) &&
      platforms.every(p => Math.abs(p.x - x) > p.width / 2 + 60)
    );
    const fallbackSlots = Array.from({ length: Math.ceil((width - 360) / 20) }, (_, k) => 180 + k * 20).filter(x =>
      Math.abs(x - doorX) > 180 &&
      pcs.every(pc => Math.abs(pc.x - x) > 170) &&
      platforms.every(p => Math.abs(p.x - x) > p.width / 2 + 80)
    );
    const livingX = freeSlots[0] ?? fallbackSlots[0] ?? width * 0.25;
    const livingKind = a.type === 'elderly' ? 'bed' : 'sofa';
    furniture.push({
      id: `${id}:living`,
      kind: livingKind,
      x: livingX,
      floorY: GAME.interiorGround,
      width: livingKind === 'bed' ? 172 : 152,
      height: 43,
      solid: id !== 0,
      blocksSight: livingKind === 'sofa' && id !== 0
    });
    if (id !== 0 && freeSlots.length > 1) {
      furniture.push({
        id: `${id}:screen`,
        kind: a.layout === 'office' || a.layout === 'gallery' ? 'shelf' : 'partition',
        x: freeSlots[1],
        floorY: GAME.interiorGround,
        width: 48,
        height: 78,
        solid: true,
        blocksSight: true
      });
    }
    // Add an extra stealth cover object in HARD / VERY_HARD / EXTREME houses so every house has a guaranteed stealth route
    if (id >= 6 && freeSlots.length > 2) {
      furniture.push({
        id: `${id}:cover2`,
        kind: id % 2 === 0 ? 'shelf' : 'partition',
        x: freeSlots[2],
        floorY: GAME.interiorGround,
        width: 48,
        height: 78,
        solid: true,
        blocksSight: true
      });
    }

    const residents: ResidentData[] = [];
    const npcCount = id === 0 || id === 3 ? 0 : difficulty === 'EASY' ? 1 : difficulty === 'NORMAL' ? (id % 2 ? 1 : 2) : difficulty === 'HARD' ? 2 : 1;
    const activities: ResidentActivity[] = ['computer', 'sleep', 'tv', 'patrol', 'chat', 'rest'];
    for (let j = 0; j < npcCount; j++) {
      const activity = a.type === 'elderly' ? 'sleep' : activities[(id + j) % activities.length];
      const onLiving = ['sleep', 'rest', 'tv'].includes(activity);
      let x = onLiving ? livingX : pcs[Math.min(j, pcs.length - 1)].x + (doorX < width / 2 ? 200 : -200);
      x = Math.max(200, Math.min(width - 200, x));
      if (!onLiving && Math.abs(x - doorX) < 270) x = width / 2;
      if (!onLiving) {
        const candidates = Array.from({ length: Math.ceil((width - 360) / 40) }, (_, k) => 180 + k * 40);
        const open = candidates.filter(candidate =>
          Math.abs(candidate - doorX) > 220 &&
          furniture.every(f => !f.solid || f.floorY !== GAME.interiorGround || Math.abs(candidate - f.x) > f.width / 2 + 24)
        );
        x = open.sort((left, right) => Math.abs(left - x) - Math.abs(right - x))[0] ?? x;
      }
      // Progression-based civilian type:
      // EASY (1..3): resident / engineer
      // NORMAL (4..6) & HARD (7..10): mix of resident/engineer and alertResident (Enemy B)
      const isAlertResident = (tier === 'NORMAL' && id >= 4 && j === 0) || (tier === 'HARD' && j === 0);
      const kind: EnemyKind = isAlertResident
        ? 'alertResident'
        : (a.type === 'engineer' || a.type === 'research' ? 'engineer' : 'resident');
      residents.push({
        id: `citizen:${id}:${j}`,
        kind,
        x,
        y: onLiving ? GAME.interiorGround - 43 : GAME.interiorGround,
        activity,
        facing: doorX < width / 2 ? 1 : -1
      });
    }

    // Progression-based indoor security roster (Phase 2.2 & Phase 4.2)
    const security: ResidentData[] = [];
    const pickSafeSecurityX = (preferredRatio: number) => {
      const target = Math.round(width * preferredRatio);
      const candidates = Array.from({ length: Math.ceil((width - 420) / 30) }, (_, k) => 210 + k * 30);
      const open = candidates.filter(c =>
        Math.abs(c - doorX) > 260 &&
        furniture.every(f => !f.solid || f.floorY !== GAME.interiorGround || Math.abs(c - f.x) > f.width / 2 + 28)
      );
      return open.sort((l, r) => Math.abs(l - target) - Math.abs(r - target))[0] ?? target;
    };

    if (tier === 'HARD') {
      // Houses 7..10: Private Guard (Enemy C)
      security.push({
        id: `security:${id}:guard:0`,
        kind: 'privateGuard',
        x: pickSafeSecurityX(0.62),
        y: GAME.interiorGround,
        activity: 'patrol',
        facing: doorX < width / 2 ? -1 : 1
      });
    } else if (tier === 'VERY_HARD') {
      // Houses 11..13: Private Guard (Enemy C) + Security Robot (Enemy E)
      security.push(
        {
          id: `security:${id}:guard:0`,
          kind: 'privateGuard',
          x: pickSafeSecurityX(0.48),
          y: GAME.interiorGround,
          activity: 'patrol',
          facing: doorX < width / 2 ? -1 : 1
        },
        {
          id: `security:${id}:robot:0`,
          kind: 'securityRobot',
          x: pickSafeSecurityX(0.76),
          y: GAME.interiorGround,
          activity: 'patrol',
          facing: doorX < width / 2 ? -1 : 1
        }
      );
    } else if (tier === 'EXTREME') {
      // House 14: Elite Guard (Enemy D) + Combat Drone (Enemy F) + Research Drone
      security.push(
        {
          id: `facility:${id}:elite`,
          kind: 'eliteGuard',
          x: pickSafeSecurityX(0.56),
          y: GAME.interiorGround,
          activity: 'patrol',
          facing: -1
        },
        {
          id: `facility:${id}:combatDrone`,
          kind: 'combatDrone',
          x: Math.round(width * 0.72),
          y: GAME.interiorGround - 155,
          activity: 'patrol',
          facing: -1
        },
        {
          id: `facility:${id}:drone`,
          kind: 'enhancedDrone',
          x: Math.round(width * 0.84),
          y: GAME.interiorGround - 165,
          activity: 'patrol',
          facing: -1
        }
      );
    }

    // Surveillance Cameras in HARD / VERY_HARD / EXTREME houses (id >= 7)
    const cameras: SecurityCameraData[] = [];
    if (id >= 7) {
      cameras.push({
        id: `camera:${id}:0`,
        x: Math.round(width * 0.55),
        y: 156,
        range: 370,
        fovDeg: 90,
        sweepPeriodMs: tier === 'EXTREME' ? 2800 : 3600
      });
    }

    if (residents.some(r => r.activity === 'tv')) {
      furniture.push({
        id: `${id}:tv`,
        kind: 'tv',
        x: Math.min(width - 120, livingX + 135),
        floorY: GAME.interiorGround,
        width: 72,
        height: 80,
        solid: false,
        blocksSight: false
      });
    }

    return {
      id,
      x: 510 + id * GAME.houseSpacing,
      palette: Math.floor(random() * 4),
      type: a.type,
      difficulty,
      tier,
      tierLabel: tierCfg.label,
      layout: a.layout,
      width,
      doorX,
      spawnX: doorX + (doorX < width / 2 ? 120 : -120),
      pcs,
      furniture,
      platforms,
      residents,
      security,
      cameras,
      allowIndoorSecurity: security.length > 0 || difficulty === 'EXTREME',
      alarmX: difficulty === 'HARD' || difficulty === 'EXTREME' ? Math.round(width * 0.52) : undefined
    };
  });
}

export function furnitureOccluderRect(f: FurnitureData) {
  if (!f.blocksSight) return undefined;
  const effectiveHeight = f.kind === 'sofa' ? 34 : f.height;
  return { x: f.x - f.width / 2, y: f.floorY - effectiveHeight, width: f.width, height: effectiveHeight };
}

/** Verifies that a house has a viable stealth approach using cover furniture, elevated platforms, or patrol windows. */
export function hasStealthRoute(house: HouseData): boolean {
  if (house.residents.length === 0 && house.security.length === 0) return true;
  const hasCover = house.furniture.some(f => f.blocksSight);
  const hasElevation = house.platforms.length > 0;
  const hasPatrolWindow = [...house.residents, ...house.security].some(e => e.activity === 'patrol' || e.activity === 'sleep');
  return (hasCover || hasElevation || hasPatrolWindow) && reachablePCs(house);
}

export function reachablePCs(house: HouseData) {
  const nodes = [{ x: house.width / 2, y: GAME.interiorGround, width: house.width, height: 0 }, ...house.platforms];
  const reached = new Set([0]); const maxJump = GAME.jumpSpeed ** 2 / (2 * GAME.gravity);
  for (let pass = 0; pass < nodes.length; pass++) for (let i = 0; i < nodes.length; i++) if (reached.has(i)) {
    for (let j = 0; j < nodes.length; j++) {
      const rise = nodes[i].y - nodes[j].y;
      const gap = Math.max(0, Math.abs(nodes[i].x - nodes[j].x) - (nodes[i].width + nodes[j].width) / 2);
      if (rise <= maxJump && gap <= 300) reached.add(j);
    }
  }
  return house.pcs.every(pc => nodes.some((n, i) => reached.has(i) && Math.abs(n.y - pc.floorY) < 1 && Math.abs(n.x - pc.x) <= n.width / 2));
}
