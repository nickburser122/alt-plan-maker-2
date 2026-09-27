import { allNeeds, flattenEngagements } from '../runs.js';
import { candidateCost } from './score.js';
import { ruleType } from '../rules/registry.js';
import { ScheduleState } from './state.js';
import { rngStream } from '../rng.js';
import { buildCandidateIndex, candidatesFor } from './candidates.js';

const TOP_K = 3;

export function hardRulesOk(ctx, model, run, resource, exceptRuleId = null) {
  for (const rule of model.rules || []) {
    if (!rule.enabled || rule.severity !== 'hard' || rule.id === exceptRuleId) continue;
    const type = ruleType(rule.type);
    if (!type) continue;
    ctx.rule = rule;
    for (const date of run.dates) {
      const cand = { resourceId: resource.id, resource, runId: run.id, siteId: run.siteId, date };
      if (!type.feasible(ctx, cand)) return { ok: false, ruleId: rule.id };
    }
  }
  return { ok: true, ruleId: null };
}

function needComparator(runById) {
  return (a, b) => {
    const ra = runById.get(a.runId), rb = runById.get(b.runId);
    if (ra.startDate !== rb.startDate) return ra.startDate < rb.startDate ? -1 : 1;
    if (ra.siteId !== rb.siteId) return ra.siteId.localeCompare(rb.siteId);
    if (a.roleId !== b.roleId) return a.roleId.localeCompare(b.roleId);
    return a.unitIndex - b.unitIndex;
  };
}

export function resolveLocks(model, runs) {
  const engagementById = new Map(flattenEngagements(runs).map(e => [e.id, e]));
  const forced = new Map();
  for (const lock of model.locks || []) {
    const eng = engagementById.get(lock.engagementId);
    if (!eng) continue;
    const needId = `${eng.runId}:${lock.roleId}:${lock.slotIndex}`;
    forced.set(needId, lock.resourceId);
  }
  return forced;
}

export function construct(model, runs, { seed, restartIdx = 0 } = {}, candidateIndex = null) {
  const ctx = new ScheduleState(model, runs);
  const index = candidateIndex || buildCandidateIndex(model, runs);
  const rng = rngStream(seed ?? model.engine.seed, restartIdx);

  const needs = allNeeds(runs);
  const needById = new Map(needs.map(n => [n.id, n]));
  const runById = ctx.runById;
  const locks = resolveLocks(model, runs);

  const openSlots = [];
  const lockedNeedIds = new Set();

  for (const [needId, resourceId] of locks) {
    const need = needById.get(needId);
    if (!need) continue;
    const resource = ctx.resourceOf(resourceId);
    if (!resource || !resource.active || !resource.roles.includes(need.roleId)) continue;
    if (ctx.crewSetOfRun(need.runId).has(resourceId)) continue;
    ctx.assign(need, resourceId);
    lockedNeedIds.add(needId);
  }

  const remaining = needs
    .filter(n => !lockedNeedIds.has(n.id))
    .map(n => ({ need: n, scarcity: candidatesFor(index, runById.get(n.runId), n.roleId).length }));

  remaining.sort((a, b) => (a.scarcity - b.scarcity) || needComparator(runById)(a.need, b.need));

  for (const { need } of remaining) {
    const run = runById.get(need.runId);
    const structural = candidatesFor(index, run, need.roleId);
    const feasible = structural.filter(r => hardRulesOk(ctx, model, run, r).ok);

    if (feasible.length > 0) {
      const scored = feasible.map(r => ({ r, cost: candidateCost(ctx, model, { resourceId: r.id, resource: r, runId: run.id, siteId: run.siteId }) }));
      scored.sort((a, b) => (a.cost - b.cost) || a.r.id.localeCompare(b.r.id));
      const k = Math.min(TOP_K, scored.length);
      const idx = Math.floor(rng() * k);
      ctx.assign(need, scored[idx].r.id);
    } else {
      const allWithRole = model.resources.filter(r => r.active && r.roles.includes(need.roleId));
      const structuralSet = new Set(structural.map(r => r.id));
      const rejections = { unavailable: 0 };
      for (const r of allWithRole) {
        if (!structuralSet.has(r.id)) { rejections.unavailable++; continue; }
        const res = hardRulesOk(ctx, model, run, r);
        if (!res.ok) rejections[res.ruleId] = (rejections[res.ruleId] || 0) + 1;
      }
      openSlots.push({ needId: need.id, runId: need.runId, roleId: need.roleId, unitIndex: need.unitIndex, rejections });
    }
  }

  return { ctx, needs, needById, openSlots, lockedNeedIds, rng, candidateIndex: index };
}
