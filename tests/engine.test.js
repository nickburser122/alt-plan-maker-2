import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { migrateV1 } from '../src/core/migrate.js';
import { solve } from '../src/core/solve.js';
import { generateRuns } from '../src/core/demand.js';
import { flattenEngagements } from '../src/core/runs.js';
import { buildHospitalModel } from './fixtures/hospital-shifts.js';
import { buildPatrolModel } from './fixtures/patrol.js';
import { buildPerfModel } from './fixtures/perf-model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const v1 = JSON.parse(readFileSync(path.join(__dirname, 'fixtures/v1-seed.json'), 'utf8'));

function buildFieldVisitsModel() {
  return migrateV1(v1);
}

function canonicalPlan(plan) {
  const assignments = plan.assignments
    .map(a => ({ needId: a.id, resourceId: a.resourceId, bent: a.bent }))
    .sort((a, b) => a.needId.localeCompare(b.needId));
  const openSlots = plan.openSlots
    .map(s => s.needId)
    .sort((a, b) => a.localeCompare(b));
  return JSON.stringify({ assignments, openSlots });
}

test('the 3 fixture models each solve with 0 hard violations', () => {
  const fixtures = [
    ['field-visits', buildFieldVisitsModel()],
    ['hospital-shifts', buildHospitalModel()],
    ['patrol', buildPatrolModel()]
  ];
  for (const [name, model] of fixtures) {
    const plan = solve(model);
    const hardViolations = plan.violations.filter(v => v.severity === 'hard');
    assert.deepEqual(hardViolations, [], `${name} should have 0 hard violations`);
  }
});

test('same seed run 50x produces an identical plan every time', () => {
  const model = buildFieldVisitsModel();
  const opts = { seed: 777, restarts: 1, lnsIterations: 0 };
  const first = canonicalPlan(solve(model, opts));
  for (let i = 0; i < 50; i++) {
    const again = canonicalPlan(solve(model, opts));
    assert.equal(again, first, `run ${i} diverged from run 0`);
  }
});

test('different seeds produce at least 30 distinct plans out of 50', () => {
  const model = buildFieldVisitsModel();
  const seen = new Set();
  for (let seed = 0; seed < 50; seed++) {
    seen.add(canonicalPlan(solve(model, { seed, restarts: 1, lnsIterations: 0 })));
  }
  assert.ok(seen.size >= 30, `only ${seen.size} distinct plans out of 50`);
});

test('locked assignments survive regeneration 100%', () => {
  const model = buildFieldVisitsModel();
  const runs = generateRuns(model);
  const engagements = flattenEngagements(runs);
  const firstRun = runs[0];
  const firstEngagement = engagements.find(e => e.runId === firstRun.id);
  const roleId = firstRun.demand[0].roleId;
  const lockResource = model.resources.find(r => r.active && r.roles.includes(roleId));

  const locked = { ...model, locks: [{ engagementId: firstEngagement.id, roleId, slotIndex: 0, resourceId: lockResource.id }] };

  for (let seed = 0; seed < 25; seed++) {
    const plan = solve(locked, { seed, restarts: 2, lnsIterations: 30 });
    const rec = plan.assignments.find(a => a.runId === firstRun.id && a.roleId === roleId && a.unitIndex === 0);
    assert.ok(rec, `seed ${seed}: locked need was not assigned at all`);
    assert.equal(rec.resourceId, lockResource.id, `seed ${seed}: lock was not honored`);
  }
});

test('120 resources x 60 sites x 90 days x 12 restarts solves in under 1500ms', () => {
  const model = buildPerfModel();
  const t0 = Date.now();
  const plan = solve(model);
  const elapsed = Date.now() - t0;
  assert.ok(elapsed < 1500, `took ${elapsed}ms`);
  assert.equal(plan.openSlots.length, 0);
});
