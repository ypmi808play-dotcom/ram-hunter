/** All combat/drop/AI tuning lives here; durations use the paused gameplay clock. */
export const COMBAT = {
  chipDamage: 10, hitInvincibleMs: 200, enemyHitInvincibleMs: 200, hitRecoveryMs: 140, hurtRecoverMs: 140,
  knockbackSpeed: 145, knockbackMs: 140, healthBarMs: 3000, knockoutVisibleMs: 1150,
  eliteFrontDamageMultiplier: 0.5, empJamDurationMs: 3000
} as const;

export const ENEMIES = {
  resident: { hp: 20, speed: 120, sight: 210 },
  engineer: { hp: 20, speed: 125, sight: 220 },
  alertResident: { hp: 40, speed: 142, sight: 245 },
  privateGuard: { hp: 70, speed: 168, sight: 270 },
  eliteGuard: { hp: 120, speed: 182, sight: 330 },
  securityRobot: { hp: 90, speed: 150, sight: 300 },
  combatDrone: { hp: 65, speed: 195, sight: 350 },
  guard: { hp: 60, speed: 175, sight: 310 },
  robot: { hp: 999, speed: 78, sight: 0 },
  heavy: { hp: 100, speed: 155, sight: 320 },
  drone: { hp: 50, speed: 190, sight: 380 },
  enhancedDrone: { hp: 70, speed: 205, sight: 380 }
} as const;

export const DROPS = {
  civilianHealthChance: 0.12, healthAmount: 1, lifetimeMs: 16000,
  droneMinGB: 8, droneMaxGB: 16, enhancedMinGB: 16, enhancedMaxGB: 32,
  robotMinGB: 8, robotMaxGB: 32, combatDroneMinGB: 16, combatDroneMaxGB: 32,
  droneRunCapGB: 64
} as const;

export const AI = {
  citizenVision: 210, policeVision: 310, droneVision: 380,
  loseTargetMs: 1600, searchMs: 4500, suspiciousMs: 380,
  entrySearchMs: 5000, exitAcquireGraceMs: 1100,
  droneAttackRange: 280, droneWindupMs: 400, droneAttackCooldownMs: 2500,
  reinforcementIntervalMs: 12000, reinforcementRecoveryMs: 8000, reinforcementGraceMs: 20000,
  patrolTurnIntervalMs: 3200,
  // Special attack parameters (Phase 3.2 & 3.3)
  alertCallWindupMs: 520, alertCallCooldownMs: 8000, alertCallRadius: 420,
  batonWindupMs: 550, batonDurationMs: 220, batonCooldownMs: 2200, batonRange: 76, batonSpeed: 265,
  dashWindupMs: 650, dashDurationMs: 380, dashCooldownMs: 4200, dashMinRange: 80, dashMaxRange: 270, dashSpeed: 420,
  empWindupMs: 700, empCooldownMs: 6200, empRadius: 145,
  burstWindupMs: 520, burstShotIntervalMs: 170, burstShotCount: 3, burstCooldownMs: 2700
} as const;
