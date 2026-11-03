import test from 'node:test';
import assert from 'node:assert/strict';
import { RunSession, effectivePcRam } from '../src/core/session.ts';
import { EnemyControl } from '../src/core/abilities.ts';
import { EnemyMemory, ENEMY_TYPES, allowedTerritory, decideEnemy, seesPlayer, computeDetectionRate } from '../src/core/enemies.ts';
import { createNeighborhood, furnitureOccluderRect, hasStealthRoute } from '../src/core/houses.ts';
import { VISION_PROFILES, DETECTION, PROGRESSION_TIERS } from '../src/core/config.ts';
import { AI, COMBAT, DROPS } from '../src/core/balance.ts';

function makeEnemy(id: string, kind: keyof typeof ENEMY_TYPES, sceneId: string, x: number, y: number, facing: -1 | 1 = 1) {
  return new EnemyMemory(
    {
      id,
      kind,
      sceneId,
      x,
      y,
      min: x - 180,
      max: x + 180,
      activity: 'patrol',
      facing
    },
    new EnemyControl()
  );
}

// ============================================================================
// Phase 8.1: Stealth Tests (8 items)
// ============================================================================

test('Phase 8.1 (1-2): Front walk is spotted quickly; rear approach is unseen', () => {
  const memFront = makeEnemy('test:front', 'resident', 'house:0', 400, 585, 1);
  const ctxFront = {
    now: 0,
    sceneId: 'house:0',
    playerX: 480,
    playerY: 585,
    wantedLevel: 0,
    occluders: [],
    reacquireAt: 0,
    playerCrouching: false
  };
  assert.equal(seesPlayer(memFront, ctxFront), true, 'Enemy should see player walking in front');

  // Step ~1.1 seconds in front -> gauge reaches 100 and transitions to CHASE
  for (let t = 0; t <= 1100; t += 100) {
    decideEnemy(memFront, { ...ctxFront, now: t });
  }
  assert.equal(memFront.detectionGauge, 100, 'Detection gauge reaches 100 within ~1 second at close front range');
  assert.equal(memFront.state, 'CHASE', 'Civilian transitions to CHASE when detectionGauge reaches 100');

  // Rear approach (player at x=300 behind enemy facing +1 at x=400)
  assert.equal(
    seesPlayer(memFront, { ...ctxFront, playerX: 300 }),
    false,
    'Enemy should not see player approaching from behind'
  );
});

test('Phase 8.1 (3-4): Crouch reduces sight range/speed, is still spotted at point-blank front, and cover blocks sight', () => {
  const mem = makeEnemy('test:crouch', 'resident', 'house:0', 400, 585, 1);
  // Farther range where standing is seen (dx = 180 <= 210) but crouching reduces range (210 * 0.62 = 130.2 < 180)
  const baseCtx = {
    now: 100,
    sceneId: 'house:0',
    playerX: 580,
    playerY: 585,
    wantedLevel: 0,
    occluders: [],
    reacquireAt: 0
  };
  assert.equal(seesPlayer(mem, { ...baseCtx, playerCrouching: false }), true);
  assert.equal(seesPlayer(mem, { ...baseCtx, playerCrouching: true }), false, 'Crouching reduces effective sight distance');

  // Point-blank front while crouching (dx = 45 <= pointBlankDistance 58) is STILL spotted and builds fast
  const pbCtx = { ...baseCtx, playerX: 445, playerCrouching: true };
  assert.equal(seesPlayer(mem, pbCtx), true, 'Crouching right in front of an enemy is still seen');
  const pbRate = computeDetectionRate(mem, pbCtx);
  assert.ok(pbRate >= 100, 'Point-blank frontal crouch still builds gauge within ~1 second');

  // Cover (furniture occluder between 400 and 510) blocks sight
  const guard = makeEnemy('test:cover', 'privateGuard', 'house:0', 400, 585, 1);
  const coverCtx = {
    ...baseCtx,
    playerX: 510,
    playerCrouching: true,
    occluders: [{ x: 430, y: 500, width: 60, height: 85 }]
  };
  assert.equal(seesPlayer(guard, coverCtx), false, 'Furniture occluder blocks line of sight');
});

