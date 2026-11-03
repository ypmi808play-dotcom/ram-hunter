import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXTRACTION,
  FEATURES,
  GAME,
  GAME_TITLE,
  RISK_MODE,
  STEALTH
} from '../src/core/config.ts';
import { StealthController, isCoverFurniture } from '../src/core/StealthController.ts';
import { NoiseSystem, canHearAcrossZones } from '../src/core/NoiseSystem.ts';
import {
  HouseEventManager,
  HOUSE_EVENT_TYPES,
  isHouseCompatibleWithEvent
} from '../src/core/HouseEventManager.ts';
import {
  ExtractionSystem,
  EXTRACTION_STATUS_LABELS,
  settleRunRam
} from '../src/core/ExtractionSystem.ts';
import { EnemyMemory, decideEnemy, seesPlayer } from '../src/core/enemies.ts';
import type { EnemyContext, EnemySpawn } from '../src/core/enemies.ts';
import { createNeighborhood, effectivePcRam, furnitureOccluderRect } from '../src/core/houses.ts';
import { RunSession } from '../src/core/session.ts';
import { createDataCenterPlan } from '../src/core/empire.ts';
import { SAM_FRAMES } from '../src/art/sam.ts';

const baseSpawn = (
  id: string,
  kind: EnemySpawn['kind'] = 'resident',
  sceneId = kind === 'resident' ? 'house:1' : 'street'
): EnemySpawn => ({
  id,
  kind,
  sceneId,
  x: 600,
  y: 590,
  min: 300,
  max: 900,
  activity: 'patrol',
  facing: 1
});

const baseContext = (now = 0, sceneId = 'house:1'): EnemyContext => ({
  now,
  sceneId,
  playerX: 950,
  playerY: 590,
  wantedLevel: 0,
  occluders: [],
  reacquireAt: 0,
  playerCrouching: false
});

// ============================================================================
// Phase 17: Stealth & Noise System Tests
// ============================================================================

test('Stealth 1 & 2: Left Ctrl crouching lowers speed to 55%, disables dash, cancels on jump, allows collection, and has dedicated frames', () => {
  const stealth = new StealthController();
  assert.equal(SAM_FRAMES.crouch, 4, 'Dedicated crouch animation frames must exist');

  // Standing speed & dash
  assert.equal(stealth.update(false, false, true), false);
  assert.equal(stealth.movementSpeed(false), GAME.walkSpeed);
  assert.equal(stealth.movementSpeed(true), GAME.dashSpeed);
  assert.equal(stealth.canDash, true);

  // Crouching speed (55% of walkSpeed) and dash disabled
  assert.equal(stealth.update(true, false, true), true);
  assert.equal(stealth.crouching, true);
  assert.equal(stealth.movementSpeed(false), Math.round(GAME.walkSpeed * 0.55));
  assert.equal(stealth.movementSpeed(true), Math.round(GAME.walkSpeed * 0.55));
  assert.equal(stealth.canDash, false);
  assert.equal(stealth.canCollect, true);
  assert.equal(stealth.stepNoiseAction(true), 'crouchWalk');

  // Jumping cancels crouch immediately
  assert.equal(stealth.update(true, true, true), false);
  assert.equal(stealth.crouching, false);

  // Airborne cancels crouch
  assert.equal(stealth.update(true, false, false), false);
  assert.equal(stealth.crouching, false);

  // Feature toggle disables crouch
  FEATURES.stealth = false;
  try {
    assert.equal(stealth.update(true, false, true), false);
  } finally {
    FEATURES.stealth = true;
  }
});

