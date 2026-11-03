import { FEATURES, GAME, STEALTH, VISION_PROFILES, DETECTION } from './config.ts';
import { AI, COMBAT, ENEMIES } from './balance.ts';
import { clearSight } from './geometry.ts';
import type { Rect } from './geometry.ts';
import { EnemyControl } from './abilities.ts';
import type { EnemyMode, Lure } from './abilities.ts';
import type { ResidentActivity } from './houses.ts';
import { canHearAcrossZones } from './NoiseSystem.ts';
import type { SoundEvent } from './NoiseSystem.ts';

export type EnemyKind =
  | 'resident'
  | 'engineer'
  | 'alertResident'
  | 'privateGuard'
  | 'eliteGuard'
  | 'securityRobot'
  | 'combatDrone'
  | 'guard'
  | 'robot'
  | 'heavy'
  | 'drone'
  | 'enhancedDrone';

export type EnemyRole = 'civilian' | 'security' | 'police' | 'utility' | 'heavy' | 'drone';

export type AIState =
  | 'IDLE'
  | 'PATROL'
  | 'SUSPICIOUS'
  | 'ALERT'
  | 'CHASE'
  | 'ATTACK'
  | 'SEARCH'
  | 'RETURN'
  | 'STUNNED'
  | 'HURT'
  | 'DEFEATED';

export type SpecialAttackKind = 'none' | 'alertCall' | 'batonSwing' | 'dashStrike' | 'empPulse' | 'burstFire';

export interface EnemyTypeConfig {
  kind: EnemyKind;
  role: EnemyRole;
  hp: number;
  speed: number;
  sight: number;
  flying: boolean;
  ranged: boolean;
  indoorAllowed: boolean;
  outdoorAllowed: boolean;
  requiresFacility?: boolean;
  special: SpecialAttackKind;
}

export const ENEMY_TYPES: Record<EnemyKind, EnemyTypeConfig> = {
  // Enemy A: Casual Resident / Engineer (HP 20, contact attack)
  resident: {
    kind: 'resident',
    role: 'civilian',
    hp: ENEMIES.resident.hp,
    speed: ENEMIES.resident.speed,
    sight: ENEMIES.resident.sight,
    flying: false,
    ranged: false,
    indoorAllowed: true,
    outdoorAllowed: false,
    special: 'none'
  },
  engineer: {
    kind: 'engineer',
    role: 'civilian',
    hp: ENEMIES.engineer.hp,
    speed: ENEMIES.engineer.speed,
    sight: ENEMIES.engineer.sight,
    flying: false,
    ranged: false,
    indoorAllowed: true,
    outdoorAllowed: false,
    special: 'none'
  },
  // Enemy B: Alert Resident (HP 40, fast detection, calls nearby residents + throws household object)
  alertResident: {
    kind: 'alertResident',
    role: 'civilian',
    hp: ENEMIES.alertResident.hp,
    speed: ENEMIES.alertResident.speed,
    sight: ENEMIES.alertResident.sight,
    flying: false,
    ranged: false,
    indoorAllowed: true,
    outdoorAllowed: false,
    special: 'alertCall'
  },
  // Enemy C: Private Guard (HP 70, fast detection, melee baton lunge with windup)
  privateGuard: {
    kind: 'privateGuard',
    role: 'security',
    hp: ENEMIES.privateGuard.hp,
    speed: ENEMIES.privateGuard.speed,
    sight: ENEMIES.privateGuard.sight,
    flying: false,
    ranged: false,
    indoorAllowed: true,
    outdoorAllowed: false,
    requiresFacility: true,
    special: 'batonSwing'
  },
  // Enemy D: Elite Guard (HP 120, very fast detection, dash strike + frontal shield 50% damage reduction)
  eliteGuard: {
    kind: 'eliteGuard',
    role: 'heavy',
    hp: ENEMIES.eliteGuard.hp,
    speed: ENEMIES.eliteGuard.speed,
    sight: ENEMIES.eliteGuard.sight,
    flying: false,
    ranged: false,
    indoorAllowed: true,
    outdoorAllowed: false,
    requiresFacility: true,
    special: 'dashStrike'
  },
  // Enemy E: Security Robot (HP 90, electric shot + short-range EMP pulse that jams special abilities, drops 8-32GB RAM)
  securityRobot: {
    kind: 'securityRobot',
    role: 'drone',
    hp: ENEMIES.securityRobot.hp,
    speed: ENEMIES.securityRobot.speed,
    sight: ENEMIES.securityRobot.sight,
    flying: false,
    ranged: true,
    indoorAllowed: true,
    outdoorAllowed: true,
    requiresFacility: true,
    special: 'empPulse'
  },
  // Enemy F: Combat Drone (HP 65, flying, 3-shot burst fire, drops 16-32GB RAM)
  combatDrone: {
    kind: 'combatDrone',
    role: 'drone',
    hp: ENEMIES.combatDrone.hp,
    speed: ENEMIES.combatDrone.speed,
    sight: ENEMIES.combatDrone.sight,
    flying: true,
    ranged: true,
    indoorAllowed: true,
    outdoorAllowed: true,
    requiresFacility: true,
    special: 'burstFire'
  },
  // Legacy / Street types preserved for 100% compatibility
  guard: {
    kind: 'guard',
    role: 'police',
    hp: ENEMIES.guard.hp,
    speed: ENEMIES.guard.speed,
    sight: ENEMIES.guard.sight,
    flying: false,
    ranged: false,
    indoorAllowed: false,
    outdoorAllowed: true,
    special: 'batonSwing'
  },
  robot: {
    kind: 'robot',
    role: 'utility',
    hp: ENEMIES.robot.hp,
    speed: ENEMIES.robot.speed,
    sight: 0,
    flying: false,
    ranged: false,
    indoorAllowed: true,
    outdoorAllowed: true,
    special: 'none'
  },
  heavy: {
    kind: 'heavy',
    role: 'heavy',
    hp: ENEMIES.heavy.hp,
    speed: ENEMIES.heavy.speed,
    sight: ENEMIES.heavy.sight,
    flying: false,
    ranged: false,
    indoorAllowed: true,
    outdoorAllowed: true,
    requiresFacility: true,
    special: 'dashStrike'
  },
  drone: {
    kind: 'drone',
    role: 'drone',
    hp: ENEMIES.drone.hp,
    speed: ENEMIES.drone.speed,
    sight: ENEMIES.drone.sight,
    flying: true,
    ranged: true,
    indoorAllowed: false,
    outdoorAllowed: true,
    special: 'none'
  },
  enhancedDrone: {
    kind: 'enhancedDrone',
    role: 'drone',
    hp: ENEMIES.enhancedDrone.hp,
    speed: ENEMIES.enhancedDrone.speed,
    sight: ENEMIES.enhancedDrone.sight,
    flying: true,
    ranged: true,
    indoorAllowed: true,
    outdoorAllowed: true,
    requiresFacility: true,
    special: 'none'
  }
};