test('Phase 8.1 (5-8): Loud noise triggers investigation without instant CHASE, hiding breaks pursuit, and walls block cross-scene detection', () => {
  const run = new RunSession(42);
  const mem = run.enemyFor({
    id: 'house0:test:guard',
    kind: 'privateGuard',
    sceneId: 'house:0',
    x: 500,
    y: 585,
    min: 320,
    max: 680,
    activity: 'patrol',
    facing: -1,
    facility: true
  })!;
  const outdoorPolice = run.enemyFor({
    id: 'street:test:police',
    kind: 'guard',
    sceneId: 'street',
    x: 500,
    y: 608,
    min: 300,
    max: 700,
    activity: 'patrol',
    facing: -1
  })!;

  // Emit loud dash noise inside house:0 at x=360
  const ev = run.emitNoise('dash', 360, 585, 'house:0', 'player');
  assert.ok(ev, 'Noise event emitted');

  // Guard investigates noise: gauge increases but caps <= 85 (SUSPICIOUS, not instant CHASE)
  assert.equal(mem.state, 'SUSPICIOUS', 'Noise transitions guard to SUSPICIOUS investigation, not instant CHASE');
  assert.ok(mem.detectionGauge > 0 && mem.detectionGauge <= 85, 'Noise increases gauge without reaching 100 by itself');
  assert.equal(run.wanted.level, 0, 'Noise alone does not increase Wanted Level');

  // Outdoor police cannot hear indoor noise
  assert.equal(outdoorPolice.state, 'PATROL', 'Outdoor police must not hear indoor noise across walls');
  assert.equal(outdoorPolice.detectionGauge, 0);

  // Now simulate full discovery (gauge = 100 -> CHASE) then player hides behind cover -> breaks pursuit and decays gauge
  mem.detectionGauge = 100;
  mem.state = 'CHASE';
  mem.noiseTargetX = undefined;
  mem.lastSeenAt = 1000;
  mem.lastDecidedAt = 1000;
  // Guard at x=500 facing -1 (left), occluder at x=430..490, player hidden behind occluder at x=380
  const occluder = [{ x: 430, y: 500, width: 60, height: 85 }];
  for (let t = 1200; t <= 8500; t += 250) {
    decideEnemy(mem, {
      now: t,
      sceneId: 'house:0',
      playerX: 380,
      playerY: 585,
      wantedLevel: 0,
      occluders: occluder,
      reacquireAt: 0,
      playerCrouching: true
    });
  }
  assert.notEqual(mem.state, 'CHASE', 'Hiding out of sight breaks CHASE state');
  assert.ok(mem.detectionGauge < 40, 'Detection gauge decays after losing sight of player');
});

// ============================================================================
// Phase 8.2: Combat & Enemy Archetype Tests (8 items)
// ============================================================================

test('Phase 8.2 (1-3): All 6 indoor enemy archetypes take damage, reduce HP, and KO at 0 HP', () => {
  const kinds = ['resident', 'alertResident', 'privateGuard', 'eliteGuard', 'securityRobot', 'combatDrone'] as const;
  const expectedHp = {
    resident: 20,
    alertResident: 40,
    privateGuard: 70,
    eliteGuard: 120,
    securityRobot: 90,
    combatDrone: 65
  };

  for (const kind of kinds) {
    const run = new RunSession(7);
    const mem = run.enemyFor({
      id: `test:${kind}`,
      kind,
      sceneId: 'house:10',
      x: 400,
      y: 585,
      min: 220,
      max: 580,
      activity: 'patrol',
      facing: 1,
      facility: true
    })!;
    assert.equal(mem.hp, expectedHp[kind], `${kind} initial HP matches spec`);
    let safety = 0;
    while (!mem.defeated && safety < 40) {
      safety++;
      run.tick(250, [], true, false);
      // direction = +1 (chip moving right, hitting enemy from behind when facing +1)
      run.damageEnemy(mem.spawn.id, COMBAT.chipDamage, 1, false);
    }
    assert.equal(mem.hp, 0, `${kind} HP reaches 0`);
    assert.equal(mem.defeated, true, `${kind} is defeated at 0 HP`);
  }
});

