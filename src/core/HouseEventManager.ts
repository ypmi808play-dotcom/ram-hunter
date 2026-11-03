import { FEATURES, GAME, HOUSE_EVENT_CONFIG } from './config.ts';
import { seededRandom, shuffle } from './random.ts';
import type { HouseData, PCData, PlatformData, FurnitureData } from './houses.ts';

export type HouseEventType =
  | 'SLEEPING_HOUSE'
  | 'ALARM_PC'
  | 'ATTIC_ROUTE'
  | 'RAM_JACKPOT'
  | 'EMPTY_HOUSE';

export const HOUSE_EVENT_TYPES: readonly HouseEventType[] = [
  'SLEEPING_HOUSE',
  'ALARM_PC',
  'ATTIC_ROUTE',
  'RAM_JACKPOT',
  'EMPTY_HOUSE'
] as const;

export const HOUSE_EVENT_INFO: Record<HouseEventType, {
  name: string;
  label: string;
  badge: string;
  description: string;
  color: number;
}> = {
  SLEEPING_HOUSE: {
    name: 'SLEEPING HOUSE',
    label: '住民が寝ている家',
    badge: '💤 SLEEPING HOUSE',
    description: '住民がベッドで熟睡中。Ctrlしゃがみ移動で物音を抑えれば、戦闘なしで安全にRAMを回収できます。',
    color: 0x9ec8e8
  },
  ALARM_PC: {
    name: 'ALARM PC',
    label: 'セキュリティ警報付きPC',
    badge: '⚠ ALARM PC',
    description: '大容量RAM搭載の警報付きPC。回収前に室内のセキュリティ端末を操作すれば警報を無効化できます。',
    color: 0xf2a88c
  },
  ATTIC_ROUTE: {
    name: 'ATTIC ROUTE',
    label: '屋根裏への秘密通路',
    badge: '🪜 ATTIC ROUTE',
    description: '天井のハッチから屋根裏の秘密空間へ進入可能。障害物を飛び越えた先に高価値PCがあります。',
    color: 0xd8c38f
  },
  RAM_JACKPOT: {
    name: 'RAM JACKPOT',
    label: 'RAM増設済みPC',
    badge: '★ RAM JACKPOT',
    description: '特別に増設された黄金発光PC！通常の1.5〜2倍のRAM容量を獲得できます。',
    color: 0xf7df7c
  },
  EMPTY_HOUSE: {
    name: 'EMPTY HOUSE',
    label: '一時的に無人の住宅',
    badge: '🏠 EMPTY HOUSE',
    description: '住民が外出中で室内に敵がいません。RAM容量はやや控えめですが安全に回収できます。',
    color: 0xb6e3a8
  }
};

export interface AtticData {
  sceneId: string;
  width: number;
  hatchX: number;
  exitLadderX: number;
  pc: PCData;
  platforms: PlatformData[];
  obstacles: FurnitureData[];
}

export interface HouseEventRecord {
  id: string;
  houseId: number;
  type: HouseEventType;
  status: 'pending' | 'active' | 'completed';
  targetPcId?: string;
  multiplier?: number;
  bonusRamGB?: number;
  terminalX?: number;
  terminalY?: number;
  terminalDisabled: boolean;
  alarmTriggered: boolean;
  atticDiscovered: boolean;
  attic?: AtticData;
  rewardClaimed: boolean;
}

export function isHouseCompatibleWithEvent(house: HouseData, type: HouseEventType): boolean {
  // Keep House 0 (intro tutorial) and House 13 (EXTREME research lab) untouched for baseline progression.
  if (house.id === 0 || house.id === 13) return false;

  switch (type) {
    case 'SLEEPING_HOUSE':
      return (
        house.residents.length > 0 &&
        ['family', 'elderly', 'gamer', 'engineer', 'wealthy', 'enthusiast'].includes(house.type) &&
        house.difficulty !== 'EXTREME'
      );
    case 'ALARM_PC':
      return (
        house.id >= 2 &&
        ['NORMAL', 'HARD'].includes(house.difficulty) &&
        ['office', 'engineer', 'wealthy', 'gamer', 'enthusiast', 'family'].includes(house.type)
      );
    case 'ATTIC_ROUTE':
      // Avoid conflicting with houses that already have elevated loft/laboratory platforms.
      return (
        !['loft', 'laboratory'].includes(house.layout) &&
        house.platforms.length === 0 &&
        ['family', 'elderly', 'gamer', 'wealthy', 'enthusiast', 'engineer'].includes(house.type)
      );
    case 'RAM_JACKPOT':
      return house.id >= 1 && house.id <= 12 && house.pcs.length > 0;
    case 'EMPTY_HOUSE':
      // Keep House 1 occupied for existing resident tests, and only apply to houses that normally have residents.
      return house.id >= 2 && house.id <= 9 && house.residents.length > 0 && ['EASY', 'NORMAL'].includes(house.difficulty);
  }
}