export interface EnemySpawn {
  id: string;
  kind: EnemyKind;
  sceneId: string;
  x: number;
  y: number;
  min: number;
  max: number;
  activity?: ResidentActivity;
  facing?: -1 | 1;
  facility?: boolean;
}

export function allowedTerritory(kind: EnemyKind, sceneId: string, facility = false) {
  const cfg = ENEMY_TYPES[kind];
  if (sceneId === 'street') return cfg.outdoorAllowed;
  if (!cfg.indoorAllowed) return false;
  return !cfg.requiresFacility || facility;
}

export type DetectionStage = 'unaware' | 'suspicious' | 'alert' | 'confirmed';

export class EnemyMemory {
  readonly config: EnemyTypeConfig;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  facing: -1 | 1;
  state: AIState;
  defeated = false;
  dropResolved = false;
  invincibleUntil = -Infinity;
  hurtUntil = -Infinity;
  suspiciousUntil = -Infinity;
  searchUntil = -Infinity;
  lastSeenAt = -Infinity;
  lastSeenX: number;
  nextAttackAt = 0;
  attackWindupAt = 0;
  knockbackDirection: -1 | 1 = 1;
  alarmed = false;
  noiseTargetX?: number;
  heardNoiseAt = -Infinity;
  sleepDisturbance = 0;
  wokenUp = false;

  // Phase 1.3: Detection Gauge (0..100)
  detectionGauge = 0;
  lastDecidedAt?: number;

  // Phase 2 & 3: Special attacks & tactical state
  specialState: 'none' | 'windup' | 'active' = 'none';
  specialWindupUntil = 0;
  specialActiveUntil = 0;
  nextSpecialAt = 0;
  specialDirection: -1 | 1 = 1;
  shielding = false;
  shieldUntil = 0;
  burstShotsRemaining = 0;
  nextBurstShotAt = 0;
  nextPatrolTurnAt = 1600;

