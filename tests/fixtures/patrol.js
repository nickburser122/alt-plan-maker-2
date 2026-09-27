import { SCHEMA_VERSION } from '../../src/core/schema.js';
import { bi } from '../../src/core/bi.js';

export function buildPatrolModel() {
  return {
    schema: SCHEMA_VERSION,
    lexicon: {
      resource: bi('Officer', 'ضابط'),
      site: bi('Beat', 'نطاق'),
      engagement: bi('Patrol', 'دورية'),
      run: bi('Tour', 'جولة')
    },
    attributes: [],
    roles: [{ id: 'r_patrol', name: bi('Patrol', 'دورية'), short: 'P', color: '--role-1' }],
    siteClasses: [
      { id: 'c_beat', name: bi('Beat', 'نطاق'), planned: true, demand: [{ roleId: 'r_patrol', min: 1, max: 1 }], runLength: 2, cohesion: 'full' }
    ],
    sites: [
      { id: 's_beat1', name: bi('Beat 1', 'النطاق ١'), classId: 'c_beat', tags: [], attrs: {}, weight: 1, active: true, cadence: { minGapDays: 0, targetPerHorizon: null, maxPerHorizon: null } }
    ],
    resources: [
      { id: 'p_a', name: bi('Officer A', 'الضابط أ'), roles: ['r_patrol'], tags: [], attrs: {}, avail: { weekdays: [1, 1, 1, 1, 1, 1, 1], off: [], only: [], patternId: 'pat_a' }, caps: { maxPerDay: 1, maxPerWeek: null, minRestDays: 0 }, prefs: [], weight: 1, active: true },
      { id: 'p_b', name: bi('Officer B', 'الضابط ب'), roles: ['r_patrol'], tags: [], attrs: {}, avail: { weekdays: [1, 1, 1, 1, 1, 1, 1], off: [], only: [], patternId: 'pat_b' }, caps: { maxPerDay: 1, maxPerWeek: null, minRestDays: 0 }, prefs: [], weight: 1, active: true }
    ],
    patterns: [
      { id: 'pat_a', cycle: ['on', 'on', 'off', 'off'], anchor: '2026-02-02' },
      { id: 'pat_b', cycle: ['on', 'on', 'off', 'off'], anchor: '2026-02-04' }
    ],
    calendar: {
      horizon: { start: '2026-02-02', end: '2026-02-09' },
      weekdayDefaults: Array.from({ length: 7 }, () => ({ on: true, blocks: [{ blockId: 'b_shift', slots: 1, bias: 'auto' }] })),
      dateOverrides: {},
      blocks: [{ id: 'b_shift', name: bi('Shift', 'وردية'), order: 0 }]
    },
    rules: [],
    objectives: [],
    engine: { seed: 3, restarts: 4, lnsIterations: 20, timeBudgetMs: 1500, relaxMode: 'relaxed' },
    locks: [],
    ui: { lang: 'en', view: 'plan' }
  };
}
