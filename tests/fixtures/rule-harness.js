import { bi } from '../../src/core/bi.js';
import { SCHEMA_VERSION } from '../../src/core/schema.js';
import { ScheduleState } from '../../src/core/solver/state.js';

function baseResource(id, overrides = {}) {
  return {
    id,
    name: bi(id, id),
    roles: ['r1'],
    tags: [],
    attrs: { km: 0 },
    avail: { weekdays: [1, 1, 1, 1, 1, 1, 1], off: [], only: [], patternId: null },
    caps: { maxPerDay: null, maxPerWeek: null, minRestDays: 0 },
    prefs: [],
    weight: 1,
    active: true,
    ...overrides
  };
}

function baseSite(id, overrides = {}) {
  return {
    id,
    name: bi(id, id),
    classId: 'c1',
    tags: [],
    attrs: { km: 5 },
    weight: 1,
    active: true,
    cadence: { minGapDays: 0, targetPerHorizon: null, maxPerHorizon: null },
    ...overrides
  };
}

export function baseModel(patch = {}) {
  const { resources, sites, ...rest } = patch;
  return {
    schema: SCHEMA_VERSION,
    lexicon: { resource: bi('R', 'R'), site: bi('S', 'S'), engagement: bi('E', 'E'), run: bi('Run', 'Run') },
    attributes: [{ id: 'km', label: bi('Distance', 'Distance'), unit: 'km', domain: [0, 999], agg: 'sum' }],
    roles: [
      { id: 'r1', name: bi('R1', 'R1'), short: '1', color: '--role-1' },
      { id: 'r2', name: bi('R2', 'R2'), short: '2', color: '--role-2' }
    ],
    siteClasses: [{ id: 'c1', name: bi('C1', 'C1'), planned: true, demand: [{ roleId: 'r1', min: 1, max: 1 }], runLength: 1, cohesion: 'full' }],
    sites: sites || [baseSite('s1', { attrs: { km: 5 } }), baseSite('s2', { attrs: { km: 25 } })],
    resources: resources || [baseResource('x'), baseResource('y')],
    patterns: [],
    calendar: {
      horizon: { start: '2026-03-02', end: '2026-03-20' },
      weekdayDefaults: Array.from({ length: 7 }, () => ({ on: true, blocks: [{ blockId: 'b', slots: 1, bias: 'auto' }] })),
      dateOverrides: {},
      blocks: [{ id: 'b', name: bi('B', 'B'), order: 0 }]
    },
    rules: [],
    objectives: [],
    engine: { seed: 1, restarts: 1, lnsIterations: 0, timeBudgetMs: 1000, relaxMode: 'strict' },
    locks: [],
    ui: { lang: 'en', view: 'plan' },
    ...rest
  };
}

export function makeRun(id, siteId, dates, demand = [{ roleId: 'r1', min: 1, max: 1 }], extra = {}) {
  return { id, siteId, classId: 'c1', blockId: 'b', startDate: dates[0], dates, demand, cohesion: 'full', ...extra };
}

export function need(runId, roleId, unitIndex = 0) {
  return { id: `${runId}:${roleId}:${unitIndex}`, runId, roleId, unitIndex };
}

export function ruleInstance(id, type, params, overrides = {}) {
  return { id, type, enabled: true, severity: 'hard', weight: 100, scope: { roles: [], tags: [], resources: [] }, params, ...overrides };
}

export function ctxOf(model, runs) {
  return new ScheduleState(model, runs);
}
