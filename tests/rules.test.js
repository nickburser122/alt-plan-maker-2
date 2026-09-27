import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ruleType, RULE_TYPE_LIST } from '../src/core/rules/registry.js';
import { dowOf } from '../src/core/dates.js';
import { baseModel, makeRun, need, ruleInstance, ctxOf } from './fixtures/rule-harness.js';

const covered = new Set();

function auditWith(model, runs, rule) {
  covered.add(rule.type);
  const ctx = ctxOf(model, runs);
  return { ctx, run(setup) { setup(ctx); ctx.rule = rule; return ruleType(rule.type).audit(ctx); } };
}

test('max-per-day: forced double-booking is reported', () => {
  const model = baseModel();
  const r1 = makeRun('run1', 's1', ['2026-03-02']);
  const r2 = makeRun('run2', 's2', ['2026-03-02']);
  const rule = ruleInstance('rule1', 'max-per-day', { n: 1 });
  const { run } = auditWith(model, [r1, r2], rule);
  const out = run(ctx => {
    ctx.assign(need('run1', 'r1', 0), 'x');
    ctx.assign(need('run2', 'r1', 0), 'x');
  });
  assert.ok(out.length >= 1);
  assert.equal(out[0].refs.resourceId, 'x');
  assert.equal(out[0].refs.date, '2026-03-02');
});

test('max-per-window: forced 2-in-3-days is reported', () => {
  const model = baseModel();
  const r1 = makeRun('run1', 's1', ['2026-03-02']);
  const r2 = makeRun('run2', 's2', ['2026-03-03']);
  const rule = ruleInstance('rule1', 'max-per-window', { n: 1, windowDays: 3 });
  const { run } = auditWith(model, [r1, r2], rule);
  const out = run(ctx => {
    ctx.assign(need('run1', 'r1', 0), 'x');
    ctx.assign(need('run2', 'r1', 0), 'x');
  });
  assert.ok(out.length >= 1);
  assert.equal(out[0].refs.resourceId, 'x');
});

test('min-rest-days: forced back-to-back days is reported', () => {
  const model = baseModel();
  const r1 = makeRun('run1', 's1', ['2026-03-02']);
  const r2 = makeRun('run2', 's2', ['2026-03-03']);
  const rule = ruleInstance('rule1', 'min-rest-days', { days: 1 });
  const { run } = auditWith(model, [r1, r2], rule);
  const out = run(ctx => {
    ctx.assign(need('run1', 'r1', 0), 'x');
    ctx.assign(need('run2', 'r1', 0), 'x');
  });
  assert.ok(out.length >= 1);
  assert.deepEqual(out[0].refs.dates, ['2026-03-02', '2026-03-03']);
});

test('max-consecutive-days: forced 3-day streak over a 2-day cap is reported', () => {
  const model = baseModel();
  const runs = [
    makeRun('run1', 's1', ['2026-03-02']),
    makeRun('run2', 's2', ['2026-03-03']),
    makeRun('run3', 's1', ['2026-03-04'])
  ];
  const rule = ruleInstance('rule1', 'max-consecutive-days', { days: 2 });
  const { run } = auditWith(model, runs, rule);
  const out = run(ctx => {
    for (const r of runs) ctx.assign(need(r.id, 'r1', 0), 'x');
  });
  assert.ok(out.length >= 1);
  assert.equal(out[0].refs.resourceId, 'x');
});

test('min-consecutive-days: forced isolated 1-day run under a 2-day minimum is reported', () => {
  const model = baseModel();
  const r1 = makeRun('run1', 's1', ['2026-03-02']);
  const rule = ruleInstance('rule1', 'min-consecutive-days', { days: 2 });
  const { run } = auditWith(model, [r1], rule);
  const out = run(ctx => { ctx.assign(need('run1', 'r1', 0), 'x'); });
  assert.ok(out.length >= 1);
  assert.equal(out[0].refs.resourceId, 'x');
});

test('weekday-limit: forced booking on a zero-allowance weekday is reported', () => {
  const model = baseModel();
  const date = '2026-03-02';
  const weekday = dowOf(date);
  const r1 = makeRun('run1', 's1', [date]);
  const rule = ruleInstance('rule1', 'weekday-limit', { weekday, max: 0 });
  const { run } = auditWith(model, [r1], rule);
  const out = run(ctx => { ctx.assign(need('run1', 'r1', 0), 'x'); });
  assert.ok(out.length >= 1);
  assert.equal(out[0].refs.resourceId, 'x');
});

test('unavailable-dates: forced booking on a blacked-out date is reported', () => {
  const model = baseModel();
  const date = '2026-03-05';
  const r1 = makeRun('run1', 's1', [date]);
  const rule = ruleInstance('rule1', 'unavailable-dates', { dates: [date] });
  const { run } = auditWith(model, [r1], rule);
  const out = run(ctx => { ctx.assign(need('run1', 'r1', 0), 'x'); });
  assert.ok(out.length >= 1);
  assert.equal(out[0].refs.date, date);
});

