import { bi } from '../bi.js';

function inScope(scope, resource) {
  if (!scope) return true;
  const { roles, tags, resources } = scope;
  if (resources && resources.length && !resources.includes(resource.id)) return false;
  if (roles && roles.length && !resource.roles.some(r => roles.includes(r))) return false;
  if (tags && tags.length && !resource.tags?.some(t => tags.includes(t))) return false;
  return true;
}

function streakLength(ctx, resourceId, date) {
  let back = 0;
  let d = date;
  while (ctx.hasDuty(resourceId, ctx.dates.addISO(d, -1))) { back++; d = ctx.dates.addISO(d, -1); }
  let fwd = 0;
  d = date;
  while (ctx.hasDuty(resourceId, ctx.dates.addISO(d, 1))) { fwd++; d = ctx.dates.addISO(d, 1); }
  return back + fwd + 1;
}

export const RULE_TYPES = {
  'max-per-day': {
    label: bi('Maximum per day', 'الحد الأقصى في اليوم'),
    appliesTo: 'resource',
    params: [{ key: 'n', type: 'int', min: 1, max: 10, def: 1 }],
    feasible(ctx, cand) {
      if (!inScope(ctx.rule.scope, cand.resource)) return true;
      return ctx.countOnDate(cand.resourceId, cand.date, cand.runId) < ctx.rule.params.n;
    },
    audit(ctx) {
      const out = [];
      for (const [resourceId, byDate] of ctx.assignmentsByResourceDate()) {
        for (const [date, runIds] of byDate) {
          if (runIds.size > ctx.rule.params.n) {
            out.push({ code: 'max-per-day', severity: ctx.rule.severity, msg: bi('Too many duties in one day', 'مهام كثيرة في يوم واحد'), refs: { resourceId, date } });
          }
        }
      }
      return out;
    }
  },

  'max-per-window': {
    label: bi('Maximum per rolling window', 'الحد الأقصى في نافذة متحركة'),
    appliesTo: 'resource',
    params: [{ key: 'n', type: 'int', min: 1, max: 30, def: 5 }, { key: 'windowDays', type: 'int', min: 1, max: 90, def: 7 }],
    feasible(ctx, cand) {
      if (!inScope(ctx.rule.scope, cand.resource)) return true;
      const { n, windowDays } = ctx.rule.params;
      return ctx.countInWindow(cand.resourceId, cand.date, windowDays) < n;
    },
    audit(ctx) {
      const out = [];
      const { n, windowDays } = ctx.rule.params;
      for (const [resourceId, dates] of ctx.assignmentDatesByResource()) {
        for (const date of dates) {
          const c = ctx.countInWindow(resourceId, date, windowDays);
          if (c > n) {
            out.push({ code: 'max-per-window', severity: ctx.rule.severity, msg: bi('Too many duties in the window', 'مهام كثيرة في النافذة الزمنية'), refs: { resourceId, date, count: c } });
            break;
          }
        }
      }
      return out;
    }
  },

  'min-rest-days': {
    label: bi('Minimum rest between duties', 'حد أدنى للراحة بين المهام'),
    appliesTo: 'resource',
    params: [{ key: 'days', type: 'int', min: 0, max: 30, def: 1 }],
    feasible(ctx, cand) {
      if (!inScope(ctx.rule.scope, cand.resource)) return true;
      const last = ctx.lastDutyBefore(cand.resourceId, cand.date, cand.runId);
      const next = ctx.nextDutyAfter(cand.resourceId, cand.date, cand.runId);
      const g = ctx.rule.params.days;
      return (!last || ctx.dates.dayGap(last, cand.date) > g)
        && (!next || ctx.dates.dayGap(cand.date, next) > g);
    },
    audit(ctx) {
      const out = [];
      for (const [resourceId, dates] of ctx.assignmentDatesByResource()) {
        for (let i = 1; i < dates.length; i++) {
          if (ctx.dates.dayGap(dates[i - 1], dates[i]) <= ctx.rule.params.days) {
            out.push({ code: 'min-rest-days', severity: ctx.rule.severity, msg: bi('Insufficient rest', 'راحة غير كافية'), refs: { resourceId, dates: [dates[i - 1], dates[i]] } });
          }
        }
      }
      return out;
    }
  },

  'max-consecutive-days': {
    label: bi('Maximum consecutive days', 'الحد الأقصى للأيام المتتالية'),
    appliesTo: 'resource',
    params: [{ key: 'days', type: 'int', min: 1, max: 30, def: 5 }],
    feasible(ctx, cand) {
      if (!inScope(ctx.rule.scope, cand.resource)) return true;
      return streakLength(ctx, cand.resourceId, cand.date) <= ctx.rule.params.days;
    },
    audit(ctx) {
      const out = [];
      for (const [resourceId, dates] of ctx.assignmentDatesByResource()) {
        let run = 1;
        for (let i = 1; i < dates.length; i++) {
          run = ctx.dates.dayGap(dates[i - 1], dates[i]) === 1 ? run + 1 : 1;
          if (run > ctx.rule.params.days) {
            out.push({ code: 'max-consecutive-days', severity: ctx.rule.severity, msg: bi('Too many consecutive days', 'أيام متتالية كثيرة'), refs: { resourceId, date: dates[i] } });
          }
        }
      }
      return out;
    }
  },

  'min-consecutive-days': {
    label: bi('Minimum consecutive days (forces runs)', 'حد أدنى للأيام المتتالية'),
    appliesTo: 'resource',
    params: [{ key: 'days', type: 'int', min: 1, max: 14, def: 2 }],
    feasible() { return true; },
    audit(ctx) {
      const out = [];
      for (const [resourceId, dates] of ctx.assignmentDatesByResource()) {
        let i = 0;
        while (i < dates.length) {
          let j = i;
          while (j + 1 < dates.length && ctx.dates.dayGap(dates[j], dates[j + 1]) === 1) j++;
          const len = j - i + 1;
          if (len < ctx.rule.params.days) {
            out.push({ code: 'min-consecutive-days', severity: ctx.rule.severity, msg: bi('Run shorter than required', 'سلسلة أقصر من المطلوب'), refs: { resourceId, date: dates[i] } });
          }
          i = j + 1;
        }
      }
      return out;
    }
  },

  'weekday-limit': {
    label: bi('Weekday limit', 'حد أيام الأسبوع'),
    appliesTo: 'resource',
    params: [{ key: 'weekday', type: 'int', min: 0, max: 6, def: 5 }, { key: 'max', type: 'int', min: 0, max: 20, def: 0 }],
    feasible(ctx, cand) {
      if (!inScope(ctx.rule.scope, cand.resource)) return true;
      if (ctx.dates.dowOf(cand.date) !== ctx.rule.params.weekday) return true;
      return ctx.countOnWeekday(cand.resourceId, ctx.rule.params.weekday) < ctx.rule.params.max;
    },
    audit(ctx) {
      const out = [];
      const { weekday, max } = ctx.rule.params;
      for (const [resourceId] of ctx.assignmentDatesByResource()) {
        const c = ctx.countOnWeekday(resourceId, weekday);
        if (c > max) {
          out.push({ code: 'weekday-limit', severity: ctx.rule.severity, msg: bi('Weekday limit exceeded', 'تجاوز حد يوم الأسبوع'), refs: { resourceId, weekday, count: c } });
        }
      }
      return out;
    }
  },

  'unavailable-dates': {
    label: bi('Unavailable dates', 'تواريخ غير متاحة'),
    appliesTo: 'resource',
    params: [{ key: 'dates', type: 'dateList', def: [] }],
    feasible(ctx, cand) {
      if (!inScope(ctx.rule.scope, cand.resource)) return true;
      return !ctx.rule.params.dates.includes(cand.date);
    },
    audit(ctx) {
      const out = [];
      for (const [resourceId, dates] of ctx.assignmentDatesByResource()) {
        for (const d of dates) {
          if (ctx.rule.params.dates.includes(d)) {
            out.push({ code: 'unavailable-dates', severity: ctx.rule.severity, msg: bi('Assigned on an unavailable date', 'تم التكليف في تاريخ غير متاح'), refs: { resourceId, date: d } });
          }
        }
      }
      return out;
    }
  },

  'role-qualification': {
    label: bi('Role qualification', 'التأهيل للدور'),
    appliesTo: 'resource',
    params: [{ key: 'roleId', type: 'role', def: null }],
    feasible(ctx, cand) {
      return !ctx.rule.params.roleId || cand.resource.roles.includes(ctx.rule.params.roleId);
    },
    audit(ctx) {
      const out = [];
      if (!ctx.rule.params.roleId) return out;
      for (const rec of ctx.assignments.values()) {
        const resource = ctx.resourceOf(rec.resourceId);
        if (!resource.roles.includes(ctx.rule.params.roleId)) {
          out.push({ code: 'role-qualification', severity: ctx.rule.severity, msg: bi('Resource lacks required role', 'المورد لا يملك الدور المطلوب'), refs: { resourceId: rec.resourceId, needId: rec.id } });
        }
      }
      return out;
    }
  },

  'pairing': {
    label: bi('Pairing (A with B)', 'اقتران (أ مع ب)'),
    appliesTo: 'resource',
    params: [{ key: 'a', type: 'resource', def: null }, { key: 'b', type: 'resource', def: null }],
    feasible() { return true; },
    audit(ctx) {
      const { a, b } = ctx.rule.params;
      const out = [];
      if (!a || !b) return out;
      for (const [runId, dateSets] of ctx.crewsByRun()) {
        for (const [date, resourceIds] of dateSets) {
          const hasA = resourceIds.has(a), hasB = resourceIds.has(b);
          if (hasA !== hasB) {
            out.push({ code: 'pairing', severity: ctx.rule.severity, msg: bi('Pairing broken', 'الاقتران غير مكتمل'), refs: { runId, date, resourceIds: [a, b] } });
          }
        }
      }
      return out;
    }
  },

  'separation': {
    label: bi('Separation (A never with B)', 'فصل (أ لا يجتمع مع ب)'),
    appliesTo: 'resource',
    params: [{ key: 'a', type: 'resource', def: null }, { key: 'b', type: 'resource', def: null }],
    feasible(ctx, cand) {
      const { a, b } = ctx.rule.params;
      if (!a || !b) return true;
      const other = cand.resourceId === a ? b : (cand.resourceId === b ? a : null);
      if (!other) return true;
      return !ctx.crewHas(cand.runId, cand.date, other);
    },
    audit(ctx) {
      const { a, b } = ctx.rule.params;
      const out = [];
      if (!a || !b) return out;
      for (const [runId, dateSets] of ctx.crewsByRun()) {
        for (const [date, resourceIds] of dateSets) {
          if (resourceIds.has(a) && resourceIds.has(b)) {
            out.push({ code: 'separation', severity: ctx.rule.severity, msg: bi('Separation violated', 'تم خرق قاعدة الفصل'), refs: { runId, date, resourceIds: [a, b] } });
          }
        }
      }
      return out;
    }
  },

  'cap-by-tag': {
    label: bi('Cap by tag', 'حد بحسب الوسم'),
    appliesTo: 'resource',
    params: [{ key: 'tag', type: 'string', def: '' }, { key: 'n', type: 'int', min: 1, max: 50, def: 1 }],
    feasible(ctx, cand) {
      if (!cand.resource.tags?.includes(ctx.rule.params.tag)) return true;
      return ctx.countTagOnDate(ctx.rule.params.tag, cand.date, cand.runId) < ctx.rule.params.n;
    },
    audit(ctx) {
      const out = [];
      for (const key of ctx.tagDateCount.keys()) {
        const sep = key.indexOf('|');
        const tag = key.slice(0, sep);
        const date = key.slice(sep + 1);
        if (tag !== ctx.rule.params.tag) continue;
        const c = ctx.tagDateCount.get(key);
        if (c > ctx.rule.params.n) {
          out.push({ code: 'cap-by-tag', severity: ctx.rule.severity, msg: bi('Too many with this tag in one day', 'عدد كبير من هذا الوسم في يوم واحد'), refs: { tag, date, count: c } });
        }
      }
      return out;
    }
  },

  'distinct-sites-per-day': {
    label: bi('Distinct sites per day', 'مواقع مختلفة في اليوم'),
    appliesTo: 'resource',
    params: [],
    feasible(ctx, cand) {
      return !ctx.resourceHasOtherSiteOnDate(cand.resourceId, cand.date, cand.siteId, cand.runId);
    },
    audit(ctx) {
      const out = [];
      for (const [resourceId, byDate] of ctx.assignmentsByResourceDate()) {
        for (const [date, runIds] of byDate) {
          const siteSet = new Set([...runIds].map(rid => ctx.runById.get(rid).siteId));
          if (siteSet.size > 1) {
            out.push({ code: 'distinct-sites-per-day', severity: ctx.rule.severity, msg: bi('Sent to more than one site in a day', 'تم إرساله لأكثر من موقع في يوم واحد'), refs: { resourceId, date } });
          }
        }
      }
      return out;
    }
  },

  'site-min-gap': {
    label: bi('Minimum gap between site visits', 'حد أدنى بين زيارات الموقع'),
    appliesTo: 'site',
    params: [{ key: 'days', type: 'int', min: 0, max: 90, def: 1 }],
    feasible() { return true; },
    audit(ctx) {
      const out = [];
      for (const [siteId, dates] of ctx.visitDatesBySite()) {
        for (let i = 1; i < dates.length; i++) {
          if (ctx.dates.dayGap(dates[i - 1], dates[i]) < ctx.rule.params.days) {
            out.push({ code: 'site-min-gap', severity: ctx.rule.severity, msg: bi('Site visited too soon again', 'تمت زيارة الموقع مبكرًا مرة أخرى'), refs: { siteId, dates: [dates[i - 1], dates[i]] } });
          }
        }
      }
      return out;
    }
  },

  'site-target-count': {
    label: bi('Site target visit count', 'عدد الزيارات المستهدف للموقع'),
    appliesTo: 'site',
    params: [{ key: 'count', type: 'int', min: 0, max: 365, def: 1 }],
    feasible() { return true; },
    audit(ctx) {
      const out = [];
      for (const [siteId, dates] of ctx.visitDatesBySite()) {
        if (dates.length !== ctx.rule.params.count) {
          out.push({ code: 'site-target-count', severity: ctx.rule.severity, msg: bi('Site visit count off target', 'عدد الزيارات مخالف للمستهدف'), refs: { siteId, count: dates.length } });
        }
      }
      return out;
    }
  },

  'site-required-tag': {
    label: bi('Site requires resource tag', 'الموقع يتطلب وسم مورد'),
    appliesTo: 'site',
    params: [{ key: 'tag', type: 'string', def: '' }],
    feasible(ctx, cand) {
      const site = ctx.siteOf(cand.siteId);
      if (!site.tags?.includes(ctx.rule.params.tag)) return true;
      return !!cand.resource.tags?.includes(ctx.rule.params.tag);
    },
    audit(ctx) {
      const out = [];
      for (const run of ctx.runs) {
        const site = ctx.siteOf(run.siteId);
        if (!site.tags?.includes(ctx.rule.params.tag)) continue;
        for (const resourceId of ctx.crewSetOfRun(run.id)) {
          const resource = ctx.resourceOf(resourceId);
          if (!resource.tags?.includes(ctx.rule.params.tag)) {
            out.push({ code: 'site-required-tag', severity: ctx.rule.severity, msg: bi('Resource missing the site-required tag', 'المورد يفتقد الوسم المطلوب للموقع'), refs: { siteId: site.id, resourceId } });
          }
        }
      }
      return out;
    }
  },

  'coverage-all-active': {
    label: bi('Coverage of all active sites', 'تغطية كل المواقع النشطة'),
    appliesTo: 'site',
    params: [],
    feasible() { return true; },
    audit(ctx) {
      const out = [];
      const visited = new Set([...ctx.visitDatesBySite().keys()]);
      for (const site of ctx.model.sites) {
        const cls = ctx.model.siteClasses.find(c => c.id === site.classId);
        if (site.active && cls?.planned && !visited.has(site.id)) {
          out.push({ code: 'coverage-all-active', severity: ctx.rule.severity, msg: bi('Active site never visited', 'موقع نشط لم تتم زيارته'), refs: { siteId: site.id } });
        }
      }
      return out;
    }
  },

  'crew-cohesion': {
    label: bi('Crew cohesion', 'تماسك الفريق'),
    appliesTo: 'crew',
    params: [{ key: 'windowDays', type: 'int', min: 1, max: 90, def: 7 }],
    feasible() { return true; },
    audit(ctx) {
      const out = [];
      for (const [siteId, runsForSite] of ctx.runsBySite()) {
        for (let i = 1; i < runsForSite.length; i++) {
          const gap = ctx.dates.dayGap(runsForSite[i - 1].startDate, runsForSite[i].startDate);
          if (gap <= ctx.rule.params.windowDays) {
            const setA = ctx.crewSetOfRun(runsForSite[i - 1].id);
            const setB = ctx.crewSetOfRun(runsForSite[i].id);
            const same = setA.size === setB.size && [...setA].every(x => setB.has(x));
            if (!same) {
              out.push({ code: 'crew-cohesion', severity: ctx.rule.severity, msg: bi('Crew changed within cohesion window', 'تغيّر الفريق خلال نافذة التماسك'), refs: { siteId, runIds: [runsForSite[i - 1].id, runsForSite[i].id] } });
            }
          }
        }
      }
      return out;
    }
  },

  'crew-rotation': {
    label: bi('Crew rotation (no repeat crew)', 'تدوير الفريق'),
    appliesTo: 'crew',
    params: [{ key: 'days', type: 'int', min: 1, max: 90, def: 14 }],
    feasible() { return true; },
    audit(ctx) {
      const out = [];
      for (const [siteId, runsForSite] of ctx.runsBySite()) {
        for (let i = 1; i < runsForSite.length; i++) {
          const gap = ctx.dates.dayGap(runsForSite[i - 1].startDate, runsForSite[i].startDate);
          if (gap > ctx.rule.params.days) continue;
          const setA = ctx.crewSetOfRun(runsForSite[i - 1].id);
          const setB = ctx.crewSetOfRun(runsForSite[i].id);
          const same = setA.size === setB.size && [...setA].every(x => setB.has(x));
          if (same) {
            out.push({ code: 'crew-rotation', severity: ctx.rule.severity, msg: bi('Identical crew repeated too soon', 'تكرار نفس الفريق مبكرًا'), refs: { siteId, runIds: [runsForSite[i - 1].id, runsForSite[i].id] } });
          }
        }
      }
      return out;
    }
  },

  'crew-size-bounds': {
    label: bi('Crew size bounds', 'حدود حجم الفريق'),
    appliesTo: 'crew',
    params: [{ key: 'min', type: 'int', min: 0, max: 50, def: 1 }, { key: 'max', type: 'int', min: 0, max: 50, def: 6 }],
    feasible() { return true; },
    audit(ctx) {
      const out = [];
      for (const run of ctx.model_runs()) {
        const size = ctx.crewSetOfRun(run.id).size;
        if (size < ctx.rule.params.min || size > ctx.rule.params.max) {
          out.push({ code: 'crew-size-bounds', severity: ctx.rule.severity, msg: bi('Crew size out of bounds', 'حجم الفريق خارج الحدود'), refs: { runId: run.id, size } });
        }
      }
      return out;
    }
  },

  'attribute-window': {
    label: bi('Attribute window per day', 'نافذة السمة في اليوم'),
    appliesTo: 'attribute',
    params: [{ key: 'attr', type: 'attribute', def: 'km' }, { key: 'maxSpread', type: 'number', min: 0, def: 20 }],
    feasible() { return true; },
    audit(ctx) {
      const out = [];
      const attr = ctx.rule.params.attr;
      for (const [date, siteIds] of ctx.siteIdsByDate()) {
        const vals = [...siteIds].map(id => ctx.siteOf(id).attrs?.[attr] ?? 0);
        if (!vals.length) continue;
        const spread = Math.max(...vals) - Math.min(...vals);
        if (spread > ctx.rule.params.maxSpread) {
          out.push({ code: 'attribute-window', severity: ctx.rule.severity, msg: bi('Sites too spread out this day', 'مواقع متباعدة جدًا في هذا اليوم'), refs: { date, spread } });
        }
      }
      return out;
    }
  },

  'attribute-cap': {
    label: bi('Attribute cap per resource per day', 'حد السمة لكل مورد في اليوم'),
    appliesTo: 'attribute',
    params: [{ key: 'attr', type: 'attribute', def: 'km' }, { key: 'max', type: 'number', min: 0, def: 100 }],
    feasible(ctx, cand) {
      const attr = ctx.rule.params.attr;
      const site = ctx.siteOf(cand.siteId);
      const add = site.attrs?.[attr] ?? 0;
      const soFar = ctx.attrSumOnDate(cand.resourceId, cand.date, attr, cand.runId);
      return soFar + add <= ctx.rule.params.max;
    },
    audit(ctx) {
      const out = [];
      const attr = ctx.rule.params.attr;
      for (const key of ctx.attrSum.keys()) {
        const parts = key.split('|');
        const a = parts[2];
        if (a !== attr) continue;
        const v = ctx.attrSum.get(key);
        if (v > ctx.rule.params.max) {
          out.push({ code: 'attribute-cap', severity: ctx.rule.severity, msg: bi('Attribute cap exceeded for the day', 'تجاوز حد السمة لهذا اليوم'), refs: { resourceId: parts[0], date: parts[1], value: v } });
        }
      }
      return out;
    }
  },

  'attribute-affinity': {
    label: bi('Attribute affinity (soft preference)', 'ميل السمة (تفضيل مرن)'),
    appliesTo: 'attribute',
    params: [{ key: 'attr', type: 'attribute', def: 'km' }],
    feasible() { return true; },
    cost(ctx, cand) {
      const pref = cand.resource.prefs?.find(p => p.attr === ctx.rule.params.attr);
      if (!pref) return 0;
      const site = ctx.siteOf(cand.siteId);
      const v = site.attrs?.[pref.attr] ?? 0;
      const origin = cand.resource.attrs?.[pref.attr] ?? 0;
      const distFromOrigin = Math.abs(v - origin);
      const raw = pref.dir === 'low' ? v : (pref.dir === 'high' ? -v : distFromOrigin);
      return raw * (pref.strength ?? 1) * (ctx.rule.weight / 100);
    },
    audit(ctx) {
      const out = [];
      const attr = ctx.rule.params.attr;
      for (const rec of ctx.assignments.values()) {
        const resource = ctx.resourceOf(rec.resourceId);
        const pref = resource.prefs?.find(p => p.attr === attr);
        if (!pref || !pref.dir) continue;
        const run = ctx.runById.get(rec.runId);
        const site = ctx.siteOf(run.siteId);
        const v = site.attrs?.[attr] ?? 0;
        const origin = resource.attrs?.[attr] ?? 0;
        const bad = pref.dir === 'low' ? v > origin : (pref.dir === 'high' ? v < origin : false);
        if (bad) {
          out.push({ code: 'attribute-affinity', severity: ctx.rule.severity, msg: bi('Assignment goes against stated preference', 'التكليف يخالف التفضيل المعلن'), refs: { resourceId: rec.resourceId, runId: rec.runId, value: v } });
        }
      }
      return out;
    }
  }
};

export const RULE_TYPE_LIST = Object.keys(RULE_TYPES);

export function ruleType(id) {
  return RULE_TYPES[id];
}
