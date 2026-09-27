import { dowOf, addISO, dayGap, eachISO } from './dates.js';

export function dayConfig(model, date) {
  const ov = model.calendar.dateOverrides[date];
  if (ov) return ov;
  return model.calendar.weekdayDefaults[dowOf(date)] || { on: false, blocks: [] };
}

function cadenceOk(site, date, lastVisited, visitCount) {
  const cad = site.cadence || {};
  const last = lastVisited.get(site.id);
  if (last !== undefined && cad.minGapDays && dayGap(last, date) < cad.minGapDays) return false;
  if (cad.maxPerHorizon != null && (visitCount.get(site.id) || 0) >= cad.maxPerHorizon) return false;
  return true;
}

function pickSites(sites, count, date, lastVisited, visitCount) {
  const scored = sites.map(s => {
    const last = lastVisited.get(s.id);
    const recency = last === undefined ? Number.MAX_SAFE_INTEGER : dayGap(last, date);
    return { s, score: recency * (s.weight ?? 1) };
  });
  scored.sort((a, b) => (b.score - a.score) || a.s.id.localeCompare(b.s.id));
  return scored.slice(0, count).map(x => x.s);
}

export function generateRuns(model) {
  if (!model.calendar?.horizon?.start || !model.calendar?.horizon?.end || !model.sites?.length) return [];
  const classById = new Map(model.siteClasses.map(c => [c.id, c]));
  const dates = eachISO(model.calendar.horizon.start, model.calendar.horizon.end);
  const horizonEnd = model.calendar.horizon.end;

  const eligibleSites = model.sites
    .filter(s => s.active && classById.get(s.classId)?.planned)
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));

  const lastVisited = new Map();
  const visitCount = new Map();
  const openRuns = new Map();
  const runs = [];
  let counter = 0;

  for (const date of dates) {
    const cfg = dayConfig(model, date);
    if (!cfg.on) continue;
    for (const block of cfg.blocks) {
      const requiredSiteIds = new Set();
      for (const [siteId, open] of openRuns) {
        if (open.blockId === block.blockId && open.nextDate === date) {
          open.run.dates.push(date);
          requiredSiteIds.add(siteId);
          open.remaining--;
          if (open.remaining <= 0) {
            lastVisited.set(siteId, date);
            openRuns.delete(siteId);
          } else {
            open.nextDate = addISO(date, 1);
          }
        }
      }

      const need = block.slots - requiredSiteIds.size;
      if (need > 0) {
        const candidates = eligibleSites.filter(s =>
          !requiredSiteIds.has(s.id) &&
          !openRuns.has(s.id) &&
          cadenceOk(s, date, lastVisited, visitCount)
        );
        const chosen = pickSites(candidates, need, date, lastVisited, visitCount);
        for (const site of chosen) {
          const cls = classById.get(site.classId);
          const maxLen = dayGap(date, horizonEnd) + 1;
          const length = Math.max(1, Math.min(cls.runLength || 1, maxLen));
          const run = {
            id: `run_${counter++}`,
            siteId: site.id,
            classId: site.classId,
            blockId: block.blockId,
            startDate: date,
            dates: [date],
            demand: cls.demand,
            cohesion: cls.cohesion
          };
          runs.push(run);
          requiredSiteIds.add(site.id);
          visitCount.set(site.id, (visitCount.get(site.id) || 0) + 1);
          if (length > 1) {
            openRuns.set(site.id, { run, remaining: length - 1, nextDate: addISO(date, 1), blockId: block.blockId });
          } else {
            lastVisited.set(site.id, date);
          }
        }
      }
    }
  }

  return runs;
}
