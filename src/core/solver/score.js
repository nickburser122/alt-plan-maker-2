import { ruleType } from '../rules/registry.js';

export function candidateCost(ctx, model, cand) {
  let cost = 0;
  const resource = cand.resource;
  const site = ctx.siteOf(cand.siteId);

  for (const obj of model.objectives || []) {
    if (!obj.enabled) continue;
    if (obj.id === 'fairness') {
      cost += ctx.sortedDutyDates(cand.resourceId).length * (obj.weight / 100);
    } else if (obj.id === 'facility') {
      cost += (2 - (site.weight ?? 1)) * (obj.weight / 100);
    } else if (obj.id === 'person') {
      cost += (2 - (resource.weight ?? 1)) * (obj.weight / 100);
    }
  }

  for (const rule of model.rules || []) {
    if (!rule.enabled || rule.severity !== 'soft') continue;
    const type = ruleType(rule.type);
    if (!type?.cost) continue;
    ctx.rule = rule;
    cost += type.cost(ctx, cand) || 0;
  }

  return cost;
}