  constructor(readonly spawn: EnemySpawn, readonly control: EnemyControl = new EnemyControl()) {
    this.config = ENEMY_TYPES[spawn.kind];
    this.hp = this.config.hp;
    this.maxHp = this.config.hp;
    this.x = spawn.x;
    this.y = spawn.y;
    this.facing = spawn.facing ?? 1;
    this.lastSeenX = spawn.x;
    this.state = spawn.activity && spawn.activity !== 'patrol' && this.config.role === 'civilian' ? 'IDLE' : 'PATROL';
  }

  get detectionStage(): DetectionStage {
    if (this.detectionGauge >= DETECTION.confirmedThreshold || this.state === 'CHASE' || this.state === 'ATTACK') {
      return 'confirmed';
    }
    if (this.detectionGauge >= DETECTION.alertThreshold) return 'alert';
    if (this.detectionGauge >= DETECTION.suspiciousThreshold) return 'suspicious';
    return 'unaware';
  }

  hit(rawDamage: number, now: number, direction: number): { hit: boolean; killed: boolean; damage: number; shielded: boolean } {
    if (this.defeated || this.config.role === 'utility' || rawDamage <= 0 || now < this.invincibleUntil) {
      return { hit: false, killed: false, damage: 0, shielded: false };
    }
    const attackDir: -1 | 1 = direction < 0 ? -1 : 1;
    // Elite Guard / Heavy frontal guard: if attacked from the front (projectile moving opposite to enemy facing) while shielding or in front stance, reduce damage by 50%. Backstab deals full 100% damage.
    const isFrontAttack = attackDir * this.facing < 0;
    const hasFrontArmor = this.spawn.kind === 'eliteGuard' || this.spawn.kind === 'heavy';
    const isShieldedFront = hasFrontArmor && isFrontAttack && (this.shielding || ['IDLE', 'PATROL', 'SUSPICIOUS', 'CHASE', 'ATTACK'].includes(this.state));
    const damage = isShieldedFront
      ? Math.max(1, Math.round(rawDamage * COMBAT.eliteFrontDamageMultiplier))
      : rawDamage;

    this.hp = Math.max(0, this.hp - damage);
    this.invincibleUntil = now + COMBAT.enemyHitInvincibleMs;
    this.hurtUntil = now + COMBAT.hurtRecoverMs;
    this.knockbackDirection = attackDir;
    this.alarmed = true;
    this.wokenUp = true;
    this.detectionGauge = DETECTION.maxGauge;
    this.lastSeenAt = now;
    this.lastSeenX = this.x - this.knockbackDirection * 90;
    // Attacking from behind turns the enemy around after the hit
    if (!isFrontAttack) {
      this.facing = (-attackDir) as -1 | 1;
    }
    this.attackWindupAt = 0;
    this.specialState = 'none';
    if (this.hp === 0) {
      this.defeated = true;
      this.state = 'DEFEATED';
      this.noiseTargetX = undefined;
      this.shielding = false;
    } else {
      this.state = 'HURT';
    }
    return { hit: true, killed: this.defeated, damage, shielded: isShieldedFront };
  }

  hearNoise(event: SoundEvent, now: number): boolean {
    if (!FEATURES.noise && event.action !== 'alarm') return false;
    if (this.defeated || this.config.role === 'utility' || now < this.hurtUntil) return false;
    if (!canHearAcrossZones(event.sceneId, this.spawn.sceneId, event.crossZone)) return false;
    if (this.control.mode(now, this.x, this.y) !== 'normal') return false;
    const hearingSensitivity = this.spawn.kind === 'alertResident' || this.spawn.kind === 'eliteGuard' ? 1.25 : 1.0;
    const dist = Math.hypot(this.x - event.x, this.y - event.y);
    if (dist > event.radius * hearingSensitivity) return false;

    if (this.spawn.activity === 'sleep' && !this.alarmed && !this.wokenUp) {
      if (event.action === 'crouchWalk') return false;
      const elapsedSec = Math.max(0, (now - Math.max(0, this.heardNoiseAt)) / 1000);
      this.sleepDisturbance = Math.max(0, this.sleepDisturbance - elapsedSec * STEALTH.sleepDecayPerSecond);
      const added = event.action === 'walk' ? 12 : event.volume;
      this.sleepDisturbance += added;
      this.heardNoiseAt = now;
      if (event.volume >= 35 || this.sleepDisturbance >= STEALTH.sleepWakeThreshold) {
        this.wokenUp = true;
        this.alarmed = true;
        this.detectionGauge = Math.max(this.detectionGauge, 55);
        this.noiseTargetX = event.x;
        this.lastSeenX = event.x;
        this.facing = Math.sign(event.x - this.x) || this.facing;
        this.suspiciousUntil = now + STEALTH.suspiciousMs;
        this.searchUntil = now + STEALTH.suspiciousMs + STEALTH.noiseSearchMs;
        this.state = 'SUSPICIOUS';
        return true;
      }
      return false;
    }

    if (['CHASE', 'ATTACK'].includes(this.state) && now - this.lastSeenAt <= AI.loseTargetMs) {
      this.lastSeenX = event.x;
      return false;
    }

    this.noiseTargetX = event.x;
    this.lastSeenX = event.x;
    this.heardNoiseAt = now;
    this.facing = Math.sign(event.x - this.x) || this.facing;
    // Hearing a noise raises suspicion gauge (1..85) without immediately reaching 100 (confirmed pursuit)
    const gaugeBump = event.volume >= 45 ? 65 : event.volume >= 25 ? 45 : 28;
    this.detectionGauge = Math.min(85, Math.max(this.detectionGauge, gaugeBump));
    if (event.volume >= 45) this.alarmed = true;
    this.suspiciousUntil = now + STEALTH.suspiciousMs;
    this.searchUntil = now + STEALTH.suspiciousMs + STEALTH.noiseSearchMs;
    this.state = 'SUSPICIOUS';
    return true;
  }

