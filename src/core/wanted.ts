import { AI } from './balance.ts';
import type { EnemyKind } from './enemies.ts';
export const WANTED = {
  thresholds: [0, 10, 25, 45, 65, 85], maxHeat: 100,
  unseenGraceMs: 5000, decayPerSecond: 3, indoorDecayPerSecond: 4,
  discoveryCooldownMs: 12000, rediscoveryGapMs: 4000, maxEnemies: 18, maxActiveEnemies: 10,
  collectionHeat: 2, largeCollectionExtra: 2, residentSeen: 5, policeSeen: 7,
  witnessedAssault: 4, policeAssault: 8, droneDefeated: 6, alarmHeat: 8
} as const;
export const WANTED_LABELS = ['通常状態', '住民の警戒', '追跡強化', '警官増援', 'ドローン出動', '最高警戒状態'];
export interface Sighting { id: string; kind: EnemyKind }
export class WantedSystem {
  private heatValue = 0; private clockMs = 0;
  private reports = new Map<string, { lastSeen: number; nextReport: number; active: boolean }>();
  private eventReady = new Map<string, number>();
  unseenMs = 0; spotted = false; pursuing = false; indoors = false; highestLevel = 0;
  get heat() { return this.heatValue; }
  get level() { return WANTED.thresholds.findLastIndex(t => this.heatValue >= t); }
  private add(amount: number) { this.heatValue = Math.min(WANTED.maxHeat, this.heatValue + amount); this.highestLevel = Math.max(this.highestLevel, this.level); }
  collection(gb: number) { if (Number.isFinite(gb) && gb > 0) this.add(WANTED.collectionHeat + (gb >= 64 ? WANTED.largeCollectionExtra : 0)); }
  event(type: 'witnessedAssault' | 'policeAssault' | 'droneDefeated' | 'alarm', id: string) {
    const key = `${type}:${id}`;
    if (this.clockMs < (this.eventReady.get(key) ?? 0)) return;
    this.add(type === 'alarm' ? WANTED.alarmHeat : WANTED[type]);
    this.eventReady.set(key, this.clockMs + (type === 'witnessedAssault' ? 4000 : type === 'alarm' || type === 'droneDefeated' ? Infinity : 0));
  }
  tick(deltaMs: number, sightings: readonly Sighting[] | boolean = [], indoors = false, pursuing = false) {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
    this.clockMs += deltaMs; this.indoors = indoors; this.pursuing = pursuing;
    const visible: readonly Sighting[] = typeof sightings === 'boolean' ? sightings ? [{ id: 'legacy', kind: 'resident' }] : [] : sightings;
    this.spotted = visible.length > 0;
    for (const s of visible) {
      let report = this.reports.get(s.id);
      if (!report) { report = { lastSeen: -Infinity, nextReport: 0, active: false }; this.reports.set(s.id, report); }
      if (this.clockMs - report.lastSeen >= WANTED.rediscoveryGapMs) report.active = false;
      if (!report.active && this.clockMs >= report.nextReport) {
        this.add(s.kind === 'guard' || s.kind === 'heavy' || s.kind === 'drone' || s.kind === 'enhancedDrone' ? WANTED.policeSeen : WANTED.residentSeen);
        report.active = true; report.nextReport = this.clockMs + WANTED.discoveryCooldownMs;
      }
      report.lastSeen = this.clockMs;
    }
    if (this.spotted || pursuing) this.unseenMs = 0;
    else {
      const before = Math.max(0, this.unseenMs - WANTED.unseenGraceMs); this.unseenMs += deltaMs;
      const decayMs = Math.max(0, this.unseenMs - WANTED.unseenGraceMs) - before;
      this.heatValue = Math.max(0, this.heatValue - decayMs / 1000 * (indoors ? WANTED.indoorDecayPerSecond : WANTED.decayPerSecond));
    }
  }
}
export function reinforcementQuota(level: number) { return { guards: level >= 4 ? 2 : level >= 3 ? 1 : 0, drones: level >= 5 ? 2 : level >= 4 ? 1 : 0 }; }
export function reinforcementRequests(sceneId: string, level: number, existingIds: readonly string[], indoors: boolean, now = Infinity, nextAllowedAt = 0) {
  if (indoors || sceneId !== 'street' || now < Math.max(AI.reinforcementGraceMs, nextAllowedAt)) return [];
  const quota = reinforcementQuota(level);
  const requests = [
    ...Array.from({ length: quota.guards }, (_, i) => ({ kind: 'guard' as const, index: i, id: `street:reinforcement:guard:${i}` })),
    ...Array.from({ length: quota.drones }, (_, i) => ({ kind: 'drone' as const, index: i, id: `street:reinforcement:drone:${i}` }))
  ];
  return requests.filter(r => !existingIds.includes(r.id)).slice(0, 1);
}
export function activeEnemyIds(enemies: readonly { id: string; x: number }[], playerX: number) {
  return new Set([...enemies].filter(e => Math.abs(e.x - playerX) < 1150).sort((a, b) => Math.abs(a.x - playerX) - Math.abs(b.x - playerX)).slice(0, WANTED.maxActiveEnemies).map(e => e.id));
}
