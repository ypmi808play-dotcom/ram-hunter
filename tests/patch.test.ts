import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RunSession, previewResult } from '../src/core/session.ts';
import { EnemyMemory, ENEMY_TYPES, allowedTerritory, decideEnemy, seesPlayer } from '../src/core/enemies.ts';
import type { EnemyKind, EnemyContext, EnemySpawn } from '../src/core/enemies.ts';
import { COMBAT, DROPS, AI } from '../src/core/balance.ts';
import { ABILITIES } from '../src/core/abilities.ts';
import { rollEnemyDrop } from '../src/core/drops.ts';
import { WantedSystem, WANTED, reinforcementRequests } from '../src/core/wanted.ts';
import { createNeighborhood, reachablePCs, HOUSE_REWARDS } from '../src/core/houses.ts';
import { createDataCenterPlan } from '../src/core/empire.ts';
import { projectileMember } from '../src/core/collisions.ts';

const spawn = (id: string, kind: EnemyKind = 'resident', sceneId = kind === 'resident' ? 'house:1' : 'street'): EnemySpawn => ({ id, kind, sceneId, x: 600, y: 590, min: 300, max: 900, activity: 'patrol', facing: 1 });
const context = (now = 0): EnemyContext => ({ now, sceneId: 'street', playerX: 800, playerY: 590, wantedLevel: 0, occluders: [], reacquireAt: 0 });
function knockOut(run: RunSession, definition: EnemySpawn) {
  const m = run.enemyFor(definition)!;
  while (!m.defeated) { run.damageEnemy(definition.id, COMBAT.chipDamage, 1); if (!m.defeated) run.tick(450); }
  return m;
}
test('A: chip damage, cooldown and enemy HP match the patch specification', () => {
  assert.equal(COMBAT.chipDamage, 10); assert.equal(ABILITIES.chip.cooldownMs, 450); assert.equal(ABILITIES.chip.cost, 0);
  assert.equal(ENEMY_TYPES.resident.hp, 20); assert.equal(ENEMY_TYPES.guard.hp, 60); assert.equal(ENEMY_TYPES.drone.hp, 50); assert.equal(ENEMY_TYPES.heavy.hp, 100);
  const e = new EnemyMemory(spawn('test')); assert.equal(e.hit(10, 0, 1).hit, true); assert.equal(e.hp, 10);
});
test('A: collision callbacks deactivate the projectile, never the victim, in either Phaser argument order', () => {
  for (const reverse of [false, true]) {
    const enemy = { active: true }, chip = { active: true }, members = new Set([chip]);
    const selected = projectileMember(reverse ? chip : enemy, reverse ? enemy : chip, object => members.has(object));
    assert.equal(selected, chip); selected!.active = false; assert.equal(enemy.active, true);
  }
  assert.equal(projectileMember('player', 'wall', object => object === 'chip'), undefined);
});
test('A: enemy hit invincibility is exactly 200ms, with persistent knockout at zero HP', () => {
  const e = new EnemyMemory(spawn('test')); e.hit(10, 0, -1);
  assert.equal(e.hit(10, 199, 1).hit, false); assert.equal(e.hp, 10);
  assert.equal(e.hit(10, 200, 1).killed, true); assert.equal(e.state, 'DEFEATED');
  assert.equal(e.hit(10, 1000, 1).hit, false);
  assert.equal(decideEnemy(e, { ...context(2000), sceneId: 'house:1' }).harmful, false);
  assert.equal(decideEnemy(e, { ...context(2000), sceneId: 'house:1' }).velocityX, 0);
});
test('A: special stun remains longer than chip hit recovery', () => {
  const e = new EnemyMemory(spawn('test', 'guard')); e.control.stun(0, 5000); e.hit(10, 50, 1);
  assert.equal(decideEnemy(e, context(100)).state, 'HURT');
  assert.equal(decideEnemy(e, context(300)).state, 'STUNNED'); assert.equal(decideEnemy(e, context(4999)).velocityX, 0);
});
test('B: every drone produces one RAM drop, in the configured normal and enhanced ranges', () => {
  for (const kind of ['drone', 'enhancedDrone'] as const) for (const r of [0, .5, .999999]) {
    const d = rollEnemyDrop(kind, () => r)!;
    assert.equal(d.kind, 'ram'); assert.ok(d.gb >= (kind === 'drone' ? 8 : 16)); assert.ok(d.gb <= (kind === 'drone' ? 16 : 32));
  }
});
test('B: civilian energy drinks have the exact 12 percent threshold and police drop nothing', () => {
  assert.equal(rollEnemyDrop('resident', () => .119999)?.kind, 'health');
  assert.equal(rollEnemyDrop('resident', () => .12), undefined);
  let count = 0; for (let i = 0; i < 10000; i++) if (rollEnemyDrop('resident', () => i / 10000)) count++;
  assert.equal(count, 1200); assert.equal(rollEnemyDrop('guard', () => 0), undefined); assert.equal(rollEnemyDrop('heavy', () => 0), undefined);
});
test('B: knockout, drop roll, pickup and RAM accounting are idempotent across re-entry', () => {
  const run = new RunSession(42); const definition = spawn('drone:one', 'drone'); const e = knockOut(run, definition);
  const drop = [...run.drops.values()][0]; assert.ok(drop);
  const first = run.claimDrop(drop.id); assert.equal(first.claimed, true); assert.equal(run.availableRamGB, first.ram);
  assert.equal(run.claimDrop(drop.id).claimed, false); assert.equal(run.enemyFor(definition), e); assert.equal(e.defeated, true);
  assert.equal(run.damageEnemy(e.spawn.id, 10, 1).hit, false); assert.equal(run.drops.size, 1); assert.equal(run.stats.dronesDefeated, 1);
});
test('B: drone RAM has a hard 64GB run cap, while PC/boss rewards share the same ledger', () => {
  const run = new RunSession(42);
  for (let i = 0; i < 10; i++) run.awardRam(`drone:${i}`, 32, 'drone');
  assert.equal(run.stats.ramFromDrones, DROPS.droneRunCapGB); assert.equal(run.totalCollectedRamGB, 64);
  run.collect(run.houses[0].pcs[0].id); run.awardRam('boss:test', 128, 'boss'); run.useAbility('agi');
  assert.equal(run.totalCollectedRamGB, 200); assert.equal(run.availableRamGB, 168); assert.equal(run.spentRamGB, 32);
  assert.equal(run.awardRam('boss:test', 128, 'boss'), 0);
});
test('B: healing never exceeds max life and expires or belongs to another scene safely', () => {
  const run = new RunSession(42);
  run.drops.set('health', { id: 'health', enemyId: 'c', sceneId: 'street', kind: 'health', gb: 0, x: 0, y: 0, expiresAt: 16000, status: 'pending' });
  assert.equal(run.claimDrop('health').healed, 0); assert.equal(run.lives, 3); assert.equal(run.stats.healthItemsCollected, 1);
  assert.equal(run.claimDrop('health').claimed, false);
  const copy = { ...run.drops.get('health')!, id: 'second', status: 'pending' as const }; run.drops.set('second', copy); run.lives = 2;
  assert.equal(run.claimDrop('second').healed, 1); assert.equal(run.lives, 3);
  run.drops.set('expired', { ...copy, id: 'expired', status: 'pending' }); run.tick(16001); assert.equal(run.claimDrop('expired').claimed, false);
  run.drops.set('inside', { ...copy, id: 'inside', sceneId: 'house:1', expiresAt: 99999 }); assert.equal(run.claimDrop('inside').claimed, false);
});
test('C: citizens stay inside, police stay outside, and facility drones require explicit permission', () => {
  assert.equal(allowedTerritory('resident', 'street'), false); assert.equal(allowedTerritory('guard', 'house:0'), false);
  assert.equal(allowedTerritory('drone', 'house:0'), false); assert.equal(allowedTerritory('enhancedDrone', 'house:13', true), true);
  const run = new RunSession(42); assert.equal(run.enemyFor(spawn('invalid', 'guard', 'house:0')), undefined);
});
test('C: entering a home changes police pursuit to door search and later return, without teleporting', () => {
  const run = new RunSession(42); const e = run.enemyFor(spawn('police', 'guard'))!;
  decideEnemy(e, context(0)); decideEnemy(e, context(500)); assert.equal(e.state, 'CHASE'); const x = e.x;
  run.leaveArea('street', 740); assert.equal(e.state, 'SEARCH'); assert.equal(e.lastSeenX, 740); assert.equal(e.x, x);
  const decision = decideEnemy(e, { ...context(6000), playerX: 5000 }); assert.equal(decision.state, 'PATROL');
  run.exitHouse(); assert.equal(seesPlayer(e, { ...context(600), reacquireAt: run.outdoorAcquireAt }), false);
});
test('C: furniture blocks vision, facing matters, and sleeping residents can be bypassed', () => {
  const e = new EnemyMemory(spawn('citizen')); const c = { ...context(), sceneId: 'house:1', playerX: 750 };
  assert.equal(seesPlayer(e, c), true); assert.equal(seesPlayer(e, { ...c, playerX: 450 }), false);
  assert.equal(seesPlayer(e, { ...c, occluders: [{ x: 650, y: 500, width: 30, height: 90 }] }), false);
  const sleeping = new EnemyMemory({ ...spawn('sleep'), activity: 'sleep' }); assert.equal(seesPlayer(sleeping, c), false);
});
test('C: drone ranged attack has a visible windup, cooldown, and stops when defeated', () => {
  const e = new EnemyMemory(spawn('d', 'drone')); e.y = 440; const c = { ...context(), playerX: 760 };
  decideEnemy(e, c); assert.equal(decideEnemy(e, { ...c, now: 500 }).fire, false);
  assert.equal(decideEnemy(e, { ...c, now: 900 }).fire, true);
  assert.equal(decideEnemy(e, { ...c, now: 1000 }).fire, false);
  e.hit(100, 1100, 1); assert.equal(decideEnemy(e, { ...c, now: 5000 }).fire, false);
});
test('D: acquisition events are modest, and continuous sight never adds heat repeatedly', () => {
  const w = new WantedSystem(); w.collection(8); assert.equal(w.heat, 2); w.collection(64); assert.equal(w.heat, 6);
  w.tick(16, [{ id: 'c', kind: 'resident' }]); assert.equal(w.heat, 11);
  for (let i = 0; i < 10000; i++) w.tick(16, [{ id: 'c', kind: 'resident' }]);
  assert.equal(w.heat, 11);
});
test('D: heat decays after 5s at 3/s outside or 4/s indoors, and never while pursued', () => {
  const w = new WantedSystem(); w.event('policeAssault', 'g'); w.event('policeAssault', 'g');
  w.tick(5000, false); assert.equal(w.heat, 16); w.tick(1000, false); assert.equal(w.heat, 13);
  w.tick(1000, false, true); assert.equal(w.heat, 9); w.tick(50000, false, true, true); assert.equal(w.heat, 9);
  assert.ok(w.highestLevel >= 1);
});
test('D: reinforcements have an interval and can never enter ordinary houses or exceed fixed pools', () => {
  assert.equal(reinforcementRequests('house:1', 5, [], true, 99999).length, 0);
  assert.equal(reinforcementRequests('street', 5, [], false, 1000).length, 0);
  const first = reinforcementRequests('street', 5, [], false, 20000); assert.equal(first.length, 1);
  assert.equal(reinforcementRequests('street', 5, [first[0].id], false, 21000, 32000).length, 0);
  const ids: string[] = [];
  for (let i = 0; i < 100; i++) ids.push(...reinforcementRequests('street', 5, ids, false, 20000 + i * AI.reinforcementIntervalMs).map(r => r.id));
  assert.equal(ids.length, 4); assert.equal(new Set(ids).size, 4);
});
test('E: 14 homes contain eight types and at least six actual layout families', () => {
  for (const seed of [0, 1, 42, 2026, 99999]) {
    const homes = createNeighborhood(seed); assert.equal(homes.length, 14); assert.equal(new Set(homes.map(h => h.type)).size, 8);
    assert.ok(new Set(homes.map(h => h.layout)).size >= 6);
    assert.deepEqual(['EASY', 'NORMAL', 'HARD', 'EXTREME'].map(d => homes.filter(h => h.difficulty === d).length), [5, 5, 3, 1]);
    assert.ok(new Set(homes.map(h => h.width)).size >= 6); assert.ok(homes.every(reachablePCs));
  }
});
test('E: PC counts and RAM tiers match difficulty, while risk has a clear positive expected reward', () => {
  const totals: Record<string, number[]> = { EASY: [], NORMAL: [], HARD: [], EXTREME: [] };
  for (let seed = 0; seed < 100; seed++) for (const h of createNeighborhood(seed)) {
    const cfg = HOUSE_REWARDS[h.difficulty]; assert.ok(h.pcs.length >= cfg.minPCs && h.pcs.length <= cfg.maxPCs);
    assert.ok(h.pcs.every(pc => (cfg.capacities as readonly number[]).includes(pc.gb)));
    totals[h.difficulty].push(h.pcs.reduce((sum, pc) => sum + pc.gb, 0));
  }
  const average = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  assert.ok(average(totals.EASY) < average(totals.NORMAL)); assert.ok(average(totals.NORMAL) < average(totals.HARD)); assert.ok(average(totals.HARD) < average(totals.EXTREME));
});
test('E: inhabitants and facilities obey territory rules, all six activities exist, and stealth homes exist', () => {
  const h = createNeighborhood(42); assert.equal(h[0].residents.length, 0); assert.equal(h[3].residents.length, 0);
  assert.equal(new Set(h.flatMap(x => x.residents.map(r => r.activity))).size, 6);
  for (const house of h) {
    assert.ok(house.residents.every(r => ENEMY_TYPES[r.kind].role === 'civilian'));
    assert.ok(house.security.every(r => r.kind !== 'guard' && allowedTerritory(r.kind, `house:${house.id}`, house.allowIndoorSecurity)));
    assert.ok(house.furniture.every(f => !f.solid || f.height <= 78));
  }
});
test('E: neighborhood generation is repeatable, varied, and all PCs are uniquely collectible', () => {
  const a = createNeighborhood(42); assert.deepEqual(a, createNeighborhood(42)); assert.notDeepEqual(a, createNeighborhood(43));
  const ids = a.flatMap(h => h.pcs.map(p => p.id)); assert.equal(ids.length, new Set(ids).size);
  const run = new RunSession(42); const pc = run.houses[0].pcs[0]; assert.equal(run.collect(pc.id), pc.gb); assert.equal(run.collect(pc.id), 0);
  assert.ok(run.potentialRamGB >= 1024);
});
test('E: residents spawn outside solid furniture or exactly on its top surface', () => {
  for (let seed = 0; seed < 100; seed++) for (const h of createNeighborhood(seed)) for (const r of h.residents) {
    assert.ok(h.furniture.every(f => !f.solid || Math.abs(f.x - r.x) >= f.width / 2 + 14 || r.y <= f.floorY - f.height || r.y - 58 >= f.floorY), `${seed}/${h.id}/${r.id}`);
  }
});
test('F: NORMAL is 4:30 and CLASSIC is 3:00, with an equal normalized time-bonus budget', () => {
  const n = new RunSession(42, 'normal'), c = new RunSession(42, 'classic');
  assert.equal(n.remainingMs, 270000); assert.equal(c.remainingMs, 180000);
  n.tick(135000); c.tick(90000); assert.equal(n.finish('goal').timeBonus, 1800); assert.equal(c.finish('goal').timeBonus, 1800);
});
test('F: defeats are reported in results and unused RAM still determines empire growth', () => {
  const run = new RunSession(42); knockOut(run, spawn('d', 'drone')); run.claimDrop([...run.drops.keys()][0]);
  for (const h of run.houses.slice(0, 3)) for (const pc of h.pcs) run.collect(pc.id);
  run.awardRam('future-boss', 128, 'boss'); run.useAbility('agi'); const result = run.finish('life');
  assert.equal(result.enemiesDefeated, 1); assert.equal(result.dronesDefeated, 1); assert.ok(result.ramFromDrones >= 8);
  assert.equal(result.totalCollectedRamGB, result.availableRamGB + result.spentRamGB);
  assert.equal(createDataCenterPlan(result.availableRamGB).totalRamGB, result.availableRamGB); assert.equal(result.timeBonus, 0);
  assert.equal(previewResult(4096).availableRamGB, 4096);
});