test('role-qualification: forced assignment of an unqualified resource is reported', () => {
  const model = baseModel();
  const r1 = makeRun('run1', 's1', ['2026-03-02']);
  const rule = ruleInstance('rule1', 'role-qualification', { roleId: 'r2' });
  const { run } = auditWith(model, [r1], rule);
  const out = run(ctx => { ctx.assign(need('run1', 'r1', 0), 'x'); });
  assert.ok(out.length >= 1);
  assert.equal(out[0].refs.resourceId, 'x');
});

test('pairing: forced solo appearance without the paired partner is reported', () => {
  const model = baseModel();
  const r1 = makeRun('run1', 's1', ['2026-03-02']);
  const rule = ruleInstance('rule1', 'pairing', { a: 'x', b: 'y' });
  const { run } = auditWith(model, [r1], rule);
  const out = run(ctx => { ctx.assign(need('run1', 'r1', 0), 'x'); });
  assert.ok(out.length >= 1);
  assert.equal(out[0].refs.runId, 'run1');
});

test('separation: forced co-appearance of a separated pair is reported', () => {
  const model = baseModel();
  const r1 = makeRun('run1', 's1', ['2026-03-02'], [{ roleId: 'r1', min: 2, max: 2 }]);
  const rule = ruleInstance('rule1', 'separation', { a: 'x', b: 'y' });
  const { run } = auditWith(model, [r1], rule);
  const out = run(ctx => {
    ctx.assign(need('run1', 'r1', 0), 'x');
    ctx.assign(need('run1', 'r1', 1), 'y');
  });
  assert.ok(out.length >= 1);
  assert.equal(out[0].refs.runId, 'run1');
});

test('cap-by-tag: forced over-cap tag grouping on one day is reported', () => {
  const base = baseModel();
  const model = baseModel({
    resources: [
      { ...base.resources[0], id: 'x', tags: ['senior'] },
      { ...base.resources[1], id: 'y', tags: ['senior'] }
    ]
  });
  const r1 = makeRun('run1', 's1', ['2026-03-02']);
  const r2 = makeRun('run2', 's2', ['2026-03-02']);
  const rule = ruleInstance('rule1', 'cap-by-tag', { tag: 'senior', n: 1 });
  const { run } = auditWith(model, [r1, r2], rule);
  const out = run(ctx => {
    ctx.assign(need('run1', 'r1', 0), 'x');
    ctx.assign(need('run2', 'r1', 0), 'y');
  });
  assert.ok(out.length >= 1);
  assert.equal(out[0].refs.tag, 'senior');
});

test('distinct-sites-per-day: forced two-site day for one resource is reported', () => {
  const model = baseModel();
  const r1 = makeRun('run1', 's1', ['2026-03-02']);
  const r2 = makeRun('run2', 's2', ['2026-03-02']);
  const rule = ruleInstance('rule1', 'distinct-sites-per-day', {});
  const { run } = auditWith(model, [r1, r2], rule);
  const out = run(ctx => {
    ctx.assign(need('run1', 'r1', 0), 'x');
    ctx.assign(need('run2', 'r1', 0), 'x');
  });
  assert.ok(out.length >= 1);
  assert.equal(out[0].refs.resourceId, 'x');
});

test('site-min-gap: forced same-site revisit too soon is reported', () => {
  const model = baseModel();
  const r1 = makeRun('run1', 's1', ['2026-03-02']);
  const r2 = makeRun('run2', 's1', ['2026-03-03']);
  const rule = ruleInstance('rule1', 'site-min-gap', { days: 3 });
  const { run } = auditWith(model, [r1, r2], rule);
  const out = run(ctx => {
    ctx.assign(need('run1', 'r1', 0), 'x');
    ctx.assign(need('run2', 'r1', 0), 'y');
  });
  assert.ok(out.length >= 1);
  assert.equal(out[0].refs.siteId, 's1');
});

test('site-target-count: forced under-target visit count is reported', () => {
  const model = baseModel();
  const r1 = makeRun('run1', 's1', ['2026-03-02']);
  const rule = ruleInstance('rule1', 'site-target-count', { count: 2 });
  const { run } = auditWith(model, [r1], rule);
  const out = run(ctx => { ctx.assign(need('run1', 'r1', 0), 'x'); });
  assert.ok(out.length >= 1);
  assert.equal(out[0].refs.siteId, 's1');
});

test('site-required-tag: forced assignment of an untagged resource is reported', () => {
  const base = baseModel();
  const model = baseModel({ sites: [{ ...base.sites[0], id: 's1', tags: ['clearance'] }, base.sites[1]] });
  const r1 = makeRun('run1', 's1', ['2026-03-02']);
  const rule = ruleInstance('rule1', 'site-required-tag', { tag: 'clearance' });
  const { run } = auditWith(model, [r1], rule);
  const out = run(ctx => { ctx.assign(need('run1', 'r1', 0), 'x'); });
  assert.ok(out.length >= 1);
  assert.equal(out[0].refs.siteId, 's1');
});