test('Stealth 2b: crouching shortens enemy vision distance and allows sofa low-cover occlusion', () => {
  const enemy = new EnemyMemory(baseSpawn('citizen:1', 'resident', 'house:1'));
  // Resident normal vision is 185px; at distance 150px, standing player is seen, but crouching player (185 * 0.6 = 111px) is unseen!
  const standingCtx: EnemyContext = { ...baseContext(0, 'house:1'), playerX: 750, playerCrouching: false };
  const crouchingCtx: EnemyContext = { ...baseContext(0, 'house:1'), playerX: 750, playerCrouching: true };
  assert.equal(seesPlayer(enemy, standingCtx), true);
  assert.equal(seesPlayer(enemy, crouchingCtx), false);

  // Within 90px, crouching player is seen in the open, but hidden behind a sofa!
  const sofaOccluder = furnitureOccluderRect({
    id: '1:living',
    kind: 'sofa',
    x: 645,
    floorY: 590,
    width: 152,
    height: 43,
    solid: true,
    blocksSight: true
  })!;
  assert.ok(sofaOccluder);
  assert.equal( isCoverFurniture('sofa'), true);
  assert.equal(isCoverFurniture('shelf'), true);
  assert.equal(isCoverFurniture('partition'), true);
  assert.equal(isCoverFurniture('tv'), false);

  // At x=690 (distance 90px), standing player is visible over the sofa, while crouching player is blocked by the sofa!
  assert.equal(seesPlayer(enemy, { ...baseContext(0, 'house:1'), playerX: 690, occluders: [sofaOccluder], playerCrouching: false }), true);
  assert.equal(seesPlayer(enemy, { ...baseContext(0, 'house:1'), playerX: 690, occluders: [sofaOccluder], playerCrouching: true }), false);
});

test('Stealth 3 & 4: sound events use configured radii and strictly isolate indoor, outdoor, and attic acoustic zones', () => {
  assert.deepEqual(STEALTH.noiseLevels.crouchWalk, { volume: 5, radius: 35 });
  assert.deepEqual(STEALTH.noiseLevels.walk, { volume: 15, radius: 90 });
  assert.deepEqual(STEALTH.noiseLevels.dash, { volume: 35, radius: 180 });
  assert.deepEqual(STEALTH.noiseLevels.jumpLand, { volume: 25, radius: 130 });
  assert.deepEqual(STEALTH.noiseLevels.collect, { volume: 30, radius: 150 });
  assert.deepEqual(STEALTH.noiseLevels.attack, { volume: 45, radius: 210 });
  assert.deepEqual(STEALTH.noiseLevels.special, { volume: 65, radius: 280 });
  assert.equal(STEALTH.noiseLevels.alarm.volume, 100);

  // Acoustic zone rules
  assert.equal(canHearAcrossZones('house:2', 'street', false), false);
  assert.equal(canHearAcrossZones('street', 'house:2', false), false);
  assert.equal(canHearAcrossZones('house:2', 'house:2:attic', false), false);
  assert.equal(canHearAcrossZones('house:2:attic', 'house:2', false), false);
  assert.equal(canHearAcrossZones('house:2', 'house:3', false), false);
  assert.equal(canHearAcrossZones('house:2', 'house:2', false), true);
  assert.equal(canHearAcrossZones('house:2', 'house:2:attic', true), true);

  const run = new RunSession(42);
  const indoorNpc = run.enemyFor(baseSpawn('citizen:indoor', 'resident', 'house:2'))!;
  const outdoorCop = run.enemyFor({ ...baseSpawn('police:outdoor', 'guard', 'street'), x: 610 })!;

  // Emitting loud attack noise inside house:2 alerts indoorNpc within 210px, but NEVER alerts outdoorCop on street
  run.emitNoise('attack', 650, 590, 'house:2', 'player');
  assert.equal(indoorNpc.state, 'SUSPICIOUS');
  assert.equal(outdoorCop.state, 'PATROL');
});