export class HouseEventManager {
  readonly events = new Map<number, HouseEventRecord>();

  constructor(seed: number, houses: HouseData[], enabled = FEATURES.houseEvents) {
    if (!enabled) return;
    this.generate(seed, houses);
  }

  private generate(seed: number, houses: HouseData[]) {
    const random = seededRandom((seed ^ 0x5f3759df) >>> 0);
    const span = HOUSE_EVENT_CONFIG.maxEventsPerRun - HOUSE_EVENT_CONFIG.minEventsPerRun + 1;
    const targetCount = HOUSE_EVENT_CONFIG.minEventsPerRun + Math.floor(random() * span);

    const candidateHouses = shuffle(houses.filter(h => h.id >= 1 && h.id <= 12), random);
    const chosenTypes = shuffle(HOUSE_EVENT_TYPES, random);
    const usedTypes = new Set<HouseEventType>();

    // First pass: try to assign distinct event types to compatible houses
    for (const eventType of chosenTypes) {
      if (this.events.size >= targetCount) break;
      const house = candidateHouses.find(
        h => !this.events.has(h.id) && isHouseCompatibleWithEvent(h, eventType)
      );
      if (!house) continue;
      this.applyEventToHouse(house, eventType, random);
      usedTypes.add(eventType);
    }

    // Fallback pass if fewer than minEventsPerRun were placed
    for (const house of candidateHouses) {
      if (this.events.size >= targetCount) break;
      if (this.events.has(house.id)) continue;
      const compatible = HOUSE_EVENT_TYPES.find(t => !usedTypes.has(t) && isHouseCompatibleWithEvent(house, t))
        ?? HOUSE_EVENT_TYPES.find(t => isHouseCompatibleWithEvent(house, t));
      if (compatible) {
        this.applyEventToHouse(house, compatible, random);
        usedTypes.add(compatible);
      }
    }
  }

  private applyEventToHouse(house: HouseData, type: HouseEventType, random: () => number) {
    const record: HouseEventRecord = {
      id: `event:house:${house.id}:${type}`,
      houseId: house.id,
      type,
      status: 'pending',
      terminalDisabled: false,
      alarmTriggered: false,
      atticDiscovered: false,
      rewardClaimed: false
    };

    if (type === 'SLEEPING_HOUSE') {
      const living = house.furniture.find(f => f.kind === 'bed' || f.kind === 'sofa');
      if (living) living.kind = 'bed';
      house.residents.forEach((r, idx) => {
        r.activity = 'sleep';
        if (living) {
          r.x = living.x + idx * 28;
          r.y = GAME.interiorGround - 43;
        }
      });
    } else if (type === 'ALARM_PC') {
      // Pick a PC (avoiding 10:0 so the first 128GB PC baseline remains 128GB)
      const candidates = house.pcs.filter(pc => pc.id !== '10:0');
      const target = (candidates.length > 0 ? candidates : house.pcs)[Math.floor(random() * (candidates.length || house.pcs.length))];
      const multiplier = HOUSE_EVENT_CONFIG.alarmPcMultiplier;
      const bonus = Math.max(4, Math.round(target.gb * (multiplier - 1))) + (target.tierBonusGb ?? 0);
      target.tierBonusGb = 0;
      target.bonusGb = bonus;
      target.eventTag = 'ALARM_PC';
      record.targetPcId = target.id;
      record.multiplier = multiplier;
      record.bonusRamGB = bonus;
      // Place security terminal in another location inside the room away from the door and target PC
      const candidateXs = [
        Math.round(house.width * 0.28),
        Math.round(house.width * 0.52),
        Math.round(house.width * 0.76)
      ].filter(x => Math.abs(x - house.doorX) > 160 && Math.abs(x - target.x) > 140);
      record.terminalX = candidateXs[0] ?? Math.max(220, Math.min(house.width - 220, house.doorX < house.width / 2 ? house.width - 260 : 260));
      record.terminalY = GAME.interiorGround;
    } else if (type === 'ATTIC_ROUTE') {
      const hatchX = Math.round(house.width * 0.48);
      const atticWidth = HOUSE_EVENT_CONFIG.atticWidth;
      const atticGb = house.difficulty === 'HARD' ? 128 : house.difficulty === 'NORMAL' ? 64 : 32;
      const atticPc: PCData = {
        id: `${house.id}:attic:0`,
        gb: atticGb,
        x: atticWidth - 190,
        floorY: 440,
        eventTag: 'ATTIC_ROUTE'
      };
      const platforms: PlatformData[] = [
        { x: 310, y: 515, width: 120, height: 16 },
        { x: 520, y: 470, width: 120, height: 16 },
        { x: atticWidth - 210, y: 440, width: 250, height: 16 }
      ];
      const obstacles: FurnitureData[] = [
        { id: `attic:desk:${house.id}`, kind: 'desk', x: atticPc.x, floorY: 440, width: 140, height: 58, solid: true, blocksSight: false },
        { id: `attic:obstacle:${house.id}:1`, kind: 'partition', x: 230, floorY: GAME.interiorGround, width: 42, height: 54, solid: true, blocksSight: true },
        { id: `attic:obstacle:${house.id}:2`, kind: 'shelf', x: 430, floorY: GAME.interiorGround, width: 44, height: 64, solid: true, blocksSight: true }
      ];
      record.attic = {
        sceneId: `house:${house.id}:attic`,
        width: atticWidth,
        hatchX,
        exitLadderX: 110,
        pc: atticPc,
        platforms,
        obstacles
      };
      record.targetPcId = atticPc.id;
      record.bonusRamGB = atticGb;
    } else if (type === 'RAM_JACKPOT') {
      const candidates = house.pcs.filter(pc => pc.id !== '10:0');
      const target = (candidates.length > 0 ? candidates : house.pcs)[Math.floor(random() * (candidates.length || house.pcs.length))];
      const mults = HOUSE_EVENT_CONFIG.jackpotMultipliers;
      const multiplier = mults[Math.floor(random() * mults.length)];
      const bonus = Math.max(4, Math.round(target.gb * (multiplier - 1))) + (target.tierBonusGb ?? 0);
      target.tierBonusGb = 0;
      target.bonusGb = bonus;
      target.eventTag = 'RAM_JACKPOT';
      record.targetPcId = target.id;
      record.multiplier = multiplier;
      record.bonusRamGB = bonus;
    } else if (type === 'EMPTY_HOUSE') {
      house.residents = [];
      house.security = [];
      for (const pc of house.pcs) {
        if (pc.id === '10:0') continue;
        pc.tierBonusGb = 0;
        const reduction = Math.max(0, Math.min(pc.gb - 4, Math.floor(pc.gb * (1 - HOUSE_EVENT_CONFIG.emptyHouseMultiplier))));
        if (reduction > 0) {
          pc.bonusGb = -reduction;
          pc.eventTag = 'EMPTY_HOUSE';
        }
      }
    }

    house.specialEvent = record.type;
    this.events.set(house.id, record);
  }

