import { ruleType } from './rules/registry.js';

export function auditPlan(ctx, model) {
  const violations = [];
  for (const rule of model.rules || []) {
    if (!rule.enabled) continue;
    const type = ruleType(rule.type);
    if (!type) continue;
    ctx.rule = rule;
    const found = type.audit(ctx) || [];
    for (const v of found) violations.push({ ...v, ruleId: rule.id });
  }
  return violations;
}