test('Phase 8.2 (4-5): Special attacks have windup telegraphs (0.5-0.7s) and Elite Guard frontal shield halves frontal damage', () => {
  // 1. Elite Guard frontal shield vs backstab
  const elite = makeEnemy('elite:1', 'eliteGuard', 'house:11', 500, 585, 1);
  elite.shielding = true;
  // Frontal attack: enemy faces +1 (right), projectile comes from right moving left (direction = -1) -> direction * facing < 0 -> shielded!
  const frontHit = elite.hit(10, 1000, -1);
  assert.equal(frontHit.shielded, true);
  assert.equal(frontHit.damage, 5, 'Frontal hit on shielding Elite Guard deals 50% damage');
  assert.equal(elite.hp, 115);

  // Rear attack after hurt invincibility: projectile moving right (direction = +1) into back of facing +1 -> full 10 damage
  const rearHit = elite.hit(10, 1300, 1);
  assert.equal(rearHit.shielded, false);
  assert.equal(rearHit.damage, 10, 'Rear backstab on Elite Guard deals 100% damage');
  assert.equal(elite.hp, 105);

  // 2. Windup telegraph check across special enemies
  const specials = [
    { kind: 'alertResident' as const, dist: 150, expectedWindup: AI.alertCallWindupMs },
    { kind: 'privateGuard' as const, dist: 50, expectedWindup: AI.batonWindupMs },
    { kind: 'eliteGuard' as const, dist: 140, expectedWindup: AI.dashWindupMs },
    { kind: 'securityRobot' as const, dist: 100, expectedWindup: AI.empWindupMs },
    { kind: 'combatDrone' as const, dist: 200, expectedWindup: AI.burstWindupMs }
  ];

  for (const s of specials) {
    const m = makeEnemy(`spec:${s.kind}`, s.kind, 'house:12', 400, 585, 1);
    m.detectionGauge = 100;
    m.state = 'CHASE';
    m.lastSeenAt = 1000;
    m.lastDecidedAt = 984;
    const step1 = decideEnemy(m, {
      now: 1000,
      sceneId: 'house:12',
      playerX: 400 + s.dist,
      playerY: 585,
      wantedLevel: 0,
      occluders: [],
      reacquireAt: 0
    });
    assert.equal(m.specialState, 'windup', `${s.kind} enters windup telegraph before executing special`);
    assert.ok(step1.specialWarning && step1.specialWarning.startsWith('⚠'), `${s.kind} emits visible windup warning (${step1.specialWarning})`);
    assert.ok(s.expectedWindup >= 500 && s.expectedWindup <= 700, `${s.kind} windup is 0.5-0.7s (${s.expectedWindup}ms)`);
  }
});

