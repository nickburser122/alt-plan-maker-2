import { solveTimeSliced, planForTransfer } from '../core/solve.js';

const YIELD_MS = 16;

function sliceYield() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

export function createSolverRunner() {
  let worker = null;
  let seq = 0;
  const pending = new Map();

  function makeWorker() {
    try {
      const w = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
      w.onmessage = (e) => {
        const { id, plan, error } = e.data;
        const p = pending.get(id);
        if (!p) return;
        pending.delete(id);
        if (error) p.reject(new Error(error));
        else p.resolve(plan);
      };
      w.onerror = () => {
        worker = null;
        for (const p of pending.values()) p.fallback();
        pending.clear();
      };
      return w;
    } catch (e) {
      return null;
    }
  }

  if (typeof Worker !== 'undefined') worker = makeWorker();

  async function runSync(model, opts) {
    let lastYield = Date.now();
    const plan = await solveTimeSliced(model, opts, async () => {
      const now = Date.now();
      if (now - lastYield >= YIELD_MS) {
        lastYield = now;
        await sliceYield();
      }
    });
    return planForTransfer(plan);
  }

  async function run(model, opts = {}) {
    if (worker) {
      const id = ++seq;
      return new Promise((resolve, reject) => {
        pending.set(id, {
          resolve, reject,
          fallback: () => { runSync(model, opts).then(resolve, reject); }
        });
        try {
          worker.postMessage({ id, model, opts });
        } catch (e) {
          pending.delete(id);
          worker = null;
          runSync(model, opts).then(resolve, reject);
        }
      });
    }
    return runSync(model, opts);
  }

  return {
    run,
    usingWorker: () => !!worker,
    destroy: () => { if (worker) worker.terminate(); worker = null; }
  };
}