test('Stealth 5 & 6: noise alone never inflates Wanted heat, respects cooldowns, and NPCs transition SUSPICIOUS -> SEARCH -> RETURN -> normal', () => {
  const run = new RunSession(42);
  const npc = run.enemyFor(baseSpawn('citizen:test', 'resident', 'house:1'))!;
  assert.equal(npc.state, 'PATROL');

  // Emit walk noise 50 times in a row: Wanted heat must remain 0 and cooldown prevents spam
  for (let i = 0; i < 50; i++) {
    run.emitNoise('walk', 660, 590, 'house:1', 'player');
    run.tick(16, [], true, false);
  }
  assert.equal(run.wanted.heat, 0);
  assert.equal(npc.state, 'SUSPICIOUS');
  assert.equal(npc.noiseTargetX, 660);

  // 1. SUSPICIOUS state shows '?' and moves toward noise source
  const d1 = decideEnemy(npc, { ...baseContext(run.elapsedMs, 'house:1'), playerX: 1200 });
  assert.equal(d1.state, 'SUSPICIOUS');
  assert.equal(d1.icon, '?');
  assert.ok(d1.velocityX > 0);

  // 2. After suspiciousMs, transitions to SEARCH ('…') around sound origin
  run.tick(STEALTH.suspiciousMs + 100, [], true, false);
  npc.x = 660;
  const d2 = decideEnemy(npc, { ...baseContext(run.elapsedMs, 'house:1'), playerX: 1200 });
  assert.equal(d2.state, 'SEARCH');
  assert.equal(d2.icon, '…');

  // 3. After noiseSearchMs expires without spotting the player, transitions to RETURN and then PATROL
  run.tick(STEALTH.noiseSearchMs + 200, [], true, false);
  const d3 = decideEnemy(npc, { ...baseContext(run.elapsedMs, 'house:1'), playerX: 1200 });
  assert.equal(d3.state, 'RETURN');
  npc.x = npc.spawn.x;
  const d4 = decideEnemy(npc, { ...baseContext(run.elapsedMs, 'house:1'), playerX: 1200 });
  assert.equal(d4.state, 'PATROL');
  assert.equal(d4.icon, '');

  // 4. If player IS visually spotted while NPC is investigating noise, NPC transitions to CHASE ('!')
  run.emitNoise('walk', 660, 590, 'house:1', 'player');
  const dSeen = decideEnemy(npc, { ...baseContext(run.elapsedMs + STEALTH.suspiciousMs + 50, 'house:1'), playerX: 700 });
  assert.equal(dSeen.state, 'CHASE');
  assert.equal(dSeen.icon, '!');
  assert.equal(dSeen.pursuing, true);
});

// ============================================================================
// Phase 18: House Special Events Tests
// ============================================================================

test('Events 1, 2, 3 & 4: 2 to 4 deterministic, compatible, non-conflicting special events are generated per seed', () => {
  const seenTypes = new Set<string>();
  for (let seed = 1; seed <= 60; seed++) {
    const runA = new RunSession(seed);
    const runB = new RunSession(seed);
    const eventsA = runA.houseEvents.all();
    const eventsB = runB.houseEvents.all();

    // Same seed produces identical events
    assert.deepEqual(eventsA, eventsB);

    // 2 to 4 events per run
    assert.ok(eventsA.length >= 2 && eventsA.length <= 4, `Seed ${seed} generated ${eventsA.length} events`);

    // Unique houses per event, never on House 0 or House 13
    const houseIds = eventsA.map(e => e.houseId);
    assert.equal(new Set(houseIds).size, houseIds.length);
    for (const ev of eventsA) {
      seenTypes.add(ev.type);
      const house = runA.houses.find(h => h.id === ev.houseId)!;
      assert.ok(house.id >= 1 && house.id <= 12);
      assert.equal(house.specialEvent, ev.type);
      if (ev.type === 'ATTIC_ROUTE') {
        assert.ok(!['loft', 'laboratory'].includes(house.layout));
        assert.ok(ev.attic);
      }
    }
  }
  // All 5 event types appear across seeds
  for (const t of HOUSE_EVENT_TYPES) {
    assert.ok(seenTypes.has(t), `Event type ${t} should be generated across seeds`);
  }
});

