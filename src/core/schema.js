import { RULE_TYPE_LIST } from './rules/registry.js';

export const SCHEMA_VERSION = 2;

export const RULE_TYPE_IDS = RULE_TYPE_LIST;

export const SEVERITIES = ['hard', 'soft', 'off'];

function isBi(v) {
  return v != null && typeof v === 'object' && typeof v.en === 'string';
}

function err(list, cond, msg) {
  if (cond) list.push(msg);
}

export function validateModel(model) {
  const e = [];
  try {
  if (!model || typeof model !== 'object') return ['Model must be an object'];
  for (const key of ['attributes', 'roles', 'siteClasses', 'sites', 'resources', 'patterns', 'rules', 'objectives', 'locks']) {
    if (!Array.isArray(model[key])) e.push(`${key} must be an array`);
  }
  if (e.length) return e;

  err(e, model.schema !== SCHEMA_VERSION, `schema must be ${SCHEMA_VERSION}`);
  err(e, !isBi(model.lexicon?.resource), 'lexicon.resource must be bilingual');
  err(e, !isBi(model.lexicon?.site), 'lexicon.site must be bilingual');
  err(e, !isBi(model.lexicon?.engagement), 'lexicon.engagement must be bilingual');
  err(e, !isBi(model.lexicon?.run), 'lexicon.run must be bilingual');

  err(e, !Array.isArray(model.attributes), 'attributes must be an array');
  const attrIds = new Set();
  for (const a of model.attributes || []) {
    err(e, !a.id, 'attribute missing id');
    err(e, !isBi(a.label), `attribute "${a.id}" missing bilingual label`);
    err(e, !Array.isArray(a.domain) || a.domain.length !== 2, `attribute "${a.id}" domain must be [min,max]`);
    attrIds.add(a.id);
  }

  const blank = Array.isArray(model.roles) && model.roles.length === 0 &&
    Array.isArray(model.siteClasses) && model.siteClasses.length === 0 &&
    Array.isArray(model.sites) && model.sites.length === 0 &&
    Array.isArray(model.resources) && model.resources.length === 0;
  err(e, !Array.isArray(model.roles) || (!blank && model.roles.length === 0), 'roles must be a non-empty array');
  const roleIds = new Set();
  for (const r of model.roles || []) {
    err(e, !r.id, 'role missing id');
    err(e, !isBi(r.name), `role "${r.id}" missing bilingual name`);
    roleIds.add(r.id);
  }
  err(e, roleIds.size !== (model.roles || []).length, 'role ids must be unique');

  err(e, !Array.isArray(model.siteClasses) || (!blank && model.siteClasses.length === 0), 'siteClasses must be a non-empty array');
  const classIds = new Set();
  for (const c of model.siteClasses || []) {
    err(e, !c.id, 'siteClass missing id');
    classIds.add(c.id);
    for (const d of c.demand || []) {
      err(e, !roleIds.has(d.roleId), `siteClass "${c.id}" demand references unknown role "${d.roleId}"`);
      err(e, typeof d.min !== 'number' || d.min < 0, `siteClass "${c.id}" demand.min invalid for role "${d.roleId}"`);
      err(e, typeof d.max !== 'number' || d.max < d.min, `siteClass "${c.id}" demand.max invalid for role "${d.roleId}"`);
    }
  }

  err(e, !Array.isArray(model.sites), 'sites must be an array');
  const siteIds = new Set();
  for (const s of model.sites || []) {
    err(e, !s.id, 'site missing id');
    err(e, siteIds.has(s.id), `duplicate site id "${s.id}"`);
    siteIds.add(s.id);
    err(e, !classIds.has(s.classId), `site "${s.id}" references unknown siteClass "${s.classId}"`);
    for (const k of Object.keys(s.attrs || {})) {
      err(e, !attrIds.has(k), `site "${s.id}" references unknown attribute "${k}"`);
    }
  }

  err(e, !Array.isArray(model.resources), 'resources must be an array');
  const resourceIds = new Set();
  for (const r of model.resources || []) {
    err(e, !r.id, 'resource missing id');
    err(e, resourceIds.has(r.id), `duplicate resource id "${r.id}"`);
    resourceIds.add(r.id);
    err(e, !Array.isArray(r.roles) || r.roles.length === 0, `resource "${r.id}" must have at least one role`);
    for (const rid of r.roles || []) err(e, !roleIds.has(rid), `resource "${r.id}" references unknown role "${rid}"`);
    err(e, !Array.isArray(r.avail?.weekdays) || r.avail.weekdays.length !== 7, `resource "${r.id}" avail.weekdays must have 7 entries`);
    for (const k of Object.keys(r.attrs || {})) {
      err(e, !attrIds.has(k), `resource "${r.id}" references unknown attribute "${k}"`);
    }
  }

  err(e, !Array.isArray(model.patterns), 'patterns must be an array');
  const patternIds = new Set((model.patterns || []).map(p => p.id));

  err(e, !model.calendar || typeof model.calendar !== 'object', 'calendar must be an object');
  if (model.calendar) {
    err(e, !blank && (!model.calendar.horizon?.start || !model.calendar.horizon?.end), 'calendar.horizon needs start and end');
    err(e, !Array.isArray(model.calendar.weekdayDefaults) || model.calendar.weekdayDefaults.length !== 7,
      'calendar.weekdayDefaults must have 7 entries');
    err(e, !Array.isArray(model.calendar.blocks) || model.calendar.blocks.length === 0, 'calendar.blocks must be non-empty');
  }
  for (const r of model.resources || []) {
    if (r.avail?.patternId) err(e, !patternIds.has(r.avail.patternId), `resource "${r.id}" references unknown pattern "${r.avail.patternId}"`);
  }

  err(e, !Array.isArray(model.rules), 'rules must be an array');
  const ruleIds = new Set();
  for (const r of model.rules || []) {
    err(e, !r.id, 'rule missing id');
    ruleIds.add(r.id);
    err(e, !RULE_TYPE_IDS.includes(r.type), `rule "${r.id}" has unknown type "${r.type}"`);
    err(e, !SEVERITIES.includes(r.severity), `rule "${r.id}" has invalid severity "${r.severity}"`);
    err(e, typeof r.weight !== 'number', `rule "${r.id}" weight must be a number`);
  }
  err(e, ruleIds.size !== (model.rules || []).length, 'rule ids must be unique');

  err(e, !Array.isArray(model.objectives), 'objectives must be an array');
  err(e, !model.engine || typeof model.engine.seed !== 'number', 'engine.seed must be a number');
  err(e, !Array.isArray(model.locks), 'locks must be an array');
  err(e, !model.ui || typeof model.ui !== 'object', 'ui must be an object');

  return e;
  } catch (error) {
    return [...e, 'Invalid model structure: ' + error.message];
  }
}

export function isValid(model) {
  return validateModel(model).length === 0;
}