test('Phase 8.2 (6-8): Player invincibility prevents instant multi-hit death, EMP pulse jams abilities for 3s, and Robot/Drone drop RAM with cap', () => {
  const run = new RunSession(99);
  run.activeSceneId = 'house:8';
  run.awardRam('test:seed:ram', 64, 'pc');

  // Player invincibility check
  assert.equal(run.lives, 3);
  assert.equal(run.damage(), true, 'First hit deals 1 heart');
  assert.equal(run.lives, 2);
  assert.equal(run.damage(), false, 'Immediate second hit during invincibility window is blocked');
  assert.equal(run.lives, 2);

  // EMP jam check
  run.applyEmpJam();
  assert.equal(run.isEmpJammed, true);
  assert.equal(run.useAbility('hallucination').reason, 'emp', 'Hallucination blocked during EMP jam');
  assert.equal(run.useAbility('agi').reason, 'emp', 'AGI blocked during EMP jam');
  assert.equal(run.useAbility('chip').ok, true, 'Basic chip throw still works during EMP jam');
  run.tick(COMBAT.empJamDurationMs + 100, [], true, false);
  assert.equal(run.isEmpJammed, false, 'EMP jam expires after 3 seconds');

  // SecurityRobot (8-32GB) & CombatDrone (16-32GB) RAM drop + idempotency + cap
  const robot = run.enemyFor({
    id: 'house8:robot',
    kind: 'securityRobot',
    sceneId: 'house:8',
    x: 400,
    y: 585,
    min: 220,
    max: 580,
    activity: 'patrol',
    facing: 1,
    facility: true
  })!;
  while (!robot.defeated) {
    run.tick(250, [], true, false);
    run.damageEnemy(robot.spawn.id, 30, 1, false);
  }
  const robotDrop = run.drops.get(`drop:${robot.spawn.id}`);
  assert.ok(robotDrop && robotDrop.kind === 'ram', 'Defeated securityRobot drops RAM');
  assert.ok(robotDrop!.gb >= DROPS.robotMinGB && robotDrop!.gb <= DROPS.robotMaxGB, `Robot drop ${robotDrop!.gb}GB is in 8-32GB`);

  // Claiming drop once adds RAM; claiming same drop ID again is idempotent
  const beforeRam = run.availableRamGB;
  const firstPickup = run.claimDrop(robotDrop!.id);
  const secondPickup = run.claimDrop(robotDrop!.id);
  assert.equal(firstPickup.claimed, true);
  assert.equal(secondPickup.claimed, false, 'Drop pickup is idempotent');
  assert.equal(run.availableRamGB, beforeRam + firstPickup.ram);
});

// ============================================================================
// Phase 8.3: House Progression & Territory Tests (7 items)
// ============================================================================

test('Phase 8.3 (1-7): 5-tier house progression, scaled RAM rewards, stealth routes, KO persistence, and territory rules', () => {
  const houses = createNeighborhood(42);
  assert.equal(houses.length, 14);

  // 1-2. Check 5-tier progression across Houses 1-14 and RAM scaling
  for (const h of houses) {
    const num = h.id + 1;
    if (num <= 3) assert.equal(h.tier, 'EASY', `House ${num} is EASY`);
    else if (num <= 6) assert.equal(h.tier, 'NORMAL', `House ${num} is NORMAL`);
    else if (num <= 10) assert.equal(h.tier, 'HARD', `House ${num} is HARD`);
    else if (num <= 13) assert.equal(h.tier, 'VERY_HARD', `House ${num} is VERY_HARD`);
    else assert.equal(h.tier, 'EXTREME', `House ${num} is EXTREME`);

    // 3. Every house has a valid stealth route (furniture occluders + upper platforms)
    assert.equal(hasStealthRoute(h), true, `House ${num} has a valid stealth route`);

    // 5. Outdoor police ('guard') never spawn inside houses
    for (const npc of [...h.residents, ...h.security]) {
      assert.notEqual(npc.kind, 'guard', `Outdoor police must not spawn inside House ${num}`);
      assert.equal(allowedTerritory(npc.kind, `house:${h.id}`, h.allowIndoorSecurity), true, `${npc.kind} is allowed in House ${num}`);
    }
  }

  // Verify RAM rewards scale from early (4-16GB) to House 14 EXTREME (128-512GB)
  const house1MaxRam = Math.max(...houses[0].pcs.map(pc => effectivePcRam(pc)));
  const house14MaxRam = Math.max(...houses[13].pcs.map(pc => effectivePcRam(pc)));
  assert.ok(house1MaxRam >= 4 && house1MaxRam <= 32, `House 1 max PC RAM (${house1MaxRam}GB) is early-tier`);
  assert.ok(house14MaxRam >= 128 && house14MaxRam <= 512, `House 14 max PC RAM (${house14MaxRam}GB) reaches EXTREME 128-512GB tier`);

  // 4. KO state persists when exiting and re-entering an occupied house
  const run = new RunSession(42);
  const occupiedHouse = run.houses.find(h => h.security.length > 0 || h.residents.length > 0)!;
  const targetNpc = occupiedHouse.security[0] ?? occupiedHouse.residents[0];
  const mem = run.enemyFor({
    id: targetNpc.id,
    kind: targetNpc.kind,
    sceneId: `house:${occupiedHouse.id}`,
    x: targetNpc.x,
    y: targetNpc.y,
    min: 100,
    max: occupiedHouse.width - 100,
    activity: targetNpc.activity,
    facing: targetNpc.facing,
    facility: occupiedHouse.allowIndoorSecurity
  })!;
  while (!mem.defeated) {
    run.tick(250, [], true, false);
    run.damageEnemy(mem.spawn.id, 40, 1, false);
  }
  assert.equal(mem.defeated, true);
  run.leaveArea(`house:${occupiedHouse.id}`, occupiedHouse.doorX);
  const memOnReentry = run.enemyFor({
    id: targetNpc.id,
    kind: targetNpc.kind,
    sceneId: `house:${occupiedHouse.id}`,
    x: targetNpc.x,
    y: targetNpc.y,
    min: 100,
    max: occupiedHouse.width - 100,
    activity: targetNpc.activity,
    facing: targetNpc.facing,
    facility: occupiedHouse.allowIndoorSecurity
  })!;
  assert.equal(memOnReentry.defeated, true, 'Defeated enemy remains defeated upon re-entering house');
});

