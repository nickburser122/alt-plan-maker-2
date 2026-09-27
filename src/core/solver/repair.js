import { hardRulesOk } from './construct.js';
import { candidatesFor } from './candidates.js';
import { candidateCost } from './score.js';

const TOP_K = 3;

export function repair(model, result, rng) {
  const { ctx, needById, openSlots, candidateIndex } = result;
  const relax = model.engine.relaxMode === 'relaxed';
  const hardRules = (model.rules || [])
    .filter(r => r.enabled && r.severity === 'hard')
    .slice()
    .sort((a, b) => (a.weight - b.weight) || a.id.localeCompare(b.id));

  const stillOpen = [];
  let bentCount = 0;

  for (const slot of openSlots) {
    const need = needById.get(slot.needId);
    const run = ctx.runById.get(need.runId);
    const structural = candidatesFor(candidateIndex, run, need.roleId);

    let feasible = structural.filter(r => hardRulesOk(ctx, model, run, r).ok);
    let bentRuleId = null;

    if (feasible.length === 0 && relax) {
      for (const rule of hardRules) {
        const cand = structural.filter(r => hardRulesOk(ctx, model, run, r, rule.id).ok);
        if (cand.length > 0) { feasible = cand; bentRuleId = rule.id; break; }
      }
    }

    if (feasible.length > 0) {
      const scored = feasible.map(r => ({ r, cost: candidateCost(ctx, model, { resourceId: r.id, resource: r, runId: run.id, siteId: run.siteId }) }));
      scored.sort((a, b) => (a.cost - b.cost) || a.r.id.localeCompare(b.r.id));
      const k = Math.min(TOP_K, scored.length);
      const idx = Math.floor(rng() * k);
      ctx.assign(need, scored[idx].r.id, bentRuleId);
      if (bentRuleId) bentCount++;
    } else {
      stillOpen.push(slot);
    }
  }

  return { stillOpen, bentCount };
}
