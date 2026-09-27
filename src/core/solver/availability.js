import { dowOf, dayGap } from '../dates.js';

export function patternOn(pattern, date) {
  const offset = dayGap(pattern.anchor, date);
  const len = pattern.cycle.length;
  const idx = ((offset % len) + len) % len;
  return pattern.cycle[idx] === 'on';
}

export function availableOn(model, patternById, resource, date) {
  if (!resource.active) return false;
  if (resource.avail.off?.includes(date)) return false;
  if (resource.avail.only?.length && !resource.avail.only.includes(date)) return false;
  if (!resource.avail.weekdays[dowOf(date)]) return false;
  if (resource.avail.patternId) {
    const pattern = patternById.get(resource.avail.patternId);
    if (pattern && !patternOn(pattern, date)) return false;
  }
  return true;
}

export function availableForRun(model, patternById, resource, run) {
  return run.dates.every(d => availableOn(model, patternById, resource, d));
}