test('Events 5, 6 & 7: SLEEPING_HOUSE, ALARM_PC, ATTIC_ROUTE, RAM_JACKPOT, and EMPTY_HOUSE work, persist across re-entry, and prevent double rewards', () => {
  // Find a seed or test each event behavior directly
  // 1. SLEEPING_HOUSE: crouch walk never wakes resident, dash wakes resident and triggers pursuit
  const sleepNpc = new EnemyMemory({ ...baseSpawn('sleeper', 'resident', 'house:1'), activity: 'sleep' });
  const noiseSys = new NoiseSystem();
  const crouchEv = noiseSys.emitNoise('crouchWalk', 610, 590, 'house:1', 100)!;
  assert.equal(sleepNpc.hearNoise(crouchEv, 100), false);
  assert.equal(sleepNpc.wokenUp, false);

  const walkEv = noiseSys.emitNoise('walk', 610, 590, 'house:1', 1000)!;
  assert.equal(sleepNpc.hearNoise(walkEv, 1000), false);
  assert.equal(sleepNpc.wokenUp, false);

  const dashEv = noiseSys.emitNoise('dash', 620, 590, 'house:1', 2000)!;
  assert.equal(sleepNpc.hearNoise(dashEv, 2000), true);
  assert.equal(sleepNpc.wokenUp, true);
  assert.equal(sleepNpc.alarmed, true);

  // 2. Locate seeds with ALARM_PC, ATTIC_ROUTE, RAM_JACKPOT, EMPTY_HOUSE
  let alarmSeed = -1, atticSeed = -1, jackpotSeed = -1, emptySeed = -1;
  for (let s = 1; s < 200; s++) {
    const r = new RunSession(s);
    for (const ev of r.houseEvents.all()) {
      if (ev.type === 'ALARM_PC' && alarmSeed === -1) alarmSeed = s;
      if (ev.type === 'ATTIC_ROUTE' && atticSeed === -1) atticSeed = s;
      if (ev.type === 'RAM_JACKPOT' && jackpotSeed === -1) jackpotSeed = s;
      if (ev.type === 'EMPTY_HOUSE' && emptySeed === -1) emptySeed = s;
    }
  }
  assert.ok(alarmSeed > 0 && atticSeed > 0 && jackpotSeed > 0 && emptySeed > 0);

  // Test ALARM_PC: collecting without disabling terminal triggers alarm & raises heat; disabling terminal prevents alarm and persists
  const runAlarm1 = new RunSession(alarmSeed);
  const alarmEv1 = runAlarm1.houseEvents.all().find(e => e.type === 'ALARM_PC')!;
  const heatBefore = runAlarm1.wanted.heat;
  const gained1 = runAlarm1.collect(alarmEv1.targetPcId!);
  assert.ok(gained1 > 0);
  assert.equal(alarmEv1.alarmTriggered, true);
  assert.equal(runAlarm1.alarms.has(alarmEv1.houseId), true);
  assert.ok(runAlarm1.wanted.heat >= heatBefore + 8);
  // Cannot collect twice
  assert.equal(runAlarm1.collect(alarmEv1.targetPcId!), 0);

  // Now test disabling terminal first & persistence across house exit/re-entry
  const runAlarm2 = new RunSession(alarmSeed);
  const alarmEv2 = runAlarm2.houseEvents.all().find(e => e.type === 'ALARM_PC')!;
  runAlarm2.visit(alarmEv2.houseId);
  assert.equal(runAlarm2.disableSecurityTerminal(alarmEv2.houseId), true);
  assert.equal(runAlarm2.disableSecurityTerminal(alarmEv2.houseId), false); // cannot disable twice
  runAlarm2.leaveArea(`house:${alarmEv2.houseId}`, 100);
  runAlarm2.exitHouse();
  runAlarm2.visit(alarmEv2.houseId); // re-enter
  assert.equal(runAlarm2.houseEvents.forHouse(alarmEv2.houseId)?.terminalDisabled, true);
  runAlarm2.collect(alarmEv2.targetPcId!);
  assert.equal(alarmEv2.alarmTriggered, false);
  assert.equal(runAlarm2.alarms.has(alarmEv2.houseId), false);

  // Test ATTIC_ROUTE: discovery persistence & attic PC collection through RunSession
  const runAttic = new RunSession(atticSeed);
  const atticEv = runAttic.houseEvents.all().find(e => e.type === 'ATTIC_ROUTE')!;
  assert.equal(runAttic.discoverAtticRoute(atticEv.houseId), true);
  assert.equal(runAttic.discoverAtticRoute(atticEv.houseId), false); // second time returns false (already discovered)
  const atticPc = atticEv.attic!.pc;
  const atticRam = runAttic.collect(atticPc.id);
  assert.equal(atticRam, effectivePcRam(atticPc));
  assert.equal(runAttic.totalCollectedRamGB, atticRam);
  assert.equal(runAttic.collect(atticPc.id), 0); // cannot double-collect

  // Test RAM_JACKPOT: 1.5x or 2.0x capacity added once
  const runJackpot = new RunSession(jackpotSeed);
  const jackpotEv = runJackpot.houseEvents.all().find(e => e.type === 'RAM_JACKPOT')!;
  const jackpotPc = runJackpot.findPc(jackpotEv.targetPcId!)!.pc;
  assert.ok(jackpotEv.multiplier === 1.5 || jackpotEv.multiplier === 2.0);
  assert.equal(effectivePcRam(jackpotPc), jackpotPc.gb + (jackpotPc.bonusGb ?? 0));
  const collectedJackpot = runJackpot.collect(jackpotPc.id);
  assert.equal(collectedJackpot, effectivePcRam(jackpotPc));
  assert.equal(runJackpot.collect(jackpotPc.id), 0);

  // Test EMPTY_HOUSE: 0 residents, safe collection, slightly reduced RAM
  const runEmpty = new RunSession(emptySeed);
  const emptyEv = runEmpty.houseEvents.all().find(e => e.type === 'EMPTY_HOUSE')!;
  const emptyHouse = runEmpty.houses.find(h => h.id === emptyEv.houseId)!;
  assert.equal(emptyHouse.residents.length, 0);
  assert.equal(emptyHouse.security.length, 0);
  assert.ok(emptyHouse.pcs.every(pc => effectivePcRam(pc) <= pc.gb && effectivePcRam(pc) >= 4));
});