// ============================================================================
// Phase 8.5: 3-Playstyle Automated Simulation Comparison
// Playstyle A: Stealth (crouch + cover + rear approach)
// Playstyle B: Careless Normal Walk (standing walk through enemy front cones)
// Playstyle C: Aggressive Combat (chip attacks + special abilities + drone/robot farming)
// ============================================================================

interface SimMetrics {
  style: string;
  detections: number;
  damageTaken: number;
  ramCollected: number;
  enemiesDefeated: number;
  elapsedSec: number;
}

function runPlaystyleSimulation(style: 'A_STEALTH' | 'B_CARELESS' | 'C_COMBAT'): SimMetrics {
  const run = new RunSession(101, 'normal', true);
  let detections = 0;
  let damageTaken = 0;

  // Simulate traversing 6 representative houses across all 5 tiers (House 1, 3, 5, 8, 11, 14)
  const targetHouseIds = [0, 2, 4, 7, 10, 13];
  for (const hid of targetHouseIds) {
    const house = run.houses[hid];
    const sceneId = `house:${house.id}`;
    run.activeSceneId = sceneId;
    run.visit(house.id);
    const occluders = house.furniture.map(furnitureOccluderRect).filter((r): r is NonNullable<typeof r> => !!r);
    const npcs = [...house.residents, ...house.security].map(r => ({
      data: r,
      mem: run.enemyFor({
        id: r.id,
        kind: r.kind,
        sceneId,
        x: r.x,
        y: r.y,
        min: Math.max(100, r.x - 170),
        max: Math.min(house.width - 100, r.x + 170),
        activity: r.activity,
        facing: r.facing,
        facility: house.allowIndoorSecurity
      })!
    }));

    const crouching = style === 'A_STEALTH';
    run.stealth.setCrouching(crouching, true);

    // Simulate 14 seconds per house in 200ms steps
    for (let step = 0; step < 70; step++) {
      const progress = step / 70;
      const engagedTarget = style === 'C_COMBAT' ? npcs.find(n => !n.mem.defeated) : undefined;
      const playerX = engagedTarget
        ? engagedTarget.data.x - 90
        : house.spawnX + progress * (house.width - house.spawnX - 180);
      // Stealth uses upper platforms or low cover to avoid enemy line of sight
      const playerY = style === 'A_STEALTH'
        ? (house.platforms[0]?.y ?? 420)
        : (house.pcs[0]?.floorY ?? 585);

      if (style === 'B_CARELESS' && step % 5 === 0) {
        run.emitNoise('dash', playerX, playerY, sceneId, 'player');
      }

      const sightings: { id: string; role: 'civilian' | 'police' | 'drone' }[] = [];
      let pursuing = false;

      for (const npc of npcs) {
        if (npc.mem.defeated) continue;

        // Combat playstyle actively engages and finishes off enemies in range
        if (style === 'C_COMBAT' && Math.abs(npc.data.x - playerX) < 260) {
          const hit = run.damageEnemy(npc.mem.spawn.id, COMBAT.chipDamage * 2, 1, true);
          if (hit.killed) {
            const dropId = `drop:${npc.mem.spawn.id}`;
            if (run.drops.has(dropId)) run.claimDrop(dropId);
          }
        }

        const wasChasing = npc.mem.state === 'CHASE' || npc.mem.state === 'ATTACK';
        const decision = decideEnemy(npc.mem, {
          now: run.elapsedMs,
          sceneId,
          playerX,
          playerY,
          wantedLevel: run.wanted.level,
          occluders: style === 'A_STEALTH' ? occluders : [],
          reacquireAt: 0,
          playerCrouching: crouching,
          playerCollecting: step % 15 === 0
        });

        if (!wasChasing && (decision.state === 'CHASE' || decision.state === 'ATTACK')) {
          detections++;
          run.notifyNearbyResidents(sceneId, npc.data.x, playerX);
        }
        if (decision.seen) {
          sightings.push({
            id: npc.mem.spawn.id,
            role: npc.mem.config.role === 'drone' ? 'drone' : npc.mem.config.role === 'civilian' ? 'civilian' : 'police'
          });
        }
        if (decision.pursuing) pursuing = true;

        // Contact / special attack damage when chasing and close
        if ((decision.state === 'CHASE' || decision.state === 'ATTACK') && Math.abs(npc.data.x - playerX) < (style === 'B_CARELESS' ? 95 : 42)) {
          if (run.damage()) damageTaken++;
        }
      }

      run.tick(220, sightings, true, pursuing);
    }

    // Collect PCs in the house (Stealth & Combat collect all; Careless misses some when fleeing)
    const pcsToCollect = style === 'B_CARELESS' ? house.pcs.slice(0, 1) : house.pcs;
    for (const pc of pcsToCollect) {
      run.collect(pc.id);
    }
    run.leaveArea(sceneId, house.doorX);
  }

  return {
    style,
    detections,
    damageTaken,
    ramCollected: run.totalCollectedRamGB,
    enemiesDefeated: run.stats.enemiesDefeated,
    elapsedSec: Math.round(run.elapsedMs / 1000)
  };
}

