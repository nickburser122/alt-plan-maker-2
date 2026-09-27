import { T } from '../i18n.js';
import { escapeHTML } from '../render.js';
import { ruleType } from '../../core/rules/registry.js';

export function create(helpers) {
  const { store, lang, getPlan } = helpers;

  function nameOf(list, id, key = 'name') {
    const item = list.find(x => x.id === id);
    return item ? (item[key][lang()] || item[key].en || T.unnamed[lang()]) : id;
  }

  function kpi(labelText, value, hint, bad) {
    return '<div class="kpi' + (bad ? ' bad' : '') + '"><span class="sl">' + escapeHTML(labelText) + '</span><div class="kv">' + escapeHTML(value) + '</div>' + (hint ? '<div class="kh">' + escapeHTML(hint) + '</div>' : '') + '</div>';
  }

  function loadBarsHTML(model, plan) {
    const loads = plan.metrics.loadByResource;
    const people = model.resources.filter(r => r.active);
    if (!people.length) return '<div class="empty">' + T.emptyResources[lang()] + '</div>';
    const max = Math.max(1, ...people.map(r => loads[r.id] || 0));
    return people
      .map(r => ({ r, n: loads[r.id] || 0 }))
      .sort((a, b) => b.n - a.n || nameOf(model.resources, a.r.id).localeCompare(nameOf(model.resources, b.r.id)))
      .map(({ r, n }) =>
        '<div class="loadrow"><span class="ln" title="' + escapeHTML(nameOf(model.resources, r.id)) + '">' + escapeHTML(nameOf(model.resources, r.id)) + '</span>' +
        '<div class="bar"><i style="width:' + Math.round((n / max) * 100) + '%"></i></div>' +
        '<span class="lv">' + n + '</span></div>'
      ).join('');
  }

  function refText(model, refs) {
    if (!refs) return '';
    const parts = [];
    if (refs.resourceId) parts.push(nameOf(model.resources, refs.resourceId));
    if (refs.resourceIds) parts.push(refs.resourceIds.map(id => nameOf(model.resources, id)).join(' + '));
    if (refs.siteId) parts.push(nameOf(model.sites, refs.siteId));
    if (refs.date) parts.push(refs.date);
    if (refs.dates) parts.push(refs.dates.join(' \u2192 '));
    return parts.join(' \u00b7 ');
  }

  function violationsHTML(model, plan) {
    if (!plan.violations.length) return '<div class="empty">' + T.noViolations[lang()] + '</div>';
    const rows = plan.violations.slice().sort((a, b) => (a.severity === 'hard' ? 0 : 1) - (b.severity === 'hard' ? 0 : 1));
    return '<div class="tblwrap"><table class="sched summary-table"><thead><tr><th>' + T.severity[lang()] + '</th><th>' + T.issue[lang()] + '</th><th>' + T.details[lang()] + '</th></tr></thead><tbody>' +
      rows.map(v => {
        const rule = model.rules.find(r => r.id === v.ruleId);
        const type = rule && ruleType(rule.type);
        const label = type ? (type.label[lang()] || type.label.en) : v.code;
        const sev = v.severity === 'hard' ? 'hard' : 'soft';
        return '<tr><td><span class="sev ' + sev + '">' + (sev === 'hard' ? T.hard[lang()] : T.soft[lang()]) + '</span></td>' +
          '<td class="fname">' + escapeHTML(label) + '<div class="field-note" style="margin:2px 0 0">' + escapeHTML(v.msg ? (v.msg[lang()] || v.msg.en) : '') + '</div></td>' +
          '<td>' + escapeHTML(refText(model, v.refs)) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function ledgerHTML(plan) {
    const byDate = new Map();
    for (const eng of plan.engagements) byDate.set(eng.date, (byDate.get(eng.date) || 0) + 1);
    const dates = [...byDate.keys()].sort();
    if (!dates.length) return '<div class="empty">' + T.emptyPlanHint[lang()] + '</div>';
    return '<div class="chiprow">' + dates.map(d => '<span class="chip">' + d + ' \u00b7 ' + byDate.get(d) + '</span>').join('') + '</div>';
  }

  function render(container) {
    const model = store.state;
    const plan = getPlan();
    if (!plan) {
      container.innerHTML = '<div class="empty">' + (helpers.isSolving() ? T.solving[lang()] : T.emptyPlan[lang()]) + '</div>';
      return;
    }
    const hard = plan.violations.filter(v => v.severity === 'hard').length;
    const gini = plan.metrics.gini;
    const balance = gini < 0.1 ? T.balanceGood[lang()] : gini < 0.25 ? T.balanceOk[lang()] : T.balanceUneven[lang()];
    container.innerHTML =
      '<div class="summary-grid">' +
      kpi(T.coverage[lang()], Math.round(plan.metrics.coverage * 100) + '%', plan.metrics.filled + ' / ' + plan.metrics.totalNeeds, plan.metrics.coverage < 1) +
      kpi(T.openSlots[lang()], String(plan.openSlots.length), '', plan.openSlots.length > 0) +
      kpi(T.hardIssues[lang()], String(hard), '', hard > 0) +
      kpi(T.gini[lang()], gini.toFixed(2), balance, false) +
      '</div>' +
      '<section class="card" style="margin-bottom:14px"><h2 class="ctitle" style="font-size:18px;margin-bottom:14px">' + T.loadPerPerson[lang()] + '</h2>' + loadBarsHTML(model, plan) + '</section>' +
      '<section class="card" style="margin-bottom:14px"><h2 class="ctitle" style="font-size:18px;margin-bottom:12px">' + T.visitsPerDay[lang()] + '</h2>' + ledgerHTML(plan) + '</section>' +
      '<section class="card"><h2 class="ctitle" style="font-size:18px;margin-bottom:12px">' + T.violations[lang()] + '</h2>' + violationsHTML(model, plan) + '</section>';
  }

  return {
    mount(container) { render(container); },
    patch(container) { render(container); },
    onPlan(container) { render(container); },
    destroy() {}
  };
}
