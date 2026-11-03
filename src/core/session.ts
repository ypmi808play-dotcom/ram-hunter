import { FEATURES, GAME, PC_TYPES, RUN_MODES } from './config.ts';
import type { NoiseAction, RunMode } from './config.ts';
import { seededRandom } from './random.ts';
import { AbilityCooldowns, EnemyControl } from './abilities.ts';
import type { AbilityId, AbilityUse, Lure } from './abilities.ts';
import { WantedSystem } from './wanted.ts';
import type { Sighting } from './wanted.ts';
import { createNeighborhood, effectivePcRam, hasStealthRoute } from './houses.ts';
import type { HouseData, PCData } from './houses.ts';
import { EnemyMemory, allowedTerritory } from './enemies.ts';
import type { EnemySpawn } from './enemies.ts';
import { rollEnemyDrop } from './drops.ts';
import type { DropRecord } from './drops.ts';
import { AI, COMBAT, DROPS } from './balance.ts';
import { NoiseSystem } from './NoiseSystem.ts';
import type { SoundEvent } from './NoiseSystem.ts';
import { StealthController } from './StealthController.ts';
import { HouseEventManager } from './HouseEventManager.ts';
import { ExtractionSystem, EXTRACTION_STATUS_LABELS, settleRunRam } from './ExtractionSystem.ts';

export { createNeighborhood, effectivePcRam, hasStealthRoute } from './houses.ts';
export type { PCData, HouseData } from './houses.ts';
export type EndReason = 'time' | 'life' | 'goal' | 'extract' | 'boss_win' | 'boss_loss';

export interface RunStats {
  enemiesDefeated: number;
  civiliansDefeated: number;
  policeDefeated: number;
  dronesDefeated: number;
  heavyDefeated: number;
  ramFromDrones: number;
  healthItemsCollected: number;
  highestWantedLevel: number;
}
export const emptyStats = (): RunStats => ({
  enemiesDefeated: 0,
  civiliansDefeated: 0,
  policeDefeated: 0,
  dronesDefeated: 0,
  heavyDefeated: 0,
  ramFromDrones: 0,
  healthItemsCollected: 0,
  highestWantedLevel: 0
});

export interface RunResult extends RunStats {
  totalRamGB: number;
  totalCollectedRamGB: number;
  availableRamGB: number;
  spentRamGB: number;
  lostRamGB: number;
  securedRamGB: number;
  computersEmptied: number;
  housesVisited: number;
  score: number;
  timeBonus: number;
  reason: EndReason;
  extractionStatus: string;
  riskMode: boolean;
  specialEventsCompleted: number;
  seed: number;
  mode: RunMode;
  durationMs: number;
}

export function previewResult(gb = 768): RunResult {
  return {
    ...emptyStats(),
    totalRamGB: gb,
    totalCollectedRamGB: gb,
    availableRamGB: gb,
    spentRamGB: 0,
    lostRamGB: 0,
    securedRamGB: gb,
    computersEmptied: 0,
    housesVisited: 0,
    score: 0,
    timeBonus: 0,
    reason: 'goal',
    extractionStatus: EXTRACTION_STATUS_LABELS.goal.badge,
    riskMode: false,
    specialEventsCompleted: 0,
    seed: 0,
    mode: 'normal',
    durationMs: RUN_MODES.normal.durationMs
  };
}

export class RunSession {
  readonly seed: number;
  readonly mode: RunMode;
  readonly riskMode: boolean;
  readonly durationMs: number;
  readonly houses: HouseData[];
  readonly collected = new Map<string, number>();
  readonly visited = new Set<number>();
  readonly cooldowns = new AbilityCooldowns();
  readonly wanted = new WantedSystem();
  readonly enemies = new Map<string, EnemyMemory>();
  readonly drops = new Map<string, DropRecord>();
  readonly stats = emptyStats();
  readonly alarms = new Set<number>();
  readonly noise = new NoiseSystem();
  readonly stealth = new StealthController();
  readonly houseEvents: HouseEventManager;
  readonly extraction = new ExtractionSystem();

  private readonly enemyControls = new Map<string, EnemyControl>();
  private readonly rewards = new Map<string, { gb: number; source: 'pc' | 'drone' | 'boss' }>();
  private spent = 0;
  private finalizedResult?: RunResult;
  activeLure?: Lure;
  lives: number = GAME.lives;
  remainingMs: number;
  elapsedMs = 0;
  invincibleUntil = 0;
  empJammedUntil = 0;
  nextReinforcementAt = 0;
  outdoorAcquireAt = 0;
  activeSceneId = 'street';
  streetPosition: { x: number; y: number } = { x: 180, y: GAME.streetGround };
  ended = false;

