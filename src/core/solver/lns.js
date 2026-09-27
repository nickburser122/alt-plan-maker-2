import { hardRulesOk } from './construct.js';
import { candidatesFor } from './candidates.js';
import { candidateCost } from './score.js';

const TOP_K = 3;
const RUIN_MIN = 0.10;
const RUIN_MAX = 0.25;
const RUIN_CAP = 8;

export function totalSoftCost(ctx, model) {
  let total = 0;
  for (const rec of ctx.assignments.values()) {
    const run = ctx.runById.get(rec.runId);
    const resource = ctx.resourceOf(rec.resourceId);
    total += candidateCost(ctx, model, { resourceId: rec.resourceId, resource, runId: run.id, siteId: run.siteId });
  }
  return total;
}

function planScore(ctx, model, openCount) {
  const bent = [...ctx.assignments.values()].filter(a => a.bent).length;
  return [bent, openCount, totalSoftCost(ctx, model)];
}

function lexLess(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

export function lnsPolish(model, result, rng, iterations) {
  const { ctx, needById, candidateIndex } = result;
  let openSlots = result.stillOpen ?? result.openSlots;

  const initialAssignedIds = [...ctx.assignments.keys()].filter(id => !result.lockedNeedIds.has(id));
  if (initialAssignedIds.length === 0) return { openSlots };

  let best = planScore(ctx, model, openSlots.length);

  for (let iter = 0; iter < iterations; iter++) {
    const assignedNeedIds = [...ctx.assignments.keys()].filter(id => !result.lockedNeedIds.has(id));
    if (assignedNeedIds.length === 0) continue;

    const frac = RUIN_MIN + rng() * (RUIN_MAX - RUIN_MIN);
    const count = Math.max(1, Math.min(RUIN_CAP, Math.round(frac * assignedNeedIds.length)));
    const pool = assignedNeedIds.slice();
    const ruined = [];
    for (let i = 0; i < count && pool.length; i++) {
      const idx = Math.floor(rng() * pool.length);
      ruined.push(pool.splice(idx, 1)[0]);
    }

    const snapshot = ruined.map(id => ({ id, ...ctx.assignments.get(id) }));
    for (const id of ruined) ctx.unassign(id);

    const freedOpenBefore = openSlots;
    const newOpen = [];
    const order = ruined
      .map(id => needById.get(id))
      .sort((a, b) => a.id.localeCompare(b.id));

    for (const need of order) {
      const run = ctx.runById.get(need.runId);
      const structural = candidatesFor(candidateIndex, run, need.roleId);
      const feasible = structural.filter(r => hardRulesOk(ctx, model, run, r).ok);
      if (feasible.length > 0) {
        const scored = feasible.map(r => ({ r, cost: candidateCost(ctx, model, { resourceId: r.id, resource: r, runId: run.id, siteId: run.siteId }) }));
        scored.sort((a, b) => (a.cost - b.cost) || a.r.id.localeCompare(b.r.id));
        const k = Math.min(TOP_K, scored.length);
        const idx = Math.floor(rng() * k);
        ctx.assign(need, scored[idx].r.id);
      } else {
        newOpen.push({ needId: need.id, runId: need.runId, roleId: need.roleId, unitIndex: need.unitIndex, rejections: { unavailable: 0 } });
      }
    }

    openSlots = [...freedOpenBefore, ...newOpen];
    const candidateScore = planScore(ctx, model, openSlots.length);

    if (lexLess(candidateScore, best)) {
      best = candidateScore;
    } else {
      for (const id of ruined) ctx.unassign(id);
      for (const s of snapshot) ctx.assign(needById.get(s.id), s.resourceId, s.bent);
      openSlots = freedOpenBefore;
    }
  }

  return { openSlots };
}