test('coverage-all-active: forced never-visited active site is reported', () => {
  const model = baseModel();
  const r1 = makeRun('run1', 's1', ['2026-03-02']);
  const rule = ruleInstance('rule1', 'coverage-all-active', {});
  const { run } = auditWith(model, [r1], rule);
  const out = run(ctx => { ctx.assign(need('run1', 'r1', 0), 'x'); });
  assert.ok(out.some(v => v.refs.siteId === 's2'));
});

test('crew-cohesion: forced crew change within the cohesion window is reported', () => {
  const model = baseModel();
  const r1 = makeRun('run1', 's1', ['2026-03-02']);
  const r2 = makeRun('run2', 's1', ['2026-03-04']);
  const rule = ruleInstance('rule1', 'crew-cohesion', { windowDays: 7 });
  const { run } = auditWith(model, [r1, r2], rule);
  const out = run(ctx => {
    ctx.assign(need('run1', 'r1', 0), 'x');
    ctx.assign(need('run2', 'r1', 0), 'y');
  });
  assert.ok(out.length >= 1);
  assert.equal(out[0].refs.siteId, 's1');
});

test('crew-rotation: forced identical crew repeated too soon is reported', () => {
  const model = baseModel();
  const r1 = makeRun('run1', 's1', ['2026-03-02']);
  const r2 = makeRun('run2', 's1', ['2026-03-04']);
  const rule = ruleInstance('rule1', 'crew-rotation', { days: 14 });
  const { run } = auditWith(model, [r1, r2], rule);
  const out = run(ctx => {
    ctx.assign(need('run1', 'r1', 0), 'x');
    ctx.assign(need('run2', 'r1', 0), 'x');
  });
  assert.ok(out.length >= 1);
  assert.equal(out[0].refs.siteId, 's1');
});

test('crew-size-bounds: forced under-sized crew is reported', () => {
  const model = baseModel();
  const r1 = makeRun('run1', 's1', ['2026-03-02'], [{ roleId: 'r1', min: 1, max: 1 }]);
  const rule = ruleInstance('rule1', 'crew-size-bounds', { min: 2, max: 4 });
  const { run } = auditWith(model, [r1], rule);
  const out = run(ctx => { ctx.assign(need('run1', 'r1', 0), 'x'); });
  assert.ok(out.length >= 1);
  assert.equal(out[0].refs.runId, 'run1');
});

test('attribute-window: forced wide same-day site spread is reported', () => {
  const model = baseModel();
  const r1 = makeRun('run1', 's1', ['2026-03-02']);
  const r2 = makeRun('run2', 's2', ['2026-03-02']);
  const rule = ruleInstance('rule1', 'attribute-window', { attr: 'km', maxSpread: 5 });
  const { run } = auditWith(model, [r1, r2], rule);
  const out = run(ctx => {
    ctx.assign(need('run1', 'r1', 0), 'x');
    ctx.assign(need('run2', 'r1', 0), 'y');
  });
  assert.ok(out.length >= 1);
  assert.equal(out[0].refs.date, '2026-03-02');
});

test('attribute-cap: forced same-day attribute overload is reported', () => {
  const model = baseModel();
  const r1 = makeRun('run1', 's1', ['2026-03-02']);
  const r2 = makeRun('run2', 's2', ['2026-03-02']);
  const rule = ruleInstance('rule1', 'attribute-cap', { attr: 'km', max: 10 });
  const { run } = auditWith(model, [r1, r2], rule);
  const out = run(ctx => {
    ctx.assign(need('run1', 'r1', 0), 'x');
    ctx.assign(need('run2', 'r1', 0), 'x');
  });
  assert.ok(out.length >= 1);
  assert.equal(out[0].refs.resourceId, 'x');
});

test('attribute-affinity: forced assignment against a stated low-km preference is reported', () => {
  const base = baseModel();
  const model = baseModel({
    resources: [
      { ...base.resources[0], id: 'x', attrs: { km: 0 }, prefs: [{ attr: 'km', dir: 'low', strength: 1 }] },
      base.resources[1]
    ]
  });
  const r1 = makeRun('run1', 's2', ['2026-03-02']);
  const rule = ruleInstance('rule1', 'attribute-affinity', { attr: 'km' }, { severity: 'soft' });
  const { run } = auditWith(model, [r1], rule);
  const out = run(ctx => { ctx.assign(need('run1', 'r1', 0), 'x'); });
  assert.ok(out.length >= 1);
  assert.equal(out[0].refs.resourceId, 'x');
});

test('every registered rule type has a forced-violation test above', () => {
  assert.deepEqual([...covered].sort(), [...RULE_TYPE_LIST].sort());
});