// ============================================================================
// Phase 19: Mid-Run Extraction & Risk Mode Tests
// ============================================================================

test('Extraction 1 & 2: extraction points never conflict with house doors and autonomous extraction secures 100% of available RAM', () => {
  const run = new RunSession(42, 'normal', true);
  const doorXs = run.houses.map(h => h.x);

  // Every extraction point is well outside the 85px door interaction radius of all 14 houses
  for (const pt of EXTRACTION.points) {
    assert.ok(doorXs.every(dx => Math.abs(dx - pt.x) >= 200), `Extraction point ${pt.id} must not overlap any house door`);
    const found = run.extraction.findPoint(pt.x, GAME.streetGround, GAME.streetGround, doorXs);
    assert.equal(found?.id, pt.id);
  }
  // Standing at a house door never returns an extraction point
  for (const dx of doorXs) {
    assert.equal(run.extraction.findPoint(dx, GAME.streetGround, GAME.streetGround, doorXs), undefined);
  }

  // Holding E at extraction point progresses to 100% and triggers extraction
  const pt = EXTRACTION.points[0];
  assert.equal(run.extraction.updateHold(pt, true, 450).triggered, false);
  assert.equal(run.extraction.updateHold(pt, true, 450).triggered, true);

  run.collect(run.houses[0].pcs[0].id); // +8 GB
  const result = run.extract();
  assert.equal(result.reason, 'extract');
  assert.equal(result.availableRamGB, 8);
  assert.equal(result.lostRamGB, 0);
  assert.equal(result.securedRamGB, 8);
  assert.equal(result.extractionStatus, EXTRACTION_STATUS_LABELS.extract.badge);
});

