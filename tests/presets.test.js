import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PRESETS, findPreset } from '../src/core/presets.js';
import { validateModel } from '../src/core/schema.js';
import { solve } from '../src/core/solve.js';

test('every preset builds a schema-valid model', () => {
  for (const preset of PRESETS) {
    const model = preset.build();
    const errors = validateModel(model);
    assert.deepEqual(errors, [], `${preset.id}: ${errors.join(', ')}`);
  }
});

test('every populated preset solves cleanly with zero configuration', () => {
  for (const preset of PRESETS) {
    if (preset.id === 'blank') continue;
    const model = preset.build();
    const plan = solve(model);
    const hardViolations = plan.violations.filter(v => v.severity === 'hard');
    assert.equal(plan.openSlots.length, 0, `${preset.id} has open slots`);
    assert.deepEqual(hardViolations, [], `${preset.id} has hard violations`);
  }
});

test('the blank preset is a valid, empty starting point', () => {
  const model = findPreset('blank').build();
  assert.equal(model.resources.length, 0);
  assert.equal(model.sites.length, 0);
  const plan = solve(model);
  assert.equal(plan.assignments.length, 0);
  assert.equal(plan.openSlots.length, 0);
});

test('field-visits preset matches the old app structure: 2 roles, main/contracted demand, no-back-to-back', () => {
  const model = findPreset('field-visits').build();
  assert.equal(model.roles.length, 2);
  const main = model.siteClasses.find(c => c.id === 'c_main');
  const contracted = model.siteClasses.find(c => c.id === 'c_contracted');
  assert.ok(main && contracted);
  const restRule = model.rules.find(r => r.type === 'min-rest-days' && r.enabled);
  assert.ok(restRule, 'expected an enabled min-rest-days rule');
});

test('on-call preset uses a runLength-2 site class and complementary cycle patterns', () => {
  const model = findPreset('on-call').build();
  assert.equal(model.siteClasses[0].runLength, 2);
  assert.equal(model.siteClasses[0].cohesion, 'full');
  assert.equal(model.patterns.length, 2);
});

test('duty-rota preset has a pairing rule, a separation rule, and quarterly site cadence', () => {
  const model = findPreset('duty-rota').build();
  assert.ok(model.rules.some(r => r.type === 'pairing' && r.enabled));
  assert.ok(model.rules.some(r => r.type === 'separation' && r.enabled));
  assert.ok(model.sites.every(s => s.cadence.minGapDays >= 60));
});

test('presets accept a custom start date deterministically', () => {
  const a = findPreset('shift-roster').build('2027-01-04');
  const b = findPreset('shift-roster').build('2027-01-04');
  assert.equal(a.calendar.horizon.start, '2027-01-04');
  assert.deepEqual(a.calendar.horizon, b.calendar.horizon);
});
