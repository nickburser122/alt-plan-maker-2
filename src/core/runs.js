export function flattenEngagements(runs) {
  const out = [];
  for (const run of runs) {
    for (const date of run.dates) {
      out.push({ id: `${run.id}@${date}`, runId: run.id, date, blockId: run.blockId, siteId: run.siteId, classId: run.classId });
    }
  }
  return out;
}

export function runDates(run) {
  return run.dates;
}

export function needsOfRun(run) {
  const out = [];
  for (const d of run.demand) {
    for (let unitIndex = 0; unitIndex < d.min; unitIndex++) {
      out.push({ id: `${run.id}:${d.roleId}:${unitIndex}`, runId: run.id, roleId: d.roleId, unitIndex });
    }
  }
  return out;
}

export function allNeeds(runs) {
  const out = [];
  for (const run of runs) out.push(...needsOfRun(run));
  return out;
}
