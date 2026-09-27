import { availableForRun } from './availability.js';

export function buildCandidateIndex(model, runs) {
  const patternById = new Map((model.patterns || []).map(p => [p.id, p]));
  const resourcesByRole = new Map();
  for (const r of model.resources) {
    if (!r.active) continue;
    for (const roleId of r.roles) {
      if (!resourcesByRole.has(roleId)) resourcesByRole.set(roleId, []);
      resourcesByRole.get(roleId).push(r);
    }
  }

  const index = new Map();
  for (const run of runs) {
    const roleIds = new Set((run.demand || []).map(d => d.roleId));
    for (const roleId of roleIds) {
      const pool = resourcesByRole.get(roleId) || [];
      const eligible = pool.filter(r => availableForRun(model, patternById, r, run));
      index.set(`${run.id}|${roleId}`, eligible);
    }
  }
  return index;
}

export function candidatesFor(index, run, roleId) {
  return index.get(`${run.id}|${roleId}`) || [];
}
