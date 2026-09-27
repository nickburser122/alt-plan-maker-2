import { patchList, h, toggleClass, escapeHTML } from '../render.js';
import { openExportModal } from '../export-modal.js';
import { T } from '../i18n.js';
import { explainOpenSlot } from '../../core/explain.js';
import { dowOf } from '../../core/dates.js';

const DOW_SHORT = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ar: ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
};

function buildRows(model, plan) {
  if (!plan) return [];
  const byRun = new Map();
  for (const a of plan.assignments) {
    if (!byRun.has(a.runId)) byRun.set(a.runId, []);
    byRun.get(a.runId).push(a);
  }
  const openByRun = new Map();
  for (const s of plan.openSlots) {
    if (!openByRun.has(s.runId)) openByRun.set(s.runId, []);
    openByRun.get(s.runId).push(s);
  }
  const bySite = new Map(model.sites.map(s => [s.id, s]));
  const items = [];
  let lastDate = null;
  const sorted = [...plan.engagements].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || a.siteId.localeCompare(b.siteId));
  for (const eng of sorted) {
    if (eng.date !== lastDate) {
      items.push({ type: 'day', key: 'day:' + eng.date, date: eng.date });
      lastDate = eng.date;
    }
    items.push({
      type: 'eng', key: 'eng:' + eng.id, eng,
      site: bySite.get(eng.siteId), crew: byRun.get(eng.runId) || [], open: openByRun.get(eng.runId) || []
    });
  }
  return items;
}

function isLocked(model, engagementId, roleId, unitIndex) {
  return model.locks.some(l => l.engagementId === engagementId && l.roleId === roleId && l.slotIndex === unitIndex);
}

function hasViolation(plan, resourceId, runId, date) {
  return plan.violations.some(v => v.refs && v.refs.resourceId === resourceId && (v.refs.date === date || (v.refs.dates && v.refs.dates.includes(date))));
}

