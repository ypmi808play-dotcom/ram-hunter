import { DROPS } from './balance.ts';
import { ENEMY_TYPES } from './enemies.ts';
import type { EnemyKind } from './enemies.ts';

export interface DropRecord {
  id: string;
  enemyId: string;
  sceneId: string;
  kind: 'health' | 'ram';
  gb: number;
  x: number;
  y: number;
  expiresAt: number;
  status: 'pending' | 'claimed' | 'expired';
}

export function rollEnemyDrop(kind: EnemyKind, random: () => number): { kind: 'health' | 'ram'; gb: number } | undefined {
  const role = ENEMY_TYPES[kind].role;
  if (role === 'civilian') {
    return random() < DROPS.civilianHealthChance ? { kind: 'health', gb: 0 } : undefined;
  }
  if (kind === 'securityRobot') {
    const min = DROPS.robotMinGB, max = DROPS.robotMaxGB;
    return { kind: 'ram', gb: min + Math.min(max - min, Math.floor(random() * (max - min + 1))) };
  }
  if (role === 'drone') {
    const min = kind === 'enhancedDrone' || kind === 'combatDrone' ? DROPS.enhancedMinGB : DROPS.droneMinGB;
    const max = kind === 'enhancedDrone' || kind === 'combatDrone' ? DROPS.enhancedMaxGB : DROPS.droneMaxGB;
    return { kind: 'ram', gb: min + Math.min(max - min, Math.floor(random() * (max - min + 1))) };
  }
  return undefined;
}
