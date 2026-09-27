import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { migrateV1 } from '../src/core/migrate.js';
import { validateModel } from '../src/core/schema.js';
import { cloneModel } from '../src/core/model.js';
import { Store } from '../src/ui/store.js';
import { mulberry32 } from '../src/core/rng.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const v1 = JSON.parse(readFileSync(path.join(__dirname, 'fixtures/v1-seed.json'), 'utf8'));

test('migrateV1 converts the real v1 seed into a valid v2 model', () => {
  const model = migrateV1(v1);
  const errors = validateModel(model);
  assert.deepEqual(errors, []);
});

test('migrateV1 preserves counts and the fin/clin -> role mapping', () => {
  const model = migrateV1(v1);
  assert.equal(model.roles.length, 2);
  assert.equal(model.siteClasses.length, 3);
  assert.equal(model.sites.length, v1.facilities.length);
  assert.equal(model.resources.length, v1.people.length);

  const finPeople = v1.people.filter(p => p.pool === 'fin').length;
  const clinPeople = v1.people.filter(p => p.pool === 'clin').length;
  assert.equal(model.resources.filter(r => r.roles.includes('r_fin')).length, finPeople);
  assert.equal(model.resources.filter(r => r.roles.includes('r_clin')).length, clinPeople);
});

test('migrateV1 preserves the house-rule staffing as siteClass demand', () => {
  const model = migrateV1(v1);
  const main = model.siteClasses.find(c => c.id === 'c_main');
  const contracted = model.siteClasses.find(c => c.id === 'c_contracted');
  assert.equal(main.demand.find(d => d.roleId === 'r_fin').min, v1.settings.staffing.main.fin);
  assert.equal(main.demand.find(d => d.roleId === 'r_clin').min, v1.settings.staffing.main.clin);
  assert.equal(contracted.demand.find(d => d.roleId === 'r_fin').min, v1.settings.staffing.contracted.fin);
  assert.equal(contracted.demand.find(d => d.roleId === 'r_clin').min, v1.settings.staffing.contracted.clin);
});

test('migrateV1 preserves excluded facilities as an unplanned siteClass', () => {
  const model = migrateV1(v1);
  const excludedCount = v1.facilities.filter(f => f.type === 'excluded').length;
  assert.equal(model.sites.filter(s => s.classId === 'c_excluded').length, excludedCount);
  assert.equal(model.siteClasses.find(c => c.id === 'c_excluded').planned, false);
});

test('store undo/redo round-trips 20 random actions', () => {
  const initial = migrateV1(v1);
  const store = new Store(initial, { debounceMs: 1 });

  const rand = mulberry32(20260907);
  const views = ['plan', 'resources', 'sites', 'rules', 'summary', 'settings'];
  const actions = [];
  for (let i = 0; i < 20; i++) {
    const kind = Math.floor(rand() * 3);
    if (kind === 0) {
      const idx = Math.floor(rand() * initial.resources.length);
      actions.push({
        apply: m => { m.resources[idx].active = !m.resources[idx].active; return m; }
      });
    } else if (kind === 1) {
      const idx = Math.floor(rand() * initial.sites.length);
      actions.push({
        apply: m => { m.sites[idx].active = !m.sites[idx].active; return m; }
      });
    } else {
      const view = views[Math.floor(rand() * views.length)];
      actions.push({ apply: m => { m.ui.view = view; return m; } });
    }
  }

  const initialSnapshot = cloneModel(store.state);
  for (const a of actions) store.dispatch(a);
  const finalSnapshot = cloneModel(store.state);

  assert.notDeepEqual(finalSnapshot, initialSnapshot);

  for (let i = 0; i < 20; i++) store.undo();
  assert.deepEqual(store.state, initialSnapshot);
  assert.equal(store.canUndo(), false);

  for (let i = 0; i < 20; i++) store.redo();
  assert.deepEqual(store.state, finalSnapshot);
  assert.equal(store.canRedo(), false);

  if (store._timer) clearTimeout(store._timer);
});
