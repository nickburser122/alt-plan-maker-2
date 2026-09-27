import { generateRuns } from './demand.js';
import { construct } from './solver/construct.js';
import { repair } from './solver/repair.js';
import { lnsPolish, totalSoftCost } from './solver/lns.js';
import { buildCandidateIndex } from './solver/candidates.js';
import { flattenEngagements } from './runs.js';
import { computeMetrics } from './metrics.js';
import { auditPlan } from './audit.js';

function bentCountOf(ctx) {
  let n = 0;
  for (const rec of ctx.assignments.values()) if (rec.bent) n++;
  return n;
}

function scoreOf(ctx, model, openCount) {
  return [bentCountOf(ctx), openCount, totalSoftCost(ctx, model)];
}

function lexLess(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

function setup(model, opts) {
  const runs = generateRuns(model);
  const candidateIndex = buildCandidateIndex(model, runs);
  const seed = opts.seed ?? model.engine.seed;
  const restarts = Math.max(1, opts.restarts ?? model.engine.restarts ?? 1);
  const lnsIterations = opts.lnsIterations ?? model.engine.lnsIterations ?? 0;
  return { runs, candidateIndex, seed, restarts, lnsIterations };
}

function runOneRestart(model, runs, candidateIndex, seed, lnsIterations, i) {
  const built = construct(model, runs, { seed, restartIdx: i }, candidateIndex);
  const { stillOpen } = repair(model, built, built.rng);
  const { openSlots } = lnsPolish(
    model,
    { ctx: built.ctx, needById: built.needById, lockedNeedIds: built.lockedNeedIds, openSlots: stillOpen, candidateIndex },
    built.rng,
    lnsIterations
  );
  return { ctx: built.ctx, needs: built.needs, openSlots, restartIdx: i, score: scoreOf(built.ctx, model, openSlots.length) };
}

function finalize(model, runs, seed, restarts, best) {
  const engagements = flattenEngagements(runs);
  const assignments = [...best.ctx.assignments.values()];
  const metrics = computeMetrics(best.ctx, model, best.needs, best.openSlots);
  const violations = auditPlan(best.ctx, model);
  return {
    seedUsed: seed,
    restarts,
    chosenRestart: best.restartIdx,
    engagements,
    runs,
    assignments,
    openSlots: best.openSlots,
    metrics,
    violations,
    deterministic: true,
    ctx: best.ctx
  };
}

export function solve(model, opts = {}) {
  const { runs, candidateIndex, seed, restarts, lnsIterations } = setup(model, opts);
  let best = null;
  for (let i = 0; i < restarts; i++) {
    const candidate = runOneRestart(model, runs, candidateIndex, seed, lnsIterations, i);
    if (!best || lexLess(candidate.score, best.score)) best = candidate;
  }
  return finalize(model, runs, seed, restarts, best);
}

export async function solveTimeSliced(model, opts = {}, yieldFn = () => Promise.resolve()) {
  const { runs, candidateIndex, seed, restarts, lnsIterations } = setup(model, opts);
  let best = null;
  for (let i = 0; i < restarts; i++) {
    const candidate = runOneRestart(model, runs, candidateIndex, seed, lnsIterations, i);
    if (!best || lexLess(candidate.score, best.score)) best = candidate;
    await yieldFn();
  }
  return finalize(model, runs, seed, restarts, best);
}

export function planForTransfer(plan) {
  const { ctx, ...rest } = plan;
  return rest;
}
