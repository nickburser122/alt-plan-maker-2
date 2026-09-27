import { SCHEMA_VERSION } from './schema.js';
import { bi } from './bi.js';

export { bi };

export function cloneModel(model) {
  return structuredClone(model);
}

export function blankModel() {
  return {
    schema: SCHEMA_VERSION,
    lexicon: {
      resource: bi('Person', 'فرد'),
      site: bi('Facility', 'مرفق'),
      engagement: bi('Visit', 'زيارة'),
      run: bi('Run', 'سلسلة')
    },
    attributes: [],
    roles: [],
    siteClasses: [],
    sites: [],
    resources: [],
    patterns: [],
    calendar: {
      horizon: { start: null, end: null },
      weekdayDefaults: Array.from({ length: 7 }, () => ({ on: false, blocks: [] })),
      dateOverrides: {},
      blocks: [{ id: 'b_day', name: bi('Visit', 'زيارة'), order: 0 }]
    },
    rules: [],
    objectives: [],
    engine: { seed: 1, restarts: 12, lnsIterations: 80, timeBudgetMs: 1500 },
    locks: [],
    ui: { lang: 'en', view: 'plan' }
  };
}

export function byId(arr, id) {
  return arr.find(x => x.id === id);
}

export function roleOf(model, resource) {
  return resource.roles.map(rid => byId(model.roles, rid)).filter(Boolean);
}

export function siteClassOf(model, site) {
  return byId(model.siteClasses, site.classId);
}