  receiveAlertNotification(targetX: number, now: number) {
    if (this.defeated || this.config.role === 'utility') return;
    this.wokenUp = true;
    this.alarmed = true;
    this.noiseTargetX = targetX;
    this.lastSeenX = targetX;
    this.detectionGauge = Math.max(this.detectionGauge, 70);
    this.facing = Math.sign(targetX - this.x) || this.facing;
    this.suspiciousUntil = now + 350;
    this.searchUntil = now + AI.searchMs;
    if (!['CHASE', 'ATTACK'].includes(this.state)) {
      this.state = 'SEARCH';
    }
  }

  loseTarget(now: number, doorX: number) {
    if (this.defeated) return;
    this.attackWindupAt = 0;
    this.specialState = 'none';
    this.lastSeenAt = -Infinity;
    this.noiseTargetX = undefined;
    this.detectionGauge = Math.min(this.detectionGauge, 35);
    if (this.config.role === 'civilian') this.state = 'RETURN';
    else if (['CHASE', 'ATTACK', 'SUSPICIOUS'].includes(this.state)) {
      this.state = 'SEARCH';
      this.lastSeenX = doorX;
      this.searchUntil = now + AI.entrySearchMs;
    }
  }
}

export interface EnemyContext {
  now: number;
  sceneId: string;
  playerX: number;
  playerY: number;
  wantedLevel: number;
  occluders: readonly Rect[];
  lure?: Lure;
  reacquireAt: number;
  playerCrouching?: boolean;
  playerCollecting?: boolean;
}

export function seesPlayer(enemy: EnemyMemory, context: EnemyContext) {
  if (enemy.defeated || enemy.spawn.sceneId !== context.sceneId || context.now < context.reacquireAt || context.now < enemy.hurtUntil) return false;
  if (enemy.control.mode(context.now, enemy.x, enemy.y, context.lure) !== 'normal' || enemy.config.role === 'utility') return false;
  if (!enemy.alarmed && !enemy.wokenUp && enemy.spawn.activity === 'sleep') return false;

  const profile = VISION_PROFILES[enemy.spawn.kind] ?? VISION_PROFILES.resident;
  const dx = context.playerX - enemy.x;
  const dy = Math.abs(context.playerY - enemy.y);
  const crouching = !!context.playerCrouching && FEATURES.stealth;
  const absDx = Math.abs(dx);
  const pointBlankFront = absDx <= DETECTION.pointBlankDistance && dx * enemy.facing >= -12;

  // Crouching behind an enemy is completely unseen; standing behind (>35px) is unseen.
  if (crouching && dx * enemy.facing < 0 && !pointBlankFront) return false;
  if (dx * enemy.facing < -35) return false;

  const range = crouching && !pointBlankFront ? profile.range * STEALTH.crouchVisionRatio : profile.range;
  if (absDx > range || dy > profile.verticalRange) return false;

  // FOV angle check for targets beyond point-blank distance
  if (absDx > 36) {
    const angleDeg = Math.atan2(dy, absDx) * (180 / Math.PI);
    if (angleDeg > profile.fovDeg * 0.5) return false;
  }

  const playerEyeY = context.playerY - (crouching ? STEALTH.crouchEyeHeightOffset : STEALTH.standEyeHeightOffset);
  return clearSight(enemy.x, enemy.y - (enemy.config.flying ? 24 : 52), context.playerX, playerEyeY, context.occluders);
}

