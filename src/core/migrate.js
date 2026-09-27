import { SCHEMA_VERSION } from './schema.js';
import { bi } from './model.js';
import { dowOf, addISO, monthBounds } from './dates.js';

const TYPE_TO_CLASS = { main: 'c_main', contracted: 'c_contracted', excluded: 'c_excluded' };
const POOL_TO_ROLE = { fin: 'r_fin', clin: 'r_clin' };
const BLOCK_ID = 'b_day';

function resolveHorizon(scope) {
  const mode = scope?.mode || 'custom';
  const start = scope?.start;
  if (mode === 'week') return { start, end: addISO(start, 6) };
  if (mode === 'month') return monthBounds(start);
  let end = scope?.end;
  if (!end || end < start) end = start;
  return { start, end };
}

function dayBlocks(cfg) {
  if (!cfg.on) return [];
  return [{ blockId: BLOCK_ID, slots: cfg.visits, bias: cfg.pref }];
}

function migrateWeekdayDefaults(weekdayDefaults) {
  return (weekdayDefaults || []).map(w => ({ on: !!w.on, blocks: dayBlocks(w) }));
}

function migrateDateOverrides(dayOverrides, weekdayDefaults) {
  const out = {};
  for (const [iso, ov] of Object.entries(dayOverrides || {})) {
    const base = weekdayDefaults[dowOf(iso)] || { on: false, visits: 0, pref: 'auto' };
    const cfg = {
      on: ov.on !== undefined ? ov.on : base.on,
      visits: ov.visits !== undefined ? ov.visits : base.visits,
      pref: ov.pref !== undefined ? ov.pref : base.pref
    };
    out[iso] = { on: cfg.on, blocks: dayBlocks(cfg) };
  }
  return out;
}

function migrateRoles() {
  return [
    { id: 'r_fin', name: bi('Financial', 'مالي'), short: 'F', color: '--role-1' },
    { id: 'r_clin', name: bi('Clinical', 'طبي'), short: 'C', color: '--role-2' }
  ];
}

function migrateAttributes() {
  return [
    { id: 'km', label: bi('Distance', 'المسافة'), unit: 'km', domain: [0, 999], agg: 'sum' }
  ];
}

function demandFor(staffing, key) {
  const s = staffing?.[key] || { fin: 0, clin: 0 };
  return [
    { roleId: 'r_fin', min: s.fin, max: s.fin },
    { roleId: 'r_clin', min: s.clin, max: s.clin }
  ];
}

function migrateSiteClasses(staffing) {
  return [
    { id: 'c_main', name: bi('Main', 'رئيسية'), planned: true, demand: demandFor(staffing, 'main'), runLength: 1, cohesion: 'full' },
    { id: 'c_contracted', name: bi('Contracted', 'متعاقدة'), planned: true, demand: demandFor(staffing, 'contracted'), runLength: 1, cohesion: 'full' },
    { id: 'c_excluded', name: bi('Excluded', 'مستبعدة'), planned: false, demand: [], runLength: 1, cohesion: 'full' }
  ];
}

function migrateSites(facilities) {
  return (facilities || []).map(f => ({
    id: f.id,
    name: bi(f.name, f.name),
    classId: TYPE_TO_CLASS[f.type] || 'c_excluded',
    tags: [],
    attrs: { km: f.km || 0 },
    weight: f.weight ?? 1,
    active: f.active !== false,
    cadence: { minGapDays: 0, targetPerHorizon: null, maxPerHorizon: null }
  }));
}

function migrateResources(people, settings) {
  const minRest = settings?.noConsecutive ? 1 : 0;
  const maxPerDay = settings?.oneVisitPerDay ? 1 : null;
  return (people || []).map(p => ({
    id: p.id,
    name: bi(p.name, p.name),
    roles: [POOL_TO_ROLE[p.pool] || 'r_fin'],
    tags: [],
    attrs: { km: p.originKm || 0 },
    avail: {
      weekdays: (p.weekdays || [true, true, true, true, true, false, false]).map(b => b ? 1 : 0),
      off: p.offDates || [],
      only: [],
      patternId: null
    },
    caps: { maxPerDay, maxPerWeek: null, minRestDays: minRest },
    prefs: p.pref && p.pref !== 'none' ? [{ attr: 'km', dir: p.pref === 'near' ? 'low' : 'high', strength: 1 }] : [],
    weight: p.weight ?? 1,
    active: p.active !== false
  }));
}

function migrateRules(settings) {
  return [
    { id: 'r_no_consec', type: 'min-rest-days', enabled: !!settings?.noConsecutive, severity: 'hard', weight: 100, scope: { roles: [], tags: [], resources: [] }, params: { days: 1 } },
    { id: 'r_one_per_day', type: 'max-per-day', enabled: !!settings?.oneVisitPerDay, severity: 'hard', weight: 100, scope: { roles: [], tags: [], resources: [] }, params: { n: 1 } },
    { id: 'r_distinct', type: 'distinct-sites-per-day', enabled: !!settings?.distinctPerDay, severity: 'hard', weight: 100, scope: { roles: [], tags: [], resources: [] }, params: {} },
    { id: 'r_pref', type: 'attribute-affinity', enabled: !!settings?.useW?.pref, severity: 'soft', weight: settings?.weights?.pref ?? 50, scope: { roles: [], tags: [], resources: [] }, params: { attr: 'km' } }
  ];
}

function migrateObjectives(weights, useW) {
  const ids = ['fairness', 'pref', 'distance', 'facility', 'person'];
  return ids.map(id => ({ id, enabled: !!useW?.[id], weight: weights?.[id] ?? 0 }));
}

export function migrateV1(v1) {
  const settings = v1?.settings || {};
  const weekdayDefaults = settings.weekdayDefaults || [];
  const horizon = resolveHorizon(v1?.scope);

  const model = {
    schema: SCHEMA_VERSION,
    lexicon: {
      resource: bi('Person', 'فرد'),
      site: bi('Facility', 'مرفق'),
      engagement: bi('Visit', 'زيارة'),
      run: bi('Run', 'سلسلة')
    },
    attributes: migrateAttributes(),
    roles: migrateRoles(),
    siteClasses: migrateSiteClasses(settings.staffing),
    sites: migrateSites(v1?.facilities),
    resources: migrateResources(v1?.people, settings),
    patterns: [],
    calendar: {
      horizon,
      weekdayDefaults: migrateWeekdayDefaults(weekdayDefaults),
      dateOverrides: migrateDateOverrides(v1?.dayOverrides, weekdayDefaults),
      blocks: [{ id: BLOCK_ID, name: bi('Visit', 'زيارة'), order: 0 }]
    },
    rules: migrateRules(settings),
    objectives: migrateObjectives(settings.weights, settings.useW),
    engine: {
      seed: settings.seed ?? 1,
      restarts: settings.restarts ?? 12,
      lnsIterations: 80,
      timeBudgetMs: 1500,
      relaxMode: settings.relaxMode || 'relaxed',
      rotate: !!settings.rotate,
      ratio: settings.ratio || null
    },
    locks: [],
    ui: { lang: settings.lang || 'en', view: 'plan', autosave: settings.autosave !== false }
  };

  return model;
}

export const V1_STORAGE_KEY = 'mauveineRota.v1';
export const V2_STORAGE_KEY = 'rota.v2';
