import * as datesMod from '../dates.js';

function sortedInsert(arr, date) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < date) lo = mid + 1; else hi = mid;
  }
  if (arr[lo] !== date) arr.splice(lo, 0, date);
}

function sortedRemove(arr, date) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < date) lo = mid + 1; else hi = mid;
  }
  if (arr[lo] === date) arr.splice(lo, 1);
}

export class ScheduleState {
  constructor(model, runs) {
    this.model = model;
    this.runs = runs;
    this.runById = new Map(runs.map(r => [r.id, r]));
    this.siteById = new Map(model.sites.map(s => [s.id, s]));
    this.resourceById = new Map(model.resources.map(r => [r.id, r]));
    this.dates = datesMod;

    this.assignments = new Map();
    this.byResourceDate = new Map();
    this.sortedDates = new Map();
    this.tagDateCount = new Map();
    this.attrSum = new Map();
    this.runResources = new Map();
  }

  siteOf(id) { return this.siteById.get(id); }
  resourceOf(id) { return this.resourceById.get(id); }
  model_runs() { return this.runs; }

  _resDates(resourceId) {
    let m = this.byResourceDate.get(resourceId);
    if (!m) { m = new Map(); this.byResourceDate.set(resourceId, m); }
    return m;
  }

  _resSorted(resourceId) {
    let a = this.sortedDates.get(resourceId);
    if (!a) { a = []; this.sortedDates.set(resourceId, a); }
    return a;
  }

  assign(need, resourceId, bent = null) {
    const run = this.runById.get(need.runId);
    this.assignments.set(need.id, { ...need, resourceId, bent });
    let rs = this.runResources.get(need.runId);
    if (!rs) { rs = new Set(); this.runResources.set(need.runId, rs); }
    rs.add(resourceId);

    const resource = this.resourceOf(resourceId);
    const site = this.siteOf(run.siteId);
    const dateMap = this._resDates(resourceId);
    const sorted = this._resSorted(resourceId);
    const tags = resource.tags || [];
    const attrKeys = Object.keys(site.attrs || {});

    for (const date of run.dates) {
      let set = dateMap.get(date);
      if (!set) {
        set = new Set();
        dateMap.set(date, set);
        sortedInsert(sorted, date);
      }
      set.add(need.runId);

      for (const tag of tags) {
        const key = `${tag}|${date}`;
        this.tagDateCount.set(key, (this.tagDateCount.get(key) || 0) + 1);
      }
      for (const attr of attrKeys) {
        const key = `${resourceId}|${date}|${attr}`;
        this.attrSum.set(key, (this.attrSum.get(key) || 0) + site.attrs[attr]);
      }
    }
  }

  unassign(needId) {
    const rec = this.assignments.get(needId);
    if (!rec) return;
    const run = this.runById.get(rec.runId);
    const resource = this.resourceOf(rec.resourceId);
    const site = this.siteOf(run.siteId);
    const dateMap = this._resDates(rec.resourceId);
    const sorted = this._resSorted(rec.resourceId);
    const tags = resource.tags || [];
    const attrKeys = Object.keys(site.attrs || {});

    for (const date of run.dates) {
      const set = dateMap.get(date);
      if (set) {
        set.delete(rec.runId);
        if (set.size === 0) {
          dateMap.delete(date);
          sortedRemove(sorted, date);
        }
      }
      for (const tag of tags) {
        const key = `${tag}|${date}`;
        this.tagDateCount.set(key, Math.max(0, (this.tagDateCount.get(key) || 0) - 1));
      }
      for (const attr of attrKeys) {
        const key = `${rec.resourceId}|${date}|${attr}`;
        this.attrSum.set(key, Math.max(0, (this.attrSum.get(key) || 0) - site.attrs[attr]));
      }
    }
    const rs = this.runResources.get(rec.runId);
    if (rs) rs.delete(rec.resourceId);
    this.assignments.delete(needId);
  }

  hasDuty(resourceId, date) {
    return (this.byResourceDate.get(resourceId)?.get(date)?.size || 0) > 0;
  }

  countOnDate(resourceId, date) {
    return this.byResourceDate.get(resourceId)?.get(date)?.size || 0;
  }

  countInWindow(resourceId, date, windowDays) {
    const dm = this.byResourceDate.get(resourceId);
    if (!dm || !dm.size) return 0;
    let n = 0;
    let d = date;
    for (let i = 0; i < windowDays; i++) {
      if ((dm.get(d)?.size || 0) > 0) n++;
      d = datesMod.addISO(d, -1);
    }
    return n;
  }

  sortedDutyDates(resourceId) {
    return this.sortedDates.get(resourceId) || [];
  }

  lastDutyBefore(resourceId, date) {
    const arr = this.sortedDutyDates(resourceId);
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i] < date) return arr[i];
    }
    return null;
  }

  nextDutyAfter(resourceId, date) {
    const arr = this.sortedDutyDates(resourceId);
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] > date) return arr[i];
    }
    return null;
  }

  countOnWeekday(resourceId, weekday) {
    const arr = this.sortedDutyDates(resourceId);
    let n = 0;
    for (const d of arr) if (datesMod.dowOf(d) === weekday) n++;
    return n;
  }

  countTagOnDate(tag, date) {
    return this.tagDateCount.get(`${tag}|${date}`) || 0;
  }

  resourceHasOtherSiteOnDate(resourceId, date, siteId) {
    const runIds = this.byResourceDate.get(resourceId)?.get(date);
    if (!runIds) return false;
    for (const rid of runIds) {
      if (this.runById.get(rid).siteId !== siteId) return true;
    }
    return false;
  }

  attrSumOnDate(resourceId, date, attr) {
    return this.attrSum.get(`${resourceId}|${date}|${attr}`) || 0;
  }

  crewSetOfRun(runId) {
    return this.runResources.get(runId) || new Set();
  }

  crewHas(runId, date, resourceId) {
    return this.crewSetOfRun(runId).has(resourceId);
  }

  assignmentsByResourceDate() {
    return this.byResourceDate.entries();
  }

  assignmentDatesByResource() {
    const out = [];
    for (const resourceId of this.byResourceDate.keys()) out.push([resourceId, this.sortedDutyDates(resourceId)]);
    return out;
  }

  visitDatesBySite() {
    const m = new Map();
    for (const run of this.runs) {
      if (!this.runResources.get(run.id)?.size) continue;
      if (!m.has(run.siteId)) m.set(run.siteId, []);
      m.get(run.siteId).push(...run.dates);
    }
    for (const v of m.values()) v.sort();
    return m;
  }

  siteIdsByDate() {
    const m = new Map();
    for (const run of this.runs) {
      if (!this.runResources.get(run.id)?.size) continue;
      for (const date of run.dates) {
        if (!m.has(date)) m.set(date, new Set());
        m.get(date).add(run.siteId);
      }
    }
    return m;
  }

  runsBySite() {
    const m = new Map();
    for (const run of this.runs) {
      if (!this.runResources.get(run.id)?.size) continue;
      if (!m.has(run.siteId)) m.set(run.siteId, []);
      m.get(run.siteId).push(run);
    }
    for (const v of m.values()) v.sort((a, b) => a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0);
    return m;
  }

  crewsByRun() {
    const m = new Map();
    for (const run of this.runs) {
      const set = this.crewSetOfRun(run.id);
      if (!set.size) continue;
      const byDate = new Map();
      for (const date of run.dates) byDate.set(date, set);
      m.set(run.id, byDate);
    }
    return m;
  }
}
