import { Store } from './ui/store.js';
import { createSolverRunner } from './ui/solver-runner.js';
import { T } from './ui/i18n.js';
import { openOnboarding } from './ui/onboarding.js';
import { PRESETS } from './core/presets.js';
import { validateModel } from './core/schema.js';
import { migrateV1, V1_STORAGE_KEY, V2_STORAGE_KEY } from './core/migrate.js';
import * as PlanView from './ui/views/plan.js';
import * as ResourcesView from './ui/views/resources.js';
import * as SitesView from './ui/views/sites.js';
import * as RulesView from './ui/views/rules.js';
import * as SummaryView from './ui/views/summary.js';
import * as SettingsView from './ui/views/settings.js';

const VIEWS = {
  plan: PlanView, resources: ResourcesView, sites: SitesView,
  rules: RulesView, summary: SummaryView, settings: SettingsView
};
const VIEW_ORDER = ['plan', 'resources', 'sites', 'rules', 'summary', 'settings'];

export function createApp(root, initialModel) {
  const store = new Store(initialModel, {
    onChange: () => renderView(),
    onPersistError: () => { statusEl.textContent = T.storageFull[lang()]; }
  });
  const runner = createSolverRunner();
  let currentViewName = null;
  let currentView = null;
  let plan = null;
  let solving = false;
  let solveTimer = null;
  let solveVersion = 0;

  const toolbar = document.createElement('div');
  toolbar.className = 'workspace-toolbar';
  const navEl = document.createElement('nav');
  navEl.className = 'seg';
  navEl.setAttribute('aria-label', 'Workspace views');
  const languageButton = document.createElement('button');
  languageButton.type = 'button';
  languageButton.className = 'btn language-switch';
  languageButton.addEventListener('click', () => {
    const next = lang() === 'en' ? 'ar' : 'en';
    currentViewName = null;
    store.setUi({ lang: next });
  });
  const undoIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>';
  const redoIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg>';
  const undoButton = document.createElement('button');
  undoButton.type = 'button';
  undoButton.className = 'ibtn tb';
  undoButton.innerHTML = undoIcon;
  undoButton.addEventListener('click', () => history('undo'));
  const redoButton = document.createElement('button');
  redoButton.type = 'button';
  redoButton.className = 'ibtn tb';
  redoButton.innerHTML = redoIcon;
  redoButton.addEventListener('click', () => history('redo'));
  const actions = document.createElement('div');
  actions.className = 'tb-actions';
  actions.append(undoButton, redoButton, languageButton);
  toolbar.append(navEl, actions);

  function history(kind) {
    const can = kind === 'undo' ? store.canUndo() : store.canRedo();
    if (!can) return;
    const before = JSON.stringify(stripUi(store.state));
    store[kind]({ keepUi: true });
    if (JSON.stringify(stripUi(store.state)) !== before) requestSolve(0);
  }
  function stripUi(model) { const { ui, ...rest } = model; return rest; }

  function onKey(e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.querySelector('.overlay')) return;
    const key = e.key.toLowerCase();
    if (key === 'z' && !e.shiftKey) { e.preventDefault(); history('undo'); }
    else if (key === 'y' || (key === 'z' && e.shiftKey)) { e.preventDefault(); history('redo'); }
  }
  document.addEventListener('keydown', onKey);
  const viewContainer = document.createElement('div');
  viewContainer.className = 'view-container';
  const statusEl = document.createElement('p');
  statusEl.className = 'quiet';
  statusEl.setAttribute('role', 'status');
  root.append(toolbar, statusEl, viewContainer);

  function lang() { return store.state.ui.lang; }
  function dir() { return lang() === 'ar' ? 'rtl' : 'ltr'; }

  const helpers = {
    store,
    lang, dir,
    getPlan: () => plan,
    isSolving: () => solving,
    requestSolve,
    requestSolveNow: () => doSolve(),
    openOnboarding: () => openOnboarding(store, {
      onDone: (newModel) => { store.dispatch({ apply: () => newModel }); requestSolve(0); },
      onSkip: () => {}
    })
  };

  async function doSolve() {
    const version = ++solveVersion;
    solving = true;
    statusEl.textContent = '';
    renderNav();
    if (currentView && currentView.onPlan) currentView.onPlan(viewContainer, plan, helpers);
    try {
      const nextPlan = await runner.run(store.state);
      if (version === solveVersion) plan = nextPlan;
    } catch (error) {
      if (version === solveVersion) {
        console.error('Rota generation failed', error);
        plan = null;
        statusEl.textContent = lang() === 'ar' ? 'تعذر إنشاء الخطة. راجع بياناتك وقواعدك ثم حاول مجددًا.' : 'Could not generate the plan. Check your data and rules, then try again.';
      }
    } finally {
      if (version === solveVersion) {
        solving = false;
        renderNav();
        if (currentView && currentView.onPlan) currentView.onPlan(viewContainer, plan, helpers);
      }
    }
  }

  function requestSolve(debounceMs = 80) {
    ++solveVersion;
    if (solveTimer) clearTimeout(solveTimer);
    solveTimer = setTimeout(() => { solveTimer = null; doSolve(); }, debounceMs);
  }

  function renderNav() {
    navEl.innerHTML = '';
    for (const name of VIEW_ORDER) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = T['nav' + name[0].toUpperCase() + name.slice(1)][lang()];
      btn.setAttribute('aria-current', name === store.state.ui.view ? 'page' : 'false');
      if (name === store.state.ui.view) btn.className = 'on';
      btn.addEventListener('click', () => {
        if (store.state.ui.view === name) return;
        store.setUi({ view: name });
        window.scrollTo({ top: 0 });
      });
      navEl.appendChild(btn);
    }
    languageButton.textContent = lang() === 'en' ? 'العربية' : 'English';
    languageButton.setAttribute('aria-label', lang() === 'en' ? 'Switch to Arabic' : 'Switch to English');
    undoButton.disabled = !store.canUndo();
    redoButton.disabled = !store.canRedo();
    undoButton.title = T.undo[lang()] + ' (Ctrl+Z)';
    redoButton.title = T.redo[lang()] + ' (Ctrl+Y)';
    undoButton.setAttribute('aria-label', T.undo[lang()]);
    redoButton.setAttribute('aria-label', T.redo[lang()]);
    const planBtn = navEl.firstChild;
    if (planBtn && solving) planBtn.insertAdjacentHTML('beforeend', '<span class="solving-dot" aria-hidden="true"></span>');
  }

  function renderView() {
    document.documentElement.lang = lang();
    document.documentElement.dir = dir();
    const title = document.getElementById('workspace-title');
    if (title) title.textContent = lang() === 'ar' ? 'طريقة أوضح للتخطيط.' : 'A clearer way to plan.';
    const intro = document.querySelector('.workspace-intro p');
    if (intro) intro.textContent = lang() === 'ar' ? 'نظّم الأفراد والمواقع والقواعد، ودع الجدول يتكوّن.' : 'Organize people, places and rules. Let the rota come together.';
    const viewName = VIEWS[store.state.ui.view] ? store.state.ui.view : 'plan';
    const mod = VIEWS[viewName];
    if (viewName !== currentViewName) {
      if (currentView && currentView.destroy) currentView.destroy();
      viewContainer.innerHTML = '';
      currentViewName = viewName;
      currentView = mod.create(helpers);
      currentView.mount(viewContainer);
      if (currentView.onPlan) currentView.onPlan(viewContainer, plan, helpers);
    } else {
      currentView.patch(viewContainer);
    }
    renderNav();
  }

  renderView();
  doSolve();

  return { store, requestSolve, getPlan: () => plan, destroy: () => { ++solveVersion; clearTimeout(solveTimer); document.removeEventListener('keydown', onKey); runner.destroy(); } };
}

export function boot(root) {
  const restored = Store.restore();
  if (restored && validateModel(restored).length === 0) return createApp(root, restored);
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(V1_STORAGE_KEY);
      if (raw) {
        const migrated = migrateV1(JSON.parse(raw));
        if (validateModel(migrated).length === 0) {
          localStorage.setItem(V2_STORAGE_KEY, JSON.stringify(migrated));
          return createApp(root, migrated);
        }
      }
    } catch (error) {
      console.warn('Could not migrate previous rota data', error);
    }
  }
  const starter = PRESETS[0].build();
  starter.ui.view = 'plan';
  const app = createApp(root, starter);
  openOnboarding(app.store, {
    onDone: (model) => { app.store.dispatch({ apply: () => model }); app.requestSolve(0); },
    onSkip: () => {}
  });
  return app;
}
