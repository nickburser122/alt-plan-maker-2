import { solve } from '../core/solve.js';
import { planForTransfer } from '../core/solve.js';

self.onmessage = (e) => {
  const { id, model, opts } = e.data;
  try {
    const plan = solve(model, opts || {});
    self.postMessage({ id, plan: planForTransfer(plan) });
  } catch (err) {
    self.postMessage({ id, error: String((err && err.message) || err) });
  }
};