export function create(helpers) {
  const { store, lang, requestSolve, getPlan } = helpers;
  let listEl = null;
  let ribbonEl = null;

  function dispatchEdit(apply) {
    store.dispatch({ apply });
    requestSolve();
  }

  function toggleLock(engagementId, roleId, unitIndex, resourceId) {
    dispatchEdit(m => {
      const idx = m.locks.findIndex(l => l.engagementId === engagementId && l.roleId === roleId && l.slotIndex === unitIndex);
      if (idx >= 0) m.locks.splice(idx, 1);
      else m.locks.push({ engagementId, roleId, slotIndex: unitIndex, resourceId });
      return m;
    });
  }

  function pillHTML(model, plan, eng, a) {
    const resource = model.resources.find(r => r.id === a.resourceId);
    const locked = isLocked(model, eng.id, a.roleId, a.unitIndex);
    const violated = hasViolation(plan, a.resourceId, a.runId, eng.date);
    const name = resource ? (resource.name[lang()] || resource.name.en) : a.resourceId;
    const role = model.roles.find(r => r.id === a.roleId);
    const roleIndex = Math.max(0, model.roles.findIndex(r => r.id === a.roleId));
    return '<button type="button" aria-pressed="' + locked + '" class="pill role-' + (roleIndex % 4) + (locked ? ' locked' : '') + (a.bent ? ' bend' : '') + '" data-role-name="' + escapeHTML(role ? (role.short || '') : '') + '" title="' + escapeHTML(locked ? (lang() === 'ar' ? 'إلغاء تثبيت المهمة' : 'Unlock assignment') : (lang() === 'ar' ? 'تثبيت المهمة' : 'Lock assignment')) + '" data-act="toggle-lock" data-eng="' + escapeHTML(eng.id) + '" data-role="' + escapeHTML(a.roleId) + '" data-unit="' + a.unitIndex + '" data-res="' + escapeHTML(a.resourceId) + '">' +
      (locked ? '<svg class="lock-ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>' : '') +
      '<span class="' + (violated ? 'violation-underline' : '') + '">' + escapeHTML(name) + '</span>' +
      '</button>';
  }

  function openPillHTML(open) {
    const reasons = explainOpenSlot(open, store.state);
    const label = reasons[0] ? (reasons[0].label[lang()] || reasons[0].label.en) : '';
    const role = store.state.roles.find(r => r.id === open.roleId);
    const roleName = role ? (role.name[lang()] || role.name.en) : open.roleId;
    return '<span class="pill open" tabindex="0" title="' + escapeHTML(label) + '">' + escapeHTML(T.unfilled[lang()] + ' · ' + roleName) + '</span>';
  }

  function createDayHeader(item) {
    const el = h('<tr class="dayhead"><td colspan="3"><span class="dh"></span></td></tr>');
    updateDayHeader(el, item);
    return el;
  }
  function updateDayHeader(el, item) {
    const d = item.date;
    const dow = DOW_SHORT[lang()][dowOf(d)];
    el.querySelector('.dh').innerHTML = '<b>' + dow + '</b> · ' + d;
  }

  function createEngRow(item) {
    const el = h('<tr><td class="fname"></td><td></td><td class="team"></td></tr>');
    el.addEventListener('click', (e) => {
      const p = e.target.closest('[data-act="toggle-lock"]');
      if (!p) return;
      toggleLock(p.dataset.eng, p.dataset.role, +p.dataset.unit, p.dataset.res);
    });
    updateEngRow(el, item);
    return el;
  }
  function updateEngRow(el, item) {
    const model = store.state;
    const plan = getPlan();
    const site = item.site;
    el.children[0].textContent = site ? (site.name[lang()] || site.name.en) : item.eng.siteId;
    const cls = model.siteClasses.find(c => c.id === item.eng.classId);
    const clsIndex = Math.max(0, model.siteClasses.findIndex(c => c.id === item.eng.classId));
    el.children[1].innerHTML = '<span class="tag ' + (clsIndex === 0 ? 'main' : 'contracted') + '">' + escapeHTML(cls ? (cls.name[lang()] || cls.name.en) : '') + '</span>';
    const crewHtml = item.crew.map(a => pillHTML(model, plan, item.eng, a)).join('');
    const openHtml = item.open.map(openPillHTML).join('');
    el.children[2].innerHTML = crewHtml + openHtml;
  }

  function createRibbonTile(item) {
    const el = h('<button type="button" class="tile" data-date=""></button>');
    el.addEventListener('click', () => {
      const row = listEl.querySelector('[data-key="day:' + el.dataset.date + '"]');
      if (row) row.scrollIntoView({ block: 'nearest' });
    });
    updateRibbonTile(el, item);
    return el;
  }
  function updateRibbonTile(el, item) {
    el.dataset.date = item.date;
    const d = item.date.slice(8, 10);
    const dow = DOW_SHORT[lang()][dowOf(item.date)];
    el.innerHTML = '<span class="dw">' + dow + '</span><span class="dn">' + d + '</span>';
  }

  function render(container, full) {
    const model = store.state;
    const plan = getPlan();
    if (full) {
      container.innerHTML =
        '<section class="card plan-head">' +
        '<div class="card-head"><div><div class="kicker" id="plan-range"></div><h2 class="ctitle" id="plan-title"></h2></div>' +
        '<div class="btnrow"><button type="button" class="btn" id="plan-export">' + T.export[lang()] + '</button>' +
        '<button type="button" class="btn primary" id="plan-generate">' + T.generate[lang()] + '</button></div></div>' +
        '<div class="chiprow" id="plan-chips"></div>' +
        '<p class="field-note plan-hint">' + T.lockHint[lang()] + '</p>' +
        '</section>' +
        '<div class="ribbon" id="plan-ribbon"></div>' +
        '<div class="card tblcard"><div class="tblwrap" id="plan-tblwrap"><table class="sched"><thead><tr><th>' + T.colSite[lang()] + '</th><th>' + T.colClass[lang()] + '</th><th>' + T.colCrew[lang()] + '</th></tr></thead><tbody id="plan-body"></tbody></table></div></div>';
      container.querySelector('#plan-generate').addEventListener('click', () => {
        store.dispatch({ apply: m => { m.engine.seed = (Number(m.engine.seed) || 0) + 1; return m; } });
        helpers.requestSolveNow();
      });
      container.querySelector('#plan-export').addEventListener('click', () => {
        const p = getPlan();
        if (p) openExportModal(store.state, p, lang());
      });
      listEl = container.querySelector('#plan-body');
      ribbonEl = container.querySelector('#plan-ribbon');
    }

    const horizon = model.calendar.horizon;
    container.querySelector('#plan-range').textContent = horizon.start && horizon.end ? horizon.start + ' → ' + horizon.end : T.navPlan[lang()];
    container.querySelector('#plan-export').disabled = !plan || !plan.engagements.length;
    container.querySelector('#plan-generate').disabled = helpers.isSolving();

    if (!plan) {
      container.querySelector('#plan-title').textContent = helpers.isSolving() ? T.solving[lang()] : T.emptyPlan[lang()];
      container.querySelector('#plan-chips').innerHTML = '';
      listEl.innerHTML = '';
      ribbonEl.innerHTML = '';
      return;
    }

    const days = new Set(plan.engagements.map(e => e.date)).size;
    const hard = plan.violations.filter(v => v.severity === 'hard').length;
    const soft = plan.violations.length - hard;
    container.querySelector('#plan-title').textContent = T.planTitle[lang()](plan.assignments.length, days);
    container.querySelector('#plan-chips').innerHTML =
      '<span class="chip">' + T.coverage[lang()] + ' ' + Math.round(plan.metrics.coverage * 100) + '%</span>' +
      '<span class="chip' + (plan.openSlots.length ? ' bad' : '') + '">' + plan.openSlots.length + ' ' + T.openSlots[lang()] + '</span>' +
      '<span class="chip' + (hard ? ' bad' : '') + '">' + hard + ' ' + T.hardIssues[lang()] + '</span>' +
      '<span class="chip' + (soft ? ' bend' : '') + '">' + soft + ' ' + T.softIssues[lang()] + '</span>' +
      (model.locks.length ? '<span class="chip">' + model.locks.length + ' ' + T.locked[lang()] + '</span>' : '');

    if (!plan.engagements.length) {
      listEl.innerHTML = '<tr><td colspan="3"><div class="empty">' + T.emptyPlanHint[lang()] + '</div></td></tr>';
      ribbonEl.innerHTML = '';
      return;
    }

    const rows = buildRows(model, plan);
    const dayItems = rows.filter(r => r.type === 'day');
    patchList(ribbonEl, dayItems, { key: r => r.key, create: createRibbonTile, update: updateRibbonTile });

    patchList(listEl, rows, {
      key: r => r.key,
      create: r => r.type === 'day' ? createDayHeader(r) : createEngRow(r),
      update: (el, r) => r.type === 'day' ? updateDayHeader(el, r) : updateEngRow(el, r)
    });
  }

  return {
    mount(container) { render(container, true); },
    patch(container) { render(container, false); },
    onPlan(container) { render(container, false); },
    destroy() {}
  };
}
