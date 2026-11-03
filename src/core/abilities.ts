export const ABILITIES = {
  chip: { key: 'Z', name: 'RAM CHIP', label: 'RAMチップ投げ', cost: 0, cooldownMs: 450, durationMs: 140, radius: 0 },
  hallucination: { key: 'X', name: 'HALLUCINATION', label: 'ハルシネーション', cost: 8, cooldownMs: 8000, durationMs: 3000, radius: 300 },
  investment: { key: 'C', name: 'BIG INVESTMENT', label: '巨額投資', cost: 0, cooldownMs: 15000, durationMs: 4000, radius: 420 },
  agi: { key: 'Q', name: 'AGI AWAKENING', label: 'AGI覚醒', cost: 32, cooldownMs: 20000, durationMs: 5000, radius: 460 }
} as const;
export type AbilityId = keyof typeof ABILITIES;
export type AbilityUse = { ok: true; cost: number } | { ok: false; reason: 'cooldown' | 'ram' | 'ended' | 'emp' };

export class AbilityCooldowns {
  private readyAt: Partial<Record<AbilityId, number>> = {};
  remaining(id: AbilityId, now: number) { return Math.max(0, (this.readyAt[id] ?? 0) - now); }
  use(id: AbilityId, now: number, availableRamGB: number): AbilityUse {
    const ability = ABILITIES[id];
    if (this.remaining(id, now) > 0) return { ok: false, reason: 'cooldown' };
    if (availableRamGB < ability.cost) return { ok: false, reason: 'ram' };
    this.readyAt[id] = now + ability.cooldownMs;
    return { ok: true, cost: ability.cost };
  }
}

export interface Lure { sceneId: string; x: number; y: number; landsAt: number; expiresAt: number; fromX?: number; fromY?: number }
export type EnemyMode = 'normal' | 'stunned' | 'confused' | 'distracted';

/** Timers use the shared gameplay clock, so pause and scene transitions stay consistent. */
export class EnemyControl {
  stunnedUntil = 0;
  confusedUntil = 0;
  confusedDirection = 1;
  stun(now: number, duration: number) { this.stunnedUntil = Math.max(this.stunnedUntil, now + duration); }
  confuse(now: number, normalDirection: number) {
    this.confusedUntil = Math.max(this.confusedUntil, now + ABILITIES.hallucination.durationMs);
    this.confusedDirection = normalDirection >= 0 ? -1 : 1;
  }
  mode(now: number, x: number, y: number, lure?: Lure): EnemyMode {
    if (now < this.stunnedUntil) return 'stunned';
    if (now < this.confusedUntil) return 'confused';
    if (lure && now >= lure.landsAt && now < lure.expiresAt && Math.hypot(x - lure.x, y - lure.y) <= ABILITIES.investment.radius) return 'distracted';
    return 'normal';
  }
}

export function withinAbilityRadius(id: AbilityId, x: number, y: number, targetX: number, targetY: number) {
  return Math.hypot(x - targetX, y - targetY) <= ABILITIES[id].radius;
}
