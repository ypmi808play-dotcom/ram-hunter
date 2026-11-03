import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDataCenterPlan } from '../src/core/empire.ts';

test('every growth threshold uses the correct tier, including adjacent values', () => {
  for (const [ram, expected] of [[0, 1], [31, 1], [32, 2], [127, 2], [128, 3], [255, 3], [256, 4], [511, 4], [512, 5], [1023, 5], [1024, 6], [4096, 6]]) assert.equal(createDataCenterPlan(ram).level, expected, `${ram}GB`);
});
test('the same amount of RAM always produces the same buildings and equipment', () => {
  assert.deepEqual(createDataCenterPlan(1184), createDataCenterPlan(1184));
});
test('the campus keeps expanding above 1024GB', () => {
  const a = createDataCenterPlan(1024), b = createDataCenterPlan(2048), c = createDataCenterPlan(4096);
  assert.ok(a.buildingCount < b.buildingCount && b.buildingCount < c.buildingCount);
  assert.ok(a.coolingCount < b.coolingCount && b.coolingCount < c.coolingCount);
  assert.ok(a.powerCount < c.powerCount); assert.ok(a.rackCount < c.rackCount);
  assert.ok(c.columns * c.rows >= c.buildings.length);
});
test('growth within a tier increases rack capacity without shrinking the campus', () => {
  let previous = createDataCenterPlan(0);
  for (let ram = 4; ram <= 4096; ram += 4) {
    const plan = createDataCenterPlan(ram);
    assert.ok(plan.rackCount >= previous.rackCount); assert.ok(plan.buildingCount >= previous.buildingCount);
    assert.ok(plan.coolingCount >= previous.coolingCount); assert.ok(plan.powerCount >= previous.powerCount);
    assert.equal(plan.buildings.length, plan.buildingCount); previous = plan;
  }
});
test('server racks are assigned to buildings without losing any RAM capacity', () => {
  for (const ram of [32, 64, 127, 128, 192, 256, 512, 1024, 2048, 4096]) {
    const p = createDataCenterPlan(ram);
    assert.equal(p.buildings.reduce((n, b) => n + b.racks, 0), p.rackCount);
    assert.equal(new Set(p.buildings.map(b => `${b.col}:${b.row}`)).size, p.buildingCount);
  }
});
test('zero, negative and nonfinite RAM produce an empty site safely', () => {
  for (const ram of [0, -100, NaN, Infinity]) { const p = createDataCenterPlan(ram); assert.equal(p.totalRamGB, 0); assert.equal(p.rackCount, 0); assert.equal(p.buildingCount, 0); }
});
test('rack, bedroom and campus tiers have different physical structures', () => {
  assert.equal(createDataCenterPlan(16).buildingCount, 0);
  assert.equal(createDataCenterPlan(64).buildingCount, 1);
  assert.ok(createDataCenterPlan(192).buildingCount >= 2);
});