export function computeDetectionRate(enemy: EnemyMemory, context: EnemyContext): number {
  const profile = VISION_PROFILES[enemy.spawn.kind] ?? VISION_PROFILES.resident;
  const dist = Math.abs(context.playerX - enemy.x);
  const crouching = !!context.playerCrouching && FEATURES.stealth;
  const pointBlank = dist <= DETECTION.pointBlankDistance;

  let baseRate: number;
  if (pointBlank) {
    baseRate = 125;
  } else if (dist <= profile.range * DETECTION.closeDistanceRatio) {
    baseRate = DETECTION.closeRatePerSec;
  } else if (dist <= profile.range * DETECTION.midDistanceRatio) {
    baseRate = DETECTION.midRatePerSec;
  } else {
    baseRate = DETECTION.farRatePerSec;
  }

  let rate = baseRate * profile.speedMul;
  if (crouching && !pointBlank) rate *= DETECTION.crouchRateMultiplier;
  if (context.playerCollecting) rate *= DETECTION.collectingRateMultiplier;
  return rate;
}

export interface EnemyDecision {
  state: AIState;
  mode: EnemyMode;
  velocityX: number;
  direction: number;
  seen: boolean;
  pursuing: boolean;
  harmful: boolean;
  fire: boolean;
  icon: '' | '?' | '!' | '…';
  detectionGauge: number;
  detectionStage: DetectionStage;
  specialWarning?: string;
  empPulse?: boolean;
  alertCall?: boolean;
  shielding?: boolean;
}