  constructor(
    seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0,
    mode: RunMode = 'normal',
    riskMode = FEATURES.riskModeDefault
  ) {
    this.seed = seed;
    this.mode = mode;
    this.riskMode = riskMode;
    this.durationMs = RUN_MODES[mode].durationMs;
    this.remainingMs = this.durationMs;
    this.houses = createNeighborhood(seed);
    this.houseEvents = new HouseEventManager(seed, this.houses, FEATURES.houseEvents);
  }

  get totalCollectedRamGB() {
    return [...this.rewards.values()].reduce((sum, reward) => sum + reward.gb, 0);
  }
  get totalRamGB() {
    return this.totalCollectedRamGB;
  }
  get spentRamGB() {
    return this.spent;
  }
  get availableRamGB() {
    return Math.max(0, this.totalCollectedRamGB - this.spent);
  }
  get lostRamGB() {
    return this.finalizedResult?.lostRamGB ?? 0;
  }
  get securedRamGB() {
    return this.finalizedResult ? this.finalizedResult.securedRamGB : this.availableRamGB;
  }
  get potentialRamGB() {
    return this.houses.flatMap(h => h.pcs).reduce((a, pc) => a + effectivePcRam(pc), 0);
  }
  get isEmpJammed() {
    return this.elapsedMs < this.empJammedUntil;
  }

  applyEmpJam(durationMs = COMBAT.empJamDurationMs) {
    if (this.ended) return;
    this.empJammedUntil = Math.max(this.empJammedUntil, this.elapsedMs + durationMs);
  }

  notifyNearbyResidents(sceneId: string, sourceX: number, targetX: number) {
    if (this.ended) return;
    for (const enemy of this.enemies.values()) {
      if (enemy.defeated || enemy.spawn.sceneId !== sceneId) continue;
      if (Math.abs(enemy.x - sourceX) <= AI.alertCallRadius) {
        enemy.receiveAlertNotification(targetX, this.elapsedMs);
      }
    }
  }

  findPc(pcId: string): { house: HouseData; pc: PCData } | undefined {
    for (const h of this.houses) {
      const pc = h.pcs.find(p => p.id === pcId);
      if (pc) return { house: h, pc };
      const ev = this.houseEvents.forHouse(h.id);
      if (ev?.attic?.pc.id === pcId) return { house: h, pc: ev.attic.pc };
    }
    return undefined;
  }

  emitNoise(
    action: NoiseAction,
    x: number,
    y: number,
    sceneId = this.activeSceneId,
    sourceId = 'player',
    override?: { volume?: number; radius?: number; crossZone?: boolean }
  ): SoundEvent | undefined {
    if (this.ended) return undefined;
    const event = this.noise.emitNoise(action, x, y, sceneId, this.elapsedMs, sourceId, override);
    if (!event) return undefined;
    for (const enemy of this.enemies.values()) {
      if (enemy.defeated) continue;
      if (!this.noise.canNpcPerceive(enemy.spawn.id, event, enemy.spawn.sceneId, enemy.x, enemy.y)) continue;
      if (enemy.hearNoise(event, this.elapsedMs)) {
        this.noise.emitGameEvent('NPC_HEARD_NOISE', this.elapsedMs, enemy.spawn.sceneId, {
          npcId: enemy.spawn.id,
          event
        });
      }
    }
    return event;
  }

  tick(deltaMs: number, sightings: readonly Sighting[] | boolean = [], indoors = false, pursuing = false) {
    if (this.ended || !Number.isFinite(deltaMs) || deltaMs < 0) return;
    this.elapsedMs += deltaMs;
    this.remainingMs = Math.max(0, this.remainingMs - deltaMs);
    const beforeSpotted = this.wanted.spotted;
    this.wanted.tick(deltaMs, sightings, indoors, pursuing);
    if (!beforeSpotted && this.wanted.spotted) {
      this.noise.emitGameEvent('PLAYER_DETECTED', this.elapsedMs, this.activeSceneId, { sightings });
    }
    if (this.activeLure && this.elapsedMs >= this.activeLure.expiresAt) this.activeLure = undefined;
    for (const drop of this.drops.values()) {
      if (drop.status === 'pending' && this.elapsedMs >= drop.expiresAt) drop.status = 'expired';
    }
  }

  visit(houseId: number) {
    if (!this.ended && this.houses.some(h => h.id === houseId)) {
      this.visited.add(houseId);
      const ev = this.houseEvents.activate(houseId);
      if (ev) {
        this.noise.emitGameEvent('HOUSE_EVENT_TRIGGERED', this.elapsedMs, `house:${houseId}`, { event: ev });
      }
    }
  }