  forHouse(houseId: number): HouseEventRecord | undefined {
    return this.events.get(houseId);
  }

  all(): HouseEventRecord[] {
    return [...this.events.values()];
  }

  activate(houseId: number): HouseEventRecord | undefined {
    const ev = this.events.get(houseId);
    if (!ev) return undefined;
    if (ev.status === 'pending') ev.status = 'active';
    return ev;
  }

  disableTerminal(houseId: number): boolean {
    const ev = this.events.get(houseId);
    if (!ev || ev.type !== 'ALARM_PC' || ev.terminalDisabled) return false;
    ev.terminalDisabled = true;
    return true;
  }

  discoverAttic(houseId: number): boolean {
    const ev = this.events.get(houseId);
    if (!ev || ev.type !== 'ATTIC_ROUTE') return false;
    const firstTime = !ev.atticDiscovered;
    ev.atticDiscovered = true;
    if (ev.status === 'pending') ev.status = 'active';
    return firstTime;
  }

  onPcCollected(houseId: number, pcId: string): {
    triggerAlarm: boolean;
    triggeredAlarm: boolean;
    eventCompleted: boolean;
    event?: HouseEventRecord;
  } {
    const ev = this.events.get(houseId);
    if (!ev) return { triggerAlarm: false, triggeredAlarm: false, eventCompleted: false };

    let triggeredAlarm = false;
    let eventCompleted = false;

    if (ev.type === 'ALARM_PC' && ev.targetPcId === pcId) {
      ev.rewardClaimed = true;
      ev.status = 'completed';
      eventCompleted = true;
      if (!ev.terminalDisabled) {
        ev.alarmTriggered = true;
        triggeredAlarm = true;
      }
    } else if (ev.type === 'RAM_JACKPOT' && ev.targetPcId === pcId) {
      ev.rewardClaimed = true;
      ev.status = 'completed';
      eventCompleted = true;
    } else if (ev.type === 'ATTIC_ROUTE' && ev.targetPcId === pcId) {
      ev.rewardClaimed = true;
      ev.status = 'completed';
      eventCompleted = true;
    } else if (ev.type === 'SLEEPING_HOUSE' || ev.type === 'EMPTY_HOUSE') {
      ev.rewardClaimed = true;
      ev.status = 'completed';
      eventCompleted = true;
    }

    return { triggerAlarm: triggeredAlarm, triggeredAlarm, eventCompleted, event: ev };
  }
}