export function decideEnemy(enemy: EnemyMemory, context: EnemyContext): EnemyDecision {
  const now = context.now;
  const dtMs = enemy.lastDecidedAt === undefined ? 16 : Math.max(0, Math.min(1000, now - enemy.lastDecidedAt));
  enemy.lastDecidedAt = now;

  const result = (
    state: AIState,
    velocityX = 0,
    seen = false,
    harmful = false,
    fire = false,
    mode: EnemyMode = 'normal',
    extra?: { specialWarning?: string; empPulse?: boolean; alertCall?: boolean }
  ): EnemyDecision => {
    enemy.state = state;
    const stage = enemy.detectionStage;
    const icon: '' | '?' | '!' | '…' =
      state === 'CHASE' || state === 'ATTACK' || stage === 'confirmed' ? '!' :
      state === 'SUSPICIOUS' || stage === 'suspicious' || stage === 'alert' ? '?' :
      state === 'SEARCH' ? '…' : '';
    return {
      state,
      mode,
      velocityX,
      direction: Math.sign(velocityX) || enemy.facing,
      seen,
      pursuing: state === 'CHASE' || state === 'ATTACK',
      harmful,
      fire,
      icon,
      detectionGauge: Math.round(enemy.detectionGauge),
      detectionStage: stage,
      specialWarning: extra?.specialWarning,
      empPulse: extra?.empPulse,
      alertCall: extra?.alertCall,
      shielding: enemy.shielding
    };
  };

  if (enemy.defeated) {
    enemy.shielding = false;
    return result('DEFEATED');
  }
  if (enemy.spawn.sceneId !== context.sceneId) {
    enemy.loseTarget(now, enemy.lastSeenX);
    return result(enemy.state);
  }
  if (now < enemy.hurtUntil) {
    enemy.shielding = false;
    return result('HURT', enemy.knockbackDirection * COMBAT.knockbackSpeed);
  }

  const mode = enemy.control.mode(now, enemy.x, enemy.y, context.lure);
  if (mode === 'stunned') {
    enemy.attackWindupAt = 0;
    enemy.specialState = 'none';
    enemy.shielding = false;
    return result('STUNNED', 0, false, false, false, mode);
  }
  if (mode === 'confused') {
    enemy.specialState = 'none';
    enemy.shielding = false;
    return result('SUSPICIOUS', enemy.control.confusedDirection * enemy.config.speed, false, false, false, mode);
  }
  if (mode === 'distracted') {
    enemy.specialState = 'none';
    enemy.shielding = false;
    return result('PATROL', Math.abs(enemy.x - context.lure!.x) < 20 ? 0 : Math.sign(context.lure!.x - enemy.x) * enemy.config.speed, false, false, false, mode);
  }

  const speed = enemy.config.speed * (1 + context.wantedLevel * 0.025);

  // Handle active special attack execution / windup completion even if player briefly steps out of FOV
  if (enemy.specialState === 'windup') {
    enemy.shielding = false;
    const special = enemy.config.special;
    if (now < enemy.specialWindupUntil) {
      const warnLabel =
        special === 'alertCall' ? '⚠ CALLING HELP!' :
        special === 'batonSwing' ? '⚠ BATON SWING!' :
        special === 'dashStrike' ? '⚠ DASH STRIKE!' :
        special === 'empPulse' ? '⚠ EMP CHARGING!' :
        special === 'burstFire' ? '⚠ BURST FIRE!' : '⚠ ATTACK!';
      return result('ATTACK', 0, true, true, false, 'normal', { specialWarning: warnLabel });
    }
    // Windup finished -> trigger special
    if (special === 'alertCall') {
      enemy.specialState = 'none';
      enemy.nextSpecialAt = now + AI.alertCallCooldownMs;
      return result('CHASE', enemy.facing * speed, true, true, false, 'normal', { alertCall: true, specialWarning: '📢 ALERT!' });
    }
    if (special === 'empPulse') {
      enemy.specialState = 'none';
      enemy.nextSpecialAt = now + AI.empCooldownMs;
      return result('ATTACK', 0, true, true, false, 'normal', { empPulse: true, specialWarning: '⚡ EMP PULSE!' });
    }
    if (special === 'batonSwing') {
      enemy.specialState = 'active';
      enemy.specialActiveUntil = now + AI.batonDurationMs;
      enemy.nextSpecialAt = now + AI.batonCooldownMs;
    } else if (special === 'dashStrike') {
      enemy.specialState = 'active';
      enemy.specialActiveUntil = now + AI.dashDurationMs;
      enemy.nextSpecialAt = now + AI.dashCooldownMs;
      enemy.shieldUntil = now + AI.dashDurationMs + 1500;
    } else if (special === 'burstFire') {
      enemy.specialState = 'active';
      enemy.burstShotsRemaining = AI.burstShotCount;
      enemy.nextBurstShotAt = now;
      enemy.specialActiveUntil = now + AI.burstShotCount * AI.burstShotIntervalMs + 60;
      enemy.nextSpecialAt = now + AI.burstCooldownMs;
    }
  }

  if (enemy.specialState === 'active') {
    const special = enemy.config.special;
    if (now < enemy.specialActiveUntil) {
      if (special === 'batonSwing') {
        return result('ATTACK', enemy.specialDirection * AI.batonSpeed, true, true, false, 'normal', { specialWarning: '！ SWING!' });
      }
      if (special === 'dashStrike') {
        return result('ATTACK', enemy.specialDirection * AI.dashSpeed, true, true, false, 'normal', { specialWarning: '！ DASH!' });
      }
      if (special === 'burstFire') {
        let fireNow = false;
        if (enemy.burstShotsRemaining > 0 && now >= enemy.nextBurstShotAt) {
          fireNow = true;
          enemy.burstShotsRemaining--;
          enemy.nextBurstShotAt = now + AI.burstShotIntervalMs;
        }
        return result('ATTACK', 0, true, true, fireNow, 'normal', { specialWarning: '！ BURST!' });
      }
    }
    enemy.specialState = 'none';
  }

  const seen = seesPlayer(enemy, context);
  if (seen && enemy.noiseTargetX !== undefined) {
    enemy.alarmed = true;
    enemy.noiseTargetX = undefined;
    enemy.detectionGauge = DETECTION.maxGauge;
  }

  if (seen) {
    const firstSight = !['CHASE', 'ATTACK', 'SUSPICIOUS'].includes(enemy.state) && enemy.detectionGauge === 0;
    if (firstSight) {
      const profile = VISION_PROFILES[enemy.spawn.kind] ?? VISION_PROFILES.resident;
      enemy.detectionGauge = Math.min(95, 32 * profile.speedMul);
      enemy.suspiciousUntil = now + AI.suspiciousMs;
      enemy.state = 'SUSPICIOUS';
    }
    const rate = computeDetectionRate(enemy, context);
    enemy.detectionGauge = Math.min(DETECTION.maxGauge, enemy.detectionGauge + (dtMs / 1000) * rate);

    const fastDetector = enemy.config.role !== 'civilian';
    if (fastDetector && now >= enemy.suspiciousUntil) {
      enemy.detectionGauge = DETECTION.maxGauge;
    }
    if (enemy.detectionGauge >= DETECTION.confirmedThreshold) {
      enemy.alarmed = true;
    }

    enemy.lastSeenAt = now;
    enemy.lastSeenX = context.playerX;
    enemy.facing = Math.sign(context.playerX - enemy.x) || enemy.facing;

    // Still in pre-confirmation buildup (1..99 gauge)
    if (!enemy.alarmed && enemy.detectionGauge < DETECTION.confirmedThreshold) {
      const checkMove = enemy.detectionGauge >= DETECTION.alertThreshold ? enemy.facing * speed * 0.35 : 0;
      return result('SUSPICIOUS', checkMove, true, false);
    }
    if (now < enemy.suspiciousUntil && !enemy.alarmed) {
      return result('SUSPICIOUS', 0, true, false);
    }

    // Confirmed detection! Execute role/special combat AI
    const distance = Math.abs(context.playerX - enemy.x);
    const special = enemy.config.special;

    // 1. Alert Resident: warns nearby residents
    if (special === 'alertCall' && now >= enemy.nextSpecialAt) {
      enemy.specialState = 'windup';
      enemy.specialWindupUntil = now + AI.alertCallWindupMs;
      enemy.specialDirection = enemy.facing;
      return result('ATTACK', 0, true, true, false, 'normal', { specialWarning: '⚠ CALLING HELP!' });
    }

    // 2. Private Guard: melee baton swing with windup
    if (special === 'batonSwing' && distance <= AI.batonRange && now >= enemy.nextSpecialAt) {
      enemy.specialState = 'windup';
      enemy.specialWindupUntil = now + AI.batonWindupMs;
      enemy.specialDirection = enemy.facing;
      return result('ATTACK', 0, true, true, false, 'normal', { specialWarning: '⚠ BATON SWING!' });
    }

    // 3. Elite Guard / Heavy: dash strike at mid-range, plus frontal shield stance
    if (special === 'dashStrike' && distance >= AI.dashMinRange && distance <= AI.dashMaxRange && now >= enemy.nextSpecialAt) {
      enemy.specialState = 'windup';
      enemy.specialWindupUntil = now + AI.dashWindupMs;
      enemy.specialDirection = enemy.facing;
      enemy.shielding = false;
      return result('ATTACK', 0, true, true, false, 'normal', { specialWarning: '⚠ DASH STRIKE!' });
    }

    // 4. Security Robot: short-range EMP pulse when close, electric bolt at range
    if (special === 'empPulse') {
      if (distance <= AI.empRadius + 15 && now >= enemy.nextSpecialAt) {
        enemy.specialState = 'windup';
        enemy.specialWindupUntil = now + AI.empWindupMs;
        enemy.specialDirection = enemy.facing;
        return result('ATTACK', 0, true, true, false, 'normal', { specialWarning: '⚠ EMP CHARGING!' });
      }
      if (distance < AI.droneAttackRange) {
        if (!enemy.attackWindupAt) enemy.attackWindupAt = now + AI.droneWindupMs;
        const fire = now >= enemy.attackWindupAt && now >= enemy.nextAttackAt;
        if (fire) {
          enemy.nextAttackAt = now + AI.droneAttackCooldownMs;
          enemy.attackWindupAt = now + AI.droneWindupMs;
        }
        // Maintain spacing: back up slightly if too close while EMP is on cooldown
        const spacingVel = distance < 85 ? -enemy.facing * speed * 0.45 : 0;
        return result('ATTACK', spacingVel, true, true, fire);
      }
    }

    // 5. Flying Drones (standard drone, enhancedDrone, combatDrone)
    if (enemy.config.flying) {
      if (special === 'burstFire' && distance < AI.droneAttackRange && now >= enemy.nextSpecialAt) {
        enemy.specialState = 'windup';
        enemy.specialWindupUntil = now + AI.burstWindupMs;
        enemy.specialDirection = enemy.facing;
        return result('ATTACK', 0, true, true, false, 'normal', { specialWarning: '⚠ BURST FIRE!' });
      }
      if (distance < AI.droneAttackRange) {
        if (!enemy.attackWindupAt) enemy.attackWindupAt = now + AI.droneWindupMs;
        const fire = now >= enemy.attackWindupAt && now >= enemy.nextAttackAt;
        if (fire) {
          enemy.nextAttackAt = now + AI.droneAttackCooldownMs;
          enemy.attackWindupAt = now + AI.droneWindupMs;
        }
        const spacingVel = enemy.spawn.kind === 'combatDrone' && distance < 110 ? -enemy.facing * speed * 0.55 : 0;
        return result('ATTACK', spacingVel, true, true, fire);
      }
    }

    // Standard melee reach
    if (distance < 33) {
      enemy.shielding = false;
      return result('ATTACK', 0, true, true, false);
    }

    enemy.attackWindupAt = 0;
    enemy.shielding = (enemy.spawn.kind === 'eliteGuard' || enemy.spawn.kind === 'heavy') && now < enemy.shieldUntil;
    const chaseSpeed = enemy.shielding ? speed * 0.78 : speed;
    return result('CHASE', enemy.facing * chaseSpeed, true, true);
  }

  // Player not currently in line of sight: decay detection gauge
  enemy.attackWindupAt = 0;
  enemy.shielding = false;
  enemy.detectionGauge = Math.max(0, enemy.detectionGauge - (dtMs / 1000) * DETECTION.decayPerSec);

  // Noise investigation flow (SUSPICIOUS -> move to sound source -> SEARCH -> RETURN)
  if (enemy.noiseTargetX !== undefined) {
    const distToNoise = enemy.noiseTargetX - enemy.x;
    if (now < enemy.suspiciousUntil) {
      enemy.facing = Math.sign(distToNoise) || enemy.facing;
      const moveVel = Math.abs(distToNoise) > 20 ? Math.sign(distToNoise) * speed * 0.55 : 0;
      return result('SUSPICIOUS', moveVel, false, false);
    }
    if (now < enemy.searchUntil) {
      if (Math.abs(distToNoise) > 24) {
        enemy.facing = Math.sign(distToNoise) || enemy.facing;
        return result('SEARCH', enemy.facing * speed * 0.7, false, false);
      }
      const scanDir = Math.floor((now - enemy.suspiciousUntil) / 650) % 2 === 0 ? 1 : -1;
      enemy.facing = scanDir;
      return result('SEARCH', scanDir * speed * 0.35, false, false);
    }
    enemy.noiseTargetX = undefined;
    if (enemy.spawn.activity === 'sleep') {
      enemy.wokenUp = false;
      enemy.alarmed = false;
      enemy.sleepDisturbance = 0;
    }
    enemy.state = 'RETURN';
  }

  const aggressive = enemy.alarmed || enemy.config.role !== 'civilian';
  if (aggressive && ['CHASE', 'ATTACK'].includes(enemy.state) && now - enemy.lastSeenAt <= AI.loseTargetMs) {
    return result('CHASE', Math.sign(enemy.lastSeenX - enemy.x) * speed, false, true);
  }
  if (aggressive && ['CHASE', 'ATTACK', 'SUSPICIOUS'].includes(enemy.state)) {
    enemy.state = 'SEARCH';
    enemy.searchUntil = now + AI.searchMs;
  }
  if (enemy.state === 'SEARCH') {
    if (now < enemy.searchUntil) {
      const dist = enemy.lastSeenX - enemy.x;
      if (Math.abs(dist) > 25) {
        enemy.facing = Math.sign(dist) || enemy.facing;
        return result('SEARCH', enemy.facing * speed * 0.65);
      }
      const scanDir = Math.floor(now / 700) % 2 === 0 ? 1 : -1;
      enemy.facing = scanDir;
      return result('SEARCH', scanDir * speed * 0.3);
    }
    enemy.state = 'RETURN';
  }
  if (enemy.state === 'RETURN') {
    if (Math.abs(enemy.x - enemy.spawn.x) > 25) {
      enemy.facing = Math.sign(enemy.spawn.x - enemy.x) || enemy.facing;
      return result('RETURN', enemy.facing * speed * 0.6);
    }
    enemy.alarmed = false;
    enemy.state = enemy.spawn.activity === 'patrol' || enemy.config.role !== 'civilian' ? 'PATROL' : 'IDLE';
  }

  if (enemy.config.role === 'civilian' && enemy.spawn.activity !== 'patrol') {
    // Stationary awake residents periodically glance around after run starts so timing matters
    if (enemy.spawn.activity !== 'sleep' && now > 2400 && Math.floor(now / 3400) % 2 === 1) {
      enemy.facing = -(enemy.spawn.facing ?? 1);
    } else if (now > 0) {
      enemy.facing = enemy.spawn.facing ?? 1;
    }
    return result('IDLE');
  }

  if (enemy.x <= enemy.spawn.min) enemy.facing = 1;
  if (enemy.x >= enemy.spawn.max) enemy.facing = -1;
  // Indoor security & alert residents periodically turn to scan the room during patrol
  if (enemy.spawn.sceneId.startsWith('house:') && enemy.config.role !== 'utility' && now >= enemy.nextPatrolTurnAt) {
    enemy.nextPatrolTurnAt = now + AI.patrolTurnIntervalMs;
    if (enemy.x > enemy.spawn.min + 45 && enemy.x < enemy.spawn.max - 45) {
      enemy.facing = -enemy.facing;
    }
  }
  return result('PATROL', enemy.facing * speed * 0.58, false, enemy.config.role === 'utility');
}
