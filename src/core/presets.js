import { bi } from './bi.js';
import { SCHEMA_VERSION } from './schema.js';
import { migrateV1 } from './migrate.js';

const FALLBACK_TODAY = '2026-09-07';

function addDaysISO(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function fieldVisitsSeed(start) {
  return {
    scope: { mode: 'custom', start, end: addDaysISO(start, 13) },
    dayOverrides: {},
    facilities: [
      { id: 'fv_s1', name: 'Central Clinic', type: 'main', km: 8, weight: 1, active: true },
      { id: 'fv_s2', name: 'Northside Health Unit', type: 'main', km: 14, weight: 1, active: true },
      { id: 'fv_s3', name: 'Riverside Contracted Lab', type: 'contracted', km: 22, weight: 1, active: true },
      { id: 'fv_s4', name: 'Harborview Pharmacy', type: 'contracted', km: 30, weight: 1, active: true },
      { id: 'fv_s5', name: 'Old Records Office', type: 'excluded', km: 5, weight: 1, active: true }
    ],
    people: [
      { id: 'fv_p1', name: 'Amina', pool: 'fin', originKm: 5, pref: 'near', weight: 1, weekdays: [true, true, true, true, true, false, false], offDates: [], active: true },
      { id: 'fv_p2', name: 'Yousef', pool: 'fin', originKm: 10, pref: 'near', weight: 1, weekdays: [true, true, true, true, true, false, false], offDates: [], active: true },
      { id: 'fv_p3', name: 'Salma', pool: 'fin', originKm: 18, pref: 'none', weight: 1, weekdays: [true, true, true, true, true, false, false], offDates: [], active: true },
      { id: 'fv_p4', name: 'Nourhan', pool: 'fin', originKm: 9, pref: 'near', weight: 1, weekdays: [true, true, true, true, true, false, false], offDates: [], active: true },
      { id: 'fv_p5', name: 'Hassan', pool: 'fin', originKm: 16, pref: 'none', weight: 1, weekdays: [true, true, true, true, true, false, false], offDates: [], active: true },
      { id: 'fv_p6', name: 'Karim', pool: 'clin', originKm: 6, pref: 'near', weight: 1, weekdays: [true, true, true, true, true, false, false], offDates: [], active: true },
      { id: 'fv_p7', name: 'Rania', pool: 'clin', originKm: 12, pref: 'none', weight: 1, weekdays: [true, true, true, true, true, false, false], offDates: [], active: true },
      { id: 'fv_p8', name: 'Tarek', pool: 'clin', originKm: 20, pref: 'far', weight: 1, weekdays: [true, true, true, true, true, false, false], offDates: [], active: true },
      { id: 'fv_p9', name: 'Dina', pool: 'clin', originKm: 7, pref: 'near', weight: 1, weekdays: [true, true, true, true, true, false, false], offDates: [], active: true },
      { id: 'fv_p10', name: 'Mostafa', pool: 'clin', originKm: 15, pref: 'none', weight: 1, weekdays: [true, true, true, true, true, false, false], offDates: [], active: true },
      { id: 'fv_p11', name: 'Heba', pool: 'clin', originKm: 11, pref: 'near', weight: 1, weekdays: [true, true, true, true, true, false, false], offDates: [], active: true }
    ],
    settings: {
      lang: 'en',
      weekdayDefaults: [
        { on: false, visits: 0, pref: 'auto' },
        { on: true, visits: 1, pref: 'auto' },
        { on: true, visits: 1, pref: 'auto' },
        { on: true, visits: 1, pref: 'auto' },
        { on: true, visits: 2, pref: 'auto' },
        { on: false, visits: 0, pref: 'auto' },
        { on: false, visits: 0, pref: 'auto' }
      ],
      staffing: { main: { fin: 2, clin: 2 }, contracted: { fin: 1, clin: 2 } },
      ratio: { m: 3, c: 1 },
      distinctPerDay: true, rotate: true, noConsecutive: true, oneVisitPerDay: true, relaxMode: 'relaxed',
      nearKm: 15,
      weights: { fairness: 60, pref: 40, distance: 20, facility: 10, person: 10 },
      useW: { fairness: true, pref: true, distance: false, facility: false, person: false },
      seed: 20260907, restarts: 12, autosave: true
    }
  };
}

function shiftRosterModel(start) {
  const roles = ['r_doc', 'r_nurse', 'r_admin'];
  const blocks = ['b_morn', 'b_eve', 'b_night'];
  const perRole = 4;
  const resources = [];
  const names = {
    r_doc: ['Dr. Farouk', 'Dr. Nabil', 'Dr. Huda', 'Dr. Salem'],
    r_nurse: ['Nurse Iman', 'Nurse Adel', 'Nurse Wafaa', 'Nurse Sami'],
    r_admin: ['Reem', 'Basil', 'Layla', 'Omar']
  };
  for (const roleId of roles) {
    for (let i = 0; i < perRole; i++) {
      resources.push({
        id: `${roleId}_${i}`, name: bi(names[roleId][i], names[roleId][i]), roles: [roleId], tags: [], attrs: {},
        avail: { weekdays: [1, 1, 1, 1, 1, 1, 1], off: [], only: [], patternId: null },
        caps: { maxPerDay: 1, maxPerWeek: null, minRestDays: 0 }, prefs: [], weight: 1, active: true
      });
    }
  }
  return {
    schema: SCHEMA_VERSION,
    lexicon: { resource: bi('Staff', 'موظف'), site: bi('Ward', 'جناح'), engagement: bi('Shift', 'مناوبة'), run: bi('Shift', 'مناوبة') },
    attributes: [],
    roles: [
      { id: 'r_doc', name: bi('Doctor', 'طبيب'), short: 'D', color: '--role-1' },
      { id: 'r_nurse', name: bi('Nurse', 'ممرض'), short: 'N', color: '--role-2' },
      { id: 'r_admin', name: bi('Admin', 'إداري'), short: 'A', color: '--role-3' }
    ],
    siteClasses: [{
      id: 'c_hosp', name: bi('Hospital', 'مستشفى'), planned: true,
      demand: [{ roleId: 'r_doc', min: 1, max: 1 }, { roleId: 'r_nurse', min: 1, max: 1 }, { roleId: 'r_admin', min: 1, max: 1 }],
      runLength: 1, cohesion: 'full'
    }],
    sites: [{ id: 's_hosp', name: bi('Main Hospital', 'المستشفى الرئيسي'), classId: 'c_hosp', tags: [], attrs: {}, weight: 1, active: true, cadence: { minGapDays: 0, targetPerHorizon: null, maxPerHorizon: null } }],
    resources,
    patterns: [],
    calendar: {
      horizon: { start, end: addDaysISO(start, 6) },
      weekdayDefaults: Array.from({ length: 7 }, () => ({ on: true, blocks: blocks.map(b => ({ blockId: b, slots: 1, bias: 'auto' })) })),
      dateOverrides: {},
      blocks: blocks.map((id, i) => ({ id, name: bi(id, id), order: i }))
    },
    rules: [
      { id: 'r_max1', type: 'max-per-day', enabled: true, severity: 'hard', weight: 100, scope: { roles: [], tags: [], resources: [] }, params: { n: 1 } },
      { id: 'r_maxconsec', type: 'max-consecutive-days', enabled: true, severity: 'hard', weight: 100, scope: { roles: [], tags: [], resources: [] }, params: { days: 5 } }
    ],
    objectives: [{ id: 'fairness', enabled: true, weight: 80 }],
    engine: { seed: 7, restarts: 8, lnsIterations: 60, timeBudgetMs: 1500, relaxMode: 'relaxed' },
    locks: [], ui: { lang: 'en', view: 'plan' }
  };
}

function onCallModel(start) {
  return {
    schema: SCHEMA_VERSION,
    lexicon: { resource: bi('Officer', 'ضابط'), site: bi('Beat', 'نطاق'), engagement: bi('Shift', 'وردية'), run: bi('Tour', 'جولة') },
    attributes: [],
    roles: [{ id: 'r_oncall', name: bi('On-call', 'استدعاء'), short: 'O', color: '--role-1' }],
    siteClasses: [{ id: 'c_beat', name: bi('Coverage area', 'منطقة التغطية'), planned: true, demand: [{ roleId: 'r_oncall', min: 1, max: 1 }], runLength: 2, cohesion: 'full' }],
    sites: [{ id: 's_beat1', name: bi('Primary coverage', 'التغطية الأساسية'), classId: 'c_beat', tags: [], attrs: {}, weight: 1, active: true, cadence: { minGapDays: 0, targetPerHorizon: null, maxPerHorizon: null } }],
    resources: [
      { id: 'oc_a', name: bi('Officer A', 'الضابط أ'), roles: ['r_oncall'], tags: [], attrs: {}, avail: { weekdays: [1, 1, 1, 1, 1, 1, 1], off: [], only: [], patternId: 'pat_a' }, caps: { maxPerDay: 1, maxPerWeek: null, minRestDays: 0 }, prefs: [], weight: 1, active: true },
      { id: 'oc_b', name: bi('Officer B', 'الضابط ب'), roles: ['r_oncall'], tags: [], attrs: {}, avail: { weekdays: [1, 1, 1, 1, 1, 1, 1], off: [], only: [], patternId: 'pat_b' }, caps: { maxPerDay: 1, maxPerWeek: null, minRestDays: 0 }, prefs: [], weight: 1, active: true }
    ],
    patterns: [
      { id: 'pat_a', cycle: ['on', 'on', 'off', 'off'], anchor: start },
      { id: 'pat_b', cycle: ['on', 'on', 'off', 'off'], anchor: addDaysISO(start, 2) }
    ],
    calendar: {
      horizon: { start, end: addDaysISO(start, 27) },
      weekdayDefaults: Array.from({ length: 7 }, () => ({ on: true, blocks: [{ blockId: 'b_shift', slots: 1, bias: 'auto' }] })),
      dateOverrides: {},
      blocks: [{ id: 'b_shift', name: bi('Shift', 'وردية'), order: 0 }]
    },
    rules: [], objectives: [],
    engine: { seed: 3, restarts: 6, lnsIterations: 40, timeBudgetMs: 1500, relaxMode: 'relaxed' },
    locks: [], ui: { lang: 'en', view: 'plan' }
  };
}

function dutyRotaModel(start) {
  const roleNames = [
    ['r_chair', 'Chair', 'الرئيس'], ['r_sec', 'Secretary', 'أمين السر'], ['r_treas', 'Treasurer', 'أمين الصندوق'],
    ['r_mem1', 'Member', 'عضو'], ['r_mem2', 'Member', 'عضو']
  ];
  const roles = roleNames.map(([id, en, ar]) => ({ id, name: bi(en, ar), short: en[0], color: '--role-1' }));
  const resources = roleNames.map(([roleId, en], i) => ({
    id: `p_${roleId}`, name: bi(en + ' ' + (i + 1), en + ' ' + (i + 1)), roles: [roleId], tags: [], attrs: {},
    avail: { weekdays: [1, 1, 1, 1, 1, 0, 0], off: [], only: [], patternId: null },
    caps: { maxPerDay: 1, maxPerWeek: null, minRestDays: 0 }, prefs: [], weight: 1, active: true
  }));
  const sites = ['Finance Committee', 'Audit Committee', 'Governance Committee'].map((n, i) => ({
    id: `c_site${i}`, name: bi(n, n), classId: 'c_committee', tags: [], attrs: {}, weight: 1, active: true,
    cadence: { minGapDays: 80, targetPerHorizon: null, maxPerHorizon: null }
  }));
  return {
    schema: SCHEMA_VERSION,
    lexicon: { resource: bi('Member', 'عضو'), site: bi('Committee', 'لجنة'), engagement: bi('Session', 'جلسة'), run: bi('Session', 'جلسة') },
    attributes: [],
    roles,
    siteClasses: [{
      id: 'c_committee', name: bi('Committee', 'لجنة'), planned: true,
      demand: [{ roleId: 'r_chair', min: 1, max: 1 }, { roleId: 'r_sec', min: 1, max: 1 }, { roleId: 'r_treas', min: 1, max: 1 }],
      runLength: 1, cohesion: 'full'
    }],
    sites,
    resources,
    patterns: [],
    calendar: {
      horizon: { start, end: addDaysISO(start, 181) },
      weekdayDefaults: Array.from({ length: 7 }, (_, i) => ({ on: i === 3, blocks: i === 3 ? [{ blockId: 'b_meet', slots: 1, bias: 'auto' }] : [] })),
      dateOverrides: {},
      blocks: [{ id: 'b_meet', name: bi('Meeting', 'اجتماع'), order: 0 }]
    },
    rules: [
      { id: 'r_pair', type: 'pairing', enabled: true, severity: 'hard', weight: 100, scope: { roles: [], tags: [], resources: [] }, params: { a: 'p_r_chair', b: 'p_r_sec' } },
      { id: 'r_sep', type: 'separation', enabled: true, severity: 'hard', weight: 100, scope: { roles: [], tags: [], resources: [] }, params: { a: 'p_r_mem1', b: 'p_r_mem2' } }
    ],
    objectives: [{ id: 'fairness', enabled: true, weight: 50 }],
    engine: { seed: 11, restarts: 8, lnsIterations: 60, timeBudgetMs: 1500, relaxMode: 'relaxed' },
    locks: [], ui: { lang: 'en', view: 'plan' }
  };
}

function blankPresetModel(start) {
  return {
    schema: SCHEMA_VERSION,
    lexicon: { resource: bi('Person', 'فرد'), site: bi('Location', 'موقع'), engagement: bi('Visit', 'زيارة'), run: bi('Run', 'سلسلة') },
    attributes: [],
    roles: [{ id: 'r_default', name: bi('Role', 'دور'), short: 'R', color: '--role-1' }],
    siteClasses: [{ id: 'c_default', name: bi('Default', 'افتراضي'), planned: true, demand: [{ roleId: 'r_default', min: 1, max: 1 }], runLength: 1, cohesion: 'full' }],
    sites: [], resources: [], patterns: [],
    calendar: {
      horizon: { start, end: addDaysISO(start, 27) },
      weekdayDefaults: Array.from({ length: 7 }, (_, i) => ({ on: i > 0 && i < 6, blocks: (i > 0 && i < 6) ? [{ blockId: 'b_day', slots: 1, bias: 'auto' }] : [] })),
      dateOverrides: {},
      blocks: [{ id: 'b_day', name: bi('Visit', 'زيارة'), order: 0 }]
    },
    rules: [], objectives: [],
    engine: { seed: 1, restarts: 8, lnsIterations: 60, timeBudgetMs: 1500, relaxMode: 'relaxed' },
    locks: [], ui: { lang: 'en', view: 'plan' }
  };
}

export const PRESETS = [
  {
    id: 'field-visits',
    name: bi('Field visits', 'الزيارات الميدانية'),
    blurb: bi('Two teams visiting main and contracted facilities, one visit a day, no back-to-back days.', 'فريقان يزوران منشآت رئيسية ومتعاقدة، زيارة واحدة يوميًا، بدون أيام متتالية.'),
    build: (start = FALLBACK_TODAY) => migrateV1(fieldVisitsSeed(start))
  },
  {
    id: 'shift-roster',
    name: bi('Shift roster', 'جدول المناوبات'),
    blurb: bi('Round-the-clock hospital-style coverage across three daily shifts.', 'تغطية على مدار الساعة بنمط المستشفى عبر ثلاث ورديات يوميًا.'),
    build: (start = FALLBACK_TODAY) => shiftRosterModel(start)
  },
  {
    id: 'on-call',
    name: bi('On-call rotation', 'مناوبة الاستدعاء'),
    blurb: bi('Two-on, two-off cycle with the same crew covering both days of each tour.', 'دورة يومان عمل ويومان راحة، مع بقاء نفس الفريق طوال الجولة.'),
    build: (start = FALLBACK_TODAY) => onCallModel(start)
  },
  {
    id: 'duty-rota',
    name: bi('Duty rota', 'جدول المناوبة'),
    blurb: bi('Weekly committee sessions with a required pairing, a forced separation, and quarterly per-site spacing.', 'جلسات لجنة أسبوعية مع اقتران مطلوب وفصل إلزامي وتباعد ربع سنوي لكل موقع.'),
    build: (start = FALLBACK_TODAY) => dutyRotaModel(start)
  },
  {
    id: 'blank',
    name: bi('Blank', 'فارغ'),
    blurb: bi('An empty starting point — add your own roles, sites, and people.', 'نقطة بداية فارغة — أضف أدوارك ومواقعك وأفرادك.'),
    build: (start = FALLBACK_TODAY) => blankPresetModel(start)
  }
];

export function findPreset(id) {
  return PRESETS.find(p => p.id === id);
}