  awardRam(id: string, gb: number, source: 'pc' | 'drone' | 'boss') {
    if (this.ended || this.remainingMs <= 0 || !Number.isInteger(gb) || gb <= 0 || this.rewards.has(id)) return 0;
    const amount = source === 'drone' ? Math.min(gb, Math.max(0, DROPS.droneRunCapGB - this.stats.ramFromDrones)) : gb;
    this.rewards.set(id, { gb: amount, source });
    if (source === 'drone') this.stats.ramFromDrones += amount;
    return amount;
  }

  collect(pcId: string): number {
    if (this.ended || this.collected.has(pcId)) return 0;
    const found = this.findPc(pcId);
    if (!found || this.remainingMs <= 0) return 0;
    const { house, pc } = found;
    const targetRam = effectivePcRam(pc);
    const amount = this.awardRam(`pc:${pcId}`, targetRam, 'pc');
    if (!amount) return 0;
    this.collected.set(pcId, amount);
    this.wanted.collection(amount);
    const outcome = this.houseEvents.onPcCollected(house.id, pcId);
    if (outcome.triggerAlarm) {
      this.alarm(house.id);
    }
    this.noise.emitGameEvent('PC_RAM_COLLECTED', this.elapsedMs, this.activeSceneId, {
      pcId,
      amount,
      houseId: house.id,
      eventOutcome: outcome
    });
    return amount;
  }

  disableSecurityTerminal(houseId: number): boolean {
    if (this.ended) return false;
    return this.houseEvents.disableTerminal(houseId);
  }

  discoverAtticRoute(houseId: number): boolean {
    if (this.ended) return false;
    return this.houseEvents.discoverAttic(houseId);
  }

  alarm(houseId: number) {
    if (this.alarms.has(houseId)) return;
    this.alarms.add(houseId);
    this.wanted.event('alarm', `house:${houseId}`);
    const house = this.houses.find(h => h.id === houseId);
    this.emitNoise('alarm', house ? house.width / 2 : 600, GAME.interiorGround, `house:${houseId}`, `alarm:house:${houseId}`, {
      crossZone: true
    });
  }

  spendRam(gb: number) {
    if (this.ended || this.remainingMs <= 0 || this.lives <= 0 || !Number.isInteger(gb) || gb < 0 || gb > this.availableRamGB) return false;
    this.spent += gb;
    return true;
  }

  useAbility(id: AbilityId): AbilityUse {
    if (this.ended || this.lives <= 0 || this.remainingMs <= 0) return { ok: false, reason: 'ended' };
    // EMP pulse jams special abilities (X/C/Q), while leaving normal chip throw (Z) operational
    if (id !== 'chip' && this.isEmpJammed) return { ok: false, reason: 'emp' };
    const use = this.cooldowns.use(id, this.elapsedMs, this.availableRamGB);
    if (use.ok) this.spent += use.cost;
    return use;
  }

  controlFor(enemyId: string) {
    let control = this.enemyControls.get(enemyId);
    if (!control) {
      control = new EnemyControl();
      this.enemyControls.set(enemyId, control);
    }
    return control;
  }

  enemyFor(spawn: EnemySpawn) {
    if (!allowedTerritory(spawn.kind, spawn.sceneId, spawn.facility)) return undefined;
    let enemy = this.enemies.get(spawn.id);
    if (enemy && (enemy.spawn.sceneId !== spawn.sceneId || enemy.spawn.kind !== spawn.kind)) return undefined;
    if (!enemy) {
      enemy = new EnemyMemory(spawn, this.controlFor(spawn.id));
      this.enemies.set(spawn.id, enemy);
    }
    return enemy;
  }

  damageEnemy(id: string, damage: number, direction: number, witnessed = false) {
    const enemy = this.enemies.get(id);
    if (!enemy || this.ended || this.remainingMs <= 0) return { hit: false, killed: false, damage: 0, shielded: false };
    const hit = enemy.hit(damage, this.elapsedMs, direction);
    if (!hit.hit) return hit;
    if (enemy.config.role === 'police' || enemy.config.role === 'security') this.wanted.event('policeAssault', id);
    if (enemy.config.role === 'civilian' && witnessed) this.wanted.event('witnessedAssault', id);
    if (hit.killed) {
      this.stats.enemiesDefeated++;
      if (enemy.config.role === 'civilian') this.stats.civiliansDefeated++;
      if (enemy.config.role === 'police') this.stats.policeDefeated++;
      if (enemy.config.role === 'heavy' || enemy.config.role === 'security') this.stats.heavyDefeated++;
      if (enemy.config.role === 'drone' || enemy.spawn.kind === 'securityRobot') {
        this.stats.dronesDefeated++;
        this.wanted.event('droneDefeated', id);
      }
      this.resolveDrop(enemy);
    }
    return hit;
  }

