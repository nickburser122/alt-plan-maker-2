import { bi } from './bi.js';
import { ruleType } from './rules/registry.js';

export function explainOpenSlot(slot, model) {
  const reasons = [];
  for (const [key, count] of Object.entries(slot.rejections)) {
    if (key === 'unavailable') {
      reasons.push({ code: 'unavailable', count, label: bi('Not available', 'غير متاح') });
    } else {
      const rule = model.rules.find(r => r.id === key);
      const type = rule && ruleType(rule.type);
      reasons.push({ code: key, count, label: type ? type.label : bi(key, key) });
    }
  }
  return reasons.sort((a, b) => b.count - a.count);
}

export function explainBent(ctx, model) {
  const out = [];
  for (const rec of ctx.assignments.values()) {
    if (!rec.bent) continue;
    const rule = model.rules.find(r => r.id === rec.bent);
    out.push({ needId: rec.id, resourceId: rec.resourceId, ruleId: rec.bent, label: rule ? ruleType(rule.type)?.label : bi(rec.bent, rec.bent) });
  }
  return out;
}
