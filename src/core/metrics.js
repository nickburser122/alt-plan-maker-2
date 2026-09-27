function giniCoefficient(values) {
  const n = values.length;
  if (!n) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const sum = sorted.reduce((s, v) => s + v, 0);
  if (sum === 0) return 0;
  let cum = 0;
  for (let i = 0; i < n; i++) cum += (i + 1) * sorted[i];
  return (2 * cum) / (n * sum) - (n + 1) / n;
}

export function computeMetrics(ctx, model, needs, openSlots) {
  const totalNeeds = needs.length;
  const openCount = openSlots.length;
  const filled = totalNeeds - openCount;

  const loadByResource = new Map();
  for (const rec of ctx.assignments.values()) {
    loadByResource.set(rec.resourceId, (loadByResource.get(rec.resourceId) || 0) + 1);
  }
  const loads = model.resources.filter(r => r.active).map(r => loadByResource.get(r.id) || 0);

  const visitsBySite = new Map();
  for (const run of ctx.runs) {
    if (!ctx.runResources.get(run.id)?.size) continue;
    visitsBySite.set(run.siteId, (visitsBySite.get(run.siteId) || 0) + run.dates.length);
  }

  return {
    totalNeeds,
    filled,
    openCount,
    coverage: totalNeeds ? filled / totalNeeds : 1,
    gini: giniCoefficient(loads),
    loadByResource: Object.fromEntries(loadByResource),
    visitsBySite: Object.fromEntries(visitsBySite)
  };
}