  private resolveDrop(enemy: EnemyMemory) {
    if (enemy.dropResolved) return;
    enemy.dropResolved = true;
    let hash = this.seed ^ 2166136261;
    for (const ch of enemy.spawn.id) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
    const drop = rollEnemyDrop(enemy.spawn.kind, seededRandom(hash));
    if (drop) {
      const id = `drop:${enemy.spawn.id}`;
      this.drops.set(id, {
        id,
        enemyId: enemy.spawn.id,
        sceneId: enemy.spawn.sceneId,
        kind: drop.kind,
        gb: drop.gb,
        x: enemy.x,
        y: enemy.y - 20,
        expiresAt: this.elapsedMs + DROPS.lifetimeMs,
        status: 'pending'
      });
    }
  }

  claimDrop(id: string) {
    const drop = this.drops.get(id);
    if (
      !drop ||
      this.ended ||
      this.lives <= 0 ||
      this.remainingMs <= 0 ||
      drop.sceneId !== this.activeSceneId ||
      drop.status !== 'pending' ||
      this.elapsedMs >= drop.expiresAt
    ) {
      return { claimed: false, ram: 0, healed: 0 };
    }
    drop.status = 'claimed';
    if (drop.kind === 'ram') return { claimed: true, ram: this.awardRam(id, drop.gb, 'drone'), healed: 0 };
    const before = this.lives;
    this.lives = Math.min(GAME.lives, this.lives + DROPS.healthAmount);
    this.stats.healthItemsCollected++;
    return { claimed: true, ram: 0, healed: this.lives - before };
  }

  leaveArea(sceneId: string, doorX: number) {
    for (const enemy of this.enemies.values()) {
      if (enemy.spawn.sceneId === sceneId) {
        const sawDoor = Math.abs(enemy.x - doorX) < 650 && this.elapsedMs - enemy.lastSeenAt < 1800;
        enemy.loseTarget(this.elapsedMs, sawDoor ? doorX : enemy.lastSeenX);
      }
    }
    this.nextReinforcementAt = Math.max(this.nextReinforcementAt, this.elapsedMs + AI.reinforcementRecoveryMs);
  }

  exitHouse() {
    this.outdoorAcquireAt = this.elapsedMs + AI.exitAcquireGraceMs;
    this.protect(1800);
  }

  damage(): boolean {
    if (this.ended || this.lives <= 0 || this.elapsedMs < this.invincibleUntil) return false;
    this.lives--;
    this.invincibleUntil = this.elapsedMs + GAME.invincibleMs;
    return true;
  }

  protect(ms = 1000) {
    this.invincibleUntil = Math.max(this.invincibleUntil, this.elapsedMs + ms);
  }

  extract(): RunResult {
    this.noise.emitGameEvent('EXTRACTION_REQUESTED', this.elapsedMs, this.activeSceneId);
    return this.finish('extract');
  }

  finish(reason: EndReason): RunResult {
    if (this.ended && this.finalizedResult) return this.finalizedResult;
    this.ended = true;
    const settlement = settleRunRam(this.totalCollectedRamGB, this.spentRamGB, reason, this.riskMode);
    const timeBonus =
      reason === 'goal' || reason === 'boss_win'
        ? Math.floor((this.remainingMs / this.durationMs) * 180) * 20
        : 0;
    const completedEvents = this.houseEvents.all().filter(e => e.status === 'completed').length;
    const scoreRamBasis = this.riskMode ? settlement.securedRamGB + settlement.spentRamGB : this.totalCollectedRamGB;
    const result: RunResult = {
      ...this.stats,
      highestWantedLevel: this.wanted.highestLevel,
      totalRamGB: this.totalCollectedRamGB,
      totalCollectedRamGB: settlement.totalCollectedRamGB,
      availableRamGB: settlement.availableRamGB,
      spentRamGB: settlement.spentRamGB,
      lostRamGB: settlement.lostRamGB,
      securedRamGB: settlement.securedRamGB,
      computersEmptied: this.collected.size,
      housesVisited: this.visited.size,
      score: scoreRamBasis * 100 + this.collected.size * 250 + timeBonus,
      timeBonus,
      reason,
      extractionStatus: settlement.statusBadge,
      riskMode: this.riskMode,
      specialEventsCompleted: completedEvents,
      seed: this.seed,
      mode: this.mode,
      durationMs: this.durationMs
    };
    this.finalizedResult = result;
    this.noise.emitGameEvent('RUN_FINALIZED', this.elapsedMs, this.activeSceneId, { result });
    return result;
  }
}

export function pcType(gb: number) {
  let best = PC_TYPES[0];
  for (const t of PC_TYPES) {
    if (gb >= t.gb) best = t;
  }
  return best;
}

export function formatTime(ms: number) {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
