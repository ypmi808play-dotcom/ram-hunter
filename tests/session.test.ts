import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RunSession, createNeighborhood, formatTime } from '../src/core/session.ts';
import { GAME, PC_TYPES } from '../src/core/config.ts';
test('the neighborhood retains 14 unique houses, all seven PC capacities and top-tier potential', () => {
  for (const seed of [0,1,42,99,0xffffffff]) {
    const run = new RunSession(seed); assert.equal(run.houses.length, 14); assert.ok(run.potentialRamGB >= 1024);
    assert.deepEqual([...new Set(run.houses.flatMap(h=>h.pcs).map(p=>p.gb))].sort((a,b)=>a-b), PC_TYPES.map(t=>t.gb));
  }
});
test('PC placement is reproducible for a seed and varied between runs', () => {
  assert.deepEqual(createNeighborhood(42),createNeighborhood(42)); assert.notDeepEqual(createNeighborhood(42),createNeighborhood(43));
  const pcs=createNeighborhood(42).flatMap(h=>h.pcs); assert.equal(new Set(pcs.map(p=>p.id)).size,pcs.length);
});
test('revisiting a home does not duplicate RAM or visits', () => {
  const r=new RunSession(42),pc=r.houses[0].pcs[0];r.visit(0);assert.equal(r.collect(pc.id),pc.gb);r.visit(0);assert.equal(r.collect(pc.id),0);
  assert.equal(r.visited.size,1);assert.equal(r.collected.size,1);assert.equal(r.totalRamGB,pc.gb);assert.equal(r.collect('missing'),0);r.visit(-1);assert.equal(r.visited.size,1);
});
test('all recovered PC RAM agrees with the result, independently of variable PC counts', () => {
  const r=new RunSession(2026);for(const h of r.houses){r.visit(h.id);for(const p of h.pcs){r.collect(p.id);r.collect(p.id);}}
  const count=r.houses.flatMap(h=>h.pcs).length,result=r.finish('goal');assert.equal(result.totalRamGB,r.potentialRamGB);assert.equal(result.computersEmptied,count);assert.equal(result.housesVisited,14);assert.equal(result.score,r.potentialRamGB*100+count*250+3600);
});
test('the gameplay clock persists through rooms and stops at the selected deadline', () => {
  const r=new RunSession(42);r.tick(17000);r.visit(2);r.tick(43000);assert.equal(r.remainingMs,210000);assert.equal(r.elapsedMs,60000);r.tick(300000);assert.equal(r.remainingMs,0);assert.equal(r.collect(r.houses[0].pcs[0].id),0);
});
test('player invincibility prevents repeated contact damage and exit protection is preserved', () => {
  const r=new RunSession(42);assert.equal(r.damage(),true);assert.equal(r.damage(),false);r.tick(GAME.invincibleMs-1);assert.equal(r.damage(),false);r.tick(1);assert.equal(r.damage(),true);r.protect(3000);r.tick(2999);assert.equal(r.damage(),false);r.tick(1);assert.equal(r.damage(),true);assert.equal(r.lives,0);assert.equal(r.damage(),false);
});
test('finished runs cannot gain resources, lose lives or advance clocks', () => {
  const r=new RunSession(42);r.finish('time');r.tick(1000);assert.equal(r.elapsedMs,0);assert.equal(r.collect(r.houses[0].pcs[0].id),0);assert.equal(r.damage(),false);r.visit(0);assert.equal(r.visited.size,0);
});
test('restart creates clean resources, enemy/drop state, lives and timer', () => {
  const old=new RunSession(4);old.visit(0);old.collect(old.houses[0].pcs[0].id);old.tick(8000);old.damage();const result=old.finish('life'),fresh=new RunSession(5);
  assert.equal(fresh.totalRamGB,0);assert.equal(fresh.visited.size,0);assert.equal(fresh.remainingMs,GAME.durationMs);assert.equal(fresh.lives,3);assert.equal(fresh.enemies.size,0);assert.equal(fresh.drops.size,0);assert.equal(result.totalRamGB,old.totalRamGB);
});
test('countdown rounds upward and supports both 4:30 and 3:00', () => {
  for(const [ms,text] of [[270000,'04:30'],[180000,'03:00'],[60001,'01:01'],[60000,'01:00'],[1,'00:01'],[0,'00:00'],[-1,'00:00']] as const)assert.equal(formatTime(ms),text);
});