test('Extraction 3, 4 & 5: Normal mode keeps 100% RAM on all endings, while Risk Mode applies exact loss rates without negative values or double deduction', () => {
  // Normal mode (riskMode = false): 0 loss even on life=0, time=0, boss_loss
  for (const reason of ['goal', 'extract', 'life', 'time', 'boss_win', 'boss_loss'] as const) {
    const r = new RunSession(42, 'normal', false);
    r.awardRam('pc:test', 100, 'pc');
    r.spendRam(20); // available = 80, spent = 20
    const res = r.finish(reason);
    assert.equal(res.totalCollectedRamGB, 100);
    assert.equal(res.spentRamGB, 20);
    assert.equal(res.availableRamGB, 80);
    assert.equal(res.lostRamGB, 0);
    assert.equal(res.securedRamGB, 80);
  }

  // Risk mode (riskMode = true):
  // - extract / goal / boss_win: 0% lost -> 80GB secured
  for (const safeReason of ['extract', 'goal', 'boss_win'] as const) {
    const r = new RunSession(42, 'normal', true);
    r.awardRam('pc:test', 100, 'pc');
    r.spendRam(20);
    const res = r.finish(safeReason);
    assert.equal(res.lostRamGB, 0);
    assert.equal(res.securedRamGB, 80);
  }

  // - life: 20% of available (80 * 0.20 = 16 lost -> 64 secured; totalCollected stays 100, spent stays 20)
  {
    const r = new RunSession(42, 'normal', true);
    r.awardRam('pc:test', 100, 'pc');
    r.spendRam(20);
    const res = r.finish('life');
    assert.equal(res.totalCollectedRamGB, 100);
    assert.equal(res.spentRamGB, 20);
    assert.equal(res.availableRamGB, 80);
    assert.equal(res.lostRamGB, 16);
    assert.equal(res.securedRamGB, 64);
    assert.equal(res.securedRamGB, res.availableRamGB - res.lostRamGB);
    assert.equal(createDataCenterPlan(res.securedRamGB).totalRamGB, 64);
  }

  // - time: 10% of available (85 * 0.10 = 8 lost -> 77 secured)
  {
    const r = new RunSession(42, 'normal', true);
    r.awardRam('pc:test', 105, 'pc');
    r.spendRam(20); // available = 85
    const res = r.finish('time');
    assert.equal(res.availableRamGB, 85);
    assert.equal(res.lostRamGB, 8);
    assert.equal(res.securedRamGB, 77);
  }

  // - boss_loss: 20% of available (80 * 0.20 = 16 lost -> 64 secured)
  {
    const r = new RunSession(42, 'normal', true);
    r.awardRam('pc:test', 100, 'pc');
    r.spendRam(20);
    const res = r.finish('boss_loss');
    assert.equal(res.lostRamGB, 16);
    assert.equal(res.securedRamGB, 64);
  }

  // Non-negative guarantee for 0, negative, or non-finite inputs
  for (const [tot, sp] of [[0, 0], [10, 10], [-50, 20], [NaN, 10]] as const) {
    const s = settleRunRam(tot, sp, 'life', true);
    assert.ok(s.availableRamGB >= 0 && s.lostRamGB >= 0 && s.securedRamGB >= 0);
    assert.equal(s.securedRamGB, s.availableRamGB - s.lostRamGB);
  }
});

test('Extraction 6 & 7: game end settlement is strictly idempotent and supports boss victory/defeat alongside title configuration', () => {
  const r = new RunSession(42, 'normal', true);
  r.awardRam('pc:test', 100, 'pc');
  const first = r.finish('life');
  const second = r.finish('time');
  const third = r.extract();
  assert.deepEqual(second, first);
  assert.deepEqual(third, first);
  assert.equal(r.lostRamGB, 20);
  assert.equal(r.securedRamGB, 80);

  // Verify English title and Japanese subtitle constants
  assert.equal(GAME_TITLE.english, 'For the Greater Compute');
  assert.equal(GAME_TITLE.subtitle, 'すべてのRAMは、データセンターのために。');
  assert.equal(RISK_MODE.lossRates.life, 0.20);
  assert.equal(RISK_MODE.lossRates.time, 0.10);
  assert.equal(RISK_MODE.lossRates.boss_loss, 0.20);
});
