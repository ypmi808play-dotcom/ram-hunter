import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ABILITIES, EnemyControl, withinAbilityRadius } from '../src/core/abilities.ts';
import type { AbilityId, Lure } from '../src/core/abilities.ts';
import { RunSession } from '../src/core/session.ts';
import { createDataCenterPlan } from '../src/core/empire.ts';
import { EnemyMemory, decideEnemy } from '../src/core/enemies.ts';
import { GAME } from '../src/core/config.ts';
import { SAM_ART } from '../src/art/sam.ts';

function funded() {
  const run = new RunSession(42);
  run.collect(run.houses.flatMap(h => h.pcs).find(pc => pc.gb === 128)!.id);
  return run;
}
test('collection, spending and result retain an exact RAM ledger', () => {
  const run = funded();
  assert.equal(run.totalCollectedRamGB, 128); assert.equal(run.availableRamGB, 128); assert.equal(run.spentRamGB, 0);
  assert.ok(run.useAbility('hallucination').ok); assert.ok(run.useAbility('agi').ok);
  const result = run.finish('goal');
  assert.equal(result.totalCollectedRamGB, 128); assert.equal(result.availableRamGB, 88); assert.equal(result.spentRamGB, 40);
  assert.equal(result.totalCollectedRamGB, result.availableRamGB + result.spentRamGB);
  assert.equal(createDataCenterPlan(result.availableRamGB).level, 2);
  assert.equal(createDataCenterPlan(result.totalCollectedRamGB).level, 3);
  assert.equal(result.score, 128 * 100 + 250 + 180 * 20);
});
test('revisiting a PC cannot refill spent RAM', () => {
  const run = funded(); const id = [...run.collected.keys()][0]; run.useAbility('agi');
  assert.equal(run.collect(id), 0); assert.equal(run.availableRamGB, 96); assert.equal(run.spentRamGB, 32);
});
test('Z is free and rejects reuse until the exact 450ms boundary', () => {
  const run = new RunSession(42);
  assert.ok(run.useAbility('chip').ok); assert.deepEqual(run.useAbility('chip'), { ok: false, reason: 'cooldown' });
  run.tick(449); assert.equal(run.useAbility('chip').ok, false);
  run.tick(1); assert.ok(run.useAbility('chip').ok); assert.equal(run.availableRamGB, 0); assert.equal(run.spentRamGB, 0);
});
test('each special has the requested cost and cooldown, without double charging on failure', () => {
  for (const id of ['hallucination', 'investment', 'agi'] as AbilityId[]) {
    const run = funded(), ability = ABILITIES[id];
    assert.ok(run.useAbility(id).ok); assert.equal(run.spentRamGB, ability.cost);
    assert.equal(run.useAbility(id).ok, false); assert.equal(run.spentRamGB, ability.cost);
    run.tick(ability.cooldownMs - 1); assert.equal(run.useAbility(id).ok, false);
    run.tick(1); assert.ok(run.useAbility(id).ok); assert.equal(run.spentRamGB, ability.cost * 2);
  }
});
test('insufficient RAM spends nothing and does not start a cooldown', () => {
  const run = new RunSession(42);
  for (const id of ['hallucination', 'agi'] as AbilityId[]) {
    assert.deepEqual(run.useAbility(id), { ok: false, reason: 'ram' }); assert.equal(run.cooldowns.remaining(id, 0), 0);
  }
  assert.equal(run.spentRamGB, 0); assert.ok(run.useAbility('investment').ok);
});
test('invalid spending and attacks after death, timeout or result cannot mutate resources', () => {
  const run = funded();
  for (const amount of [-1, 1.5, NaN, Infinity, 129]) assert.equal(run.spendRam(amount), false);
  assert.equal(run.availableRamGB, 128);
  run.lives = 0; assert.deepEqual(run.useAbility('agi'), { ok: false, reason: 'ended' });
  const timed = funded(); timed.tick(GAME.durationMs); assert.equal(timed.useAbility('agi').ok, false);
  const ended = funded(); ended.finish('goal'); assert.equal(ended.useAbility('agi').ok, false); assert.equal(ended.spentRamGB, 0);
});
test('pause and scene changes keep the same cooldown and enemy status clocks', () => {
  const run = funded(); run.useAbility('agi');
  const control = run.controlFor('street:guard:1'); control.stun(run.elapsedMs, 5000);
  run.visit(0); assert.equal(run.controlFor('street:guard:1'), control);
  assert.equal(run.cooldowns.remaining('agi', run.elapsedMs), 20000);
  run.tick(3000); assert.equal(control.mode(run.elapsedMs, 0, 0), 'stunned'); assert.equal(run.cooldowns.remaining('agi', run.elapsedMs), 17000);
  const fresh = new RunSession(42); assert.equal(fresh.spentRamGB, 0); assert.equal(fresh.cooldowns.remaining('agi', 0), 0); assert.equal(fresh.controlFor('street:guard:1').mode(0, 0, 0), 'normal');
});
test('stun has exact 2s and 5s durations and recasting cannot shorten a stronger stun', () => {
  const control = new EnemyControl(); control.stun(0, 5000); control.stun(1000, 2000);
  assert.equal(control.mode(4999, 0, 0), 'stunned'); assert.equal(control.mode(5000, 0, 0), 'normal');
  control.stun(6000, 2000); assert.equal(control.mode(7999, 0, 0), 'stunned'); assert.equal(control.mode(8000, 0, 0), 'normal');
});
test('confusion reverses movement for 3s and then normal chasing resumes', () => {
 const control=new EnemyControl();control.confuse(100,1);
 const e=new EnemyMemory({id:'test',kind:'resident',sceneId:'house:0',x:0,y:590,min:-200,max:200,activity:'patrol',facing:1},control);e.alarmed=true;
 const ctx={now:101,sceneId:'house:0',playerX:100,playerY:590,wantedLevel:0,occluders:[],reacquireAt:0};
 assert.ok(decideEnemy(e,ctx).velocityX<0);assert.equal(decideEnemy(e,ctx).harmful,false);
 assert.ok(decideEnemy(e,{...ctx,now:3099,playerX:-100}).velocityX<0);
 const normal=decideEnemy(e,{...ctx,now:3100});assert.ok(normal.velocityX>0);assert.equal(normal.harmful,true);
});test('lure only attracts nearby enemies after landing and expires after 4s', () => {
  const control = new EnemyControl();
  const lure: Lure = { sceneId: 'street', x: 100, y: 0, landsAt: 400, expiresAt: 4400 };
  assert.equal(control.mode(399, 0, 0, lure), 'normal'); assert.equal(control.mode(400, 0, 0, lure), 'distracted');
  assert.equal(control.mode(4399, 0, 0, lure), 'distracted'); assert.equal(control.mode(4400, 0, 0, lure), 'normal');
  assert.equal(control.mode(1000, 600, 0, lure), 'normal');
});
test('stun takes priority over confusion and lure, with each remaining effect restored correctly', () => {
  const c = new EnemyControl(); const lure: Lure = { sceneId: 'street', x: 0, y: 0, landsAt: 0, expiresAt: 5000 };
  c.confuse(0, 1); c.stun(0, 2000);
  assert.equal(c.mode(1999, 0, 0, lure), 'stunned'); assert.equal(c.mode(2000, 0, 0, lure), 'confused');
  assert.equal(c.mode(3000, 0, 0, lure), 'distracted'); assert.equal(c.mode(5000, 0, 0, lure), 'normal');
});
test('range attacks include boundary targets and exclude out-of-range and distant flying targets', () => {
  assert.equal(withinAbilityRadius('hallucination', 0, 0, 300, 0), true);
  assert.equal(withinAbilityRadius('hallucination', 0, 0, 301, 0), false);
  assert.equal(withinAbilityRadius('agi', 0, 0, 400, 300), false);
  assert.equal(withinAbilityRadius('agi', 0, 0, 200, 150), true);
});
test('resident status persists only in its owning home and cannot be cloned onto the street', () => {
 const r=funded(),house=r.houses[1],id=house.residents[0].id,control=r.controlFor(id);control.stun(0,5000);r.tick(1000);assert.equal(r.controlFor(id),control);assert.equal(control.mode(1000,0,0),'stunned');
 assert.equal(r.enemyFor({id,kind:'resident',sceneId:'street',x:0,y:590,min:0,max:100}),undefined);
});test('the 48x64 visual retains the original 28x58 collision body and foot anchor', () => {
  const sourceWidth = SAM_ART.bodyWidth / SAM_ART.scale;
  const sourceHeight = SAM_ART.bodyHeight / SAM_ART.scale;
  assert.equal(sourceWidth * SAM_ART.scale, 28); assert.equal(sourceHeight * SAM_ART.scale, 58);
  assert.equal((SAM_ART.height - sourceHeight + sourceHeight) * SAM_ART.scale, SAM_ART.height * SAM_ART.scale);
});
