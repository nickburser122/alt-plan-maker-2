import { SCHEMA_VERSION } from '../../src/core/schema.js';
import { bi } from '../../src/core/bi.js';

const ROLES = ['r_doc', 'r_nurse', 'r_admin'];
const BLOCKS = ['b_morn', 'b_eve', 'b_night'];
const STAFF_PER_ROLE = 4;

function makeResources() {
  const out = [];
  for (const roleId of ROLES) {
    for (let i = 0; i < STAFF_PER_ROLE; i++) {
      out.push({
        id: `${roleId}_${i}`,
        name: bi(`${roleId} ${i}`, `${roleId} ${i}`),
        roles: [roleId],
        tags: [],
        attrs: {},
        avail: { weekdays: [1, 1, 1, 1, 1, 1, 1], off: [], only: [], patternId: null },
        caps: { maxPerDay: 1, maxPerWeek: null, minRestDays: 0 },
        prefs: [],
        weight: 1,
        active: true
      });
    }
  }
  return out;
}

export function buildHospitalModel() {
  return {
    schema: SCHEMA_VERSION,
    lexicon: {
      resource: bi('Staff', 'موظف'),
      site: bi('Ward', 'جناح'),
      engagement: bi('Shift', 'مناوبة'),
      run: bi('Shift', 'مناوبة')
    },
    attributes: [],
    roles: [
      { id: 'r_doc', name: bi('Doctor', 'طبيب'), short: 'D', color: '--role-1' },
      { id: 'r_nurse', name: bi('Nurse', 'ممرض'), short: 'N', color: '--role-2' },
      { id: 'r_admin', name: bi('Admin', 'إداري'), short: 'A', color: '--role-3' }
    ],
    siteClasses: [
      {
        id: 'c_hosp',
        name: bi('Hospital', 'مستشفى'),
        planned: true,
        demand: [{ roleId: 'r_doc', min: 1, max: 1 }, { roleId: 'r_nurse', min: 1, max: 1 }, { roleId: 'r_admin', min: 1, max: 1 }],
        runLength: 1,
        cohesion: 'full'
      }
    ],
    sites: [
      { id: 's_hosp', name: bi('Main Hospital', 'المستشفى الرئيسي'), classId: 'c_hosp', tags: [], attrs: {}, weight: 1, active: true, cadence: { minGapDays: 0, targetPerHorizon: null, maxPerHorizon: null } }
    ],
    resources: makeResources(),
    patterns: [],
    calendar: {
      horizon: { start: '2026-01-05', end: '2026-01-11' },
      weekdayDefaults: Array.from({ length: 7 }, () => ({
        on: true,
        blocks: BLOCKS.map(blockId => ({ blockId, slots: 1, bias: 'auto' }))
      })),
      dateOverrides: {},
      blocks: BLOCKS.map((id, i) => ({ id, name: bi(id, id), order: i }))
    },
    rules: [
      { id: 'r_max1', type: 'max-per-day', enabled: true, severity: 'hard', weight: 100, scope: { roles: [], tags: [], resources: [] }, params: { n: 1 } },
      { id: 'r_maxconsec', type: 'max-consecutive-days', enabled: true, severity: 'hard', weight: 100, scope: { roles: [], tags: [], resources: [] }, params: { days: 5 } }
    ],
    objectives: [{ id: 'fairness', enabled: true, weight: 80 }],
    engine: { seed: 7, restarts: 8, lnsIterations: 60, timeBudgetMs: 1500, relaxMode: 'relaxed' },
    locks: [],
    ui: { lang: 'en', view: 'plan' }
  };
}