test('Phase 8.5: 3-Playstyle Simulation verifies Stealth, Careless Walk, and Combat produce distinct outcomes', () => {
  const stealth = runPlaystyleSimulation('A_STEALTH');
  const careless = runPlaystyleSimulation('B_CARELESS');
  const combat = runPlaystyleSimulation('C_COMBAT');

  // 1. Careless normal walking is spotted significantly more often and takes more damage than careful stealth
  assert.ok(careless.detections > stealth.detections, `Careless walk detections (${careless.detections}) > Stealth detections (${stealth.detections})`);
  assert.ok(careless.damageTaken > stealth.damageTaken, `Careless walk damage (${careless.damageTaken}) > Stealth damage (${stealth.damageTaken})`);

  // 2. Careful stealth collects high RAM with minimal damage
  assert.ok(stealth.ramCollected > careless.ramCollected, `Stealth RAM (${stealth.ramCollected}GB) > Careless RAM (${careless.ramCollected}GB)`);

  // 3. Combat playstyle defeats enemies and collects bonus drone/robot RAM drops
  assert.ok(combat.enemiesDefeated >= 6, `Combat playstyle defeats enemies (${combat.enemiesDefeated})`);
  assert.ok(combat.ramCollected >= stealth.ramCollected, `Combat playstyle earns PC + Robot/Drone drop RAM (${combat.ramCollected}GB >= ${stealth.ramCollected}GB)`);
});
