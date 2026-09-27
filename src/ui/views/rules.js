import { patchList, h, escapeHTML } from '../render.js';
import { T } from '../i18n.js';
import { RULE_TYPE_LIST, ruleType } from '../../core/rules/registry.js';
import { rulePreview } from '../rule-preview.js';
import { armDelete } from '../edit-helpers.js';

function uid() { return 'rule_' + Math.random().toString(36).slice(2, 10); }

const CATEGORY_OF = {
  'max-per-day': 'resource', 'max-per-window': 'resource', 'min-rest-days': 'resource',
  'max-consecutive-days': 'resource', 'min-consecutive-days': 'resource', 'weekday-limit': 'resource',
  'unavailable-dates': 'resource', 'role-qualification': 'resource', 'pairing': 'resource',
  'separation': 'resource', 'cap-by-tag': 'resource',
  'distinct-sites-per-day': 'site', 'site-min-gap': 'site', 'site-target-count': 'site',
  'site-required-tag': 'site', 'coverage-all-active': 'site',
  'crew-cohesion': 'crew', 'crew-rotation': 'crew', 'crew-size-bounds': 'crew',
  'attribute-window': 'attribute', 'attribute-cap': 'attribute', 'attribute-affinity': 'attribute'
};
const CATEGORIES = ['resource', 'site', 'crew', 'attribute'];
const CATEGORY_LABEL = {
  resource: { en: 'People rules', ar: 'قواعد الأفراد' },
  site: { en: 'Site rules', ar: 'قواعد المواقع' },
  crew: { en: 'Crew rules', ar: 'قواعد الفريق' },
  attribute: { en: 'Attribute rules', ar: 'قواعد السمات' }
};

function defaultParams(model, meta) {
  const params = {};
  for (const p of meta.params) {
    if (p.type === 'role') params[p.key] = model.roles[0]?.id ?? null;
    else if (p.type === 'resource') params[p.key] = null;
    else if (p.type === 'attribute') params[p.key] = model.attributes.some(a => a.id === p.def) ? p.def : (model.attributes[0]?.id ?? p.def);
    else if (p.type === 'dateList') params[p.key] = [];
    else params[p.key] = p.def;
  }
  return params;
}

export function create(helpers) {
  const { store, lang, requestSolve } = helpers;
  let listEl = null;

  function dispatchEdit(apply) {
    store.dispatch({ apply });
    requestSolve();
  }

  function editRule(id, fn) {
    dispatchEdit(m => { const r = m.rules.find(x => x.id === id); if (r) fn(r, m); return m; });
  }

  function label(key) {
    const entry = T.paramLabels[key];
    return entry ? (entry[lang()] || entry.en) : key;
  }

  function optionList(items, selected, placeholder) {
    return (placeholder ? '<option value="">' + escapeHTML(placeholder) + '</option>' : '') +
      items.map(([value, text]) => '<option value="' + escapeHTML(value) + '"' + (value === selected ? ' selected' : '') + '>' + escapeHTML(text) + '</option>').join('');
  }

  function paramInputsHTML(rule) {
    const model = store.state;
    const type = ruleType(rule.type);
    if (!type || !type.params.length) return '';
    return type.params.map(p => {
      const val = rule.params?.[p.key];
      const head = '<label class="param-field"><span>' + escapeHTML(label(p.key)) + '</span>';
      if (p.key === 'weekday') {
        return head + '<select data-param="weekday" data-kind="int">' + optionList(T.weekdayNames[lang()].map((n, i) => [String(i), n]), String(val ?? p.def)) + '</select></label>';
      }
      if (p.type === 'int' || p.type === 'number') {
        return head + '<input type="number" data-param="' + p.key + '" data-kind="' + p.type + '" value="' + escapeHTML(val ?? p.def) + '"' +
          (p.min != null ? ' min="' + p.min + '"' : '') + (p.max != null ? ' max="' + p.max + '"' : '') + ' step="' + (p.type === 'int' ? 1 : 'any') + '" style="width:96px"></label>';
      }
      if (p.type === 'string') {
        return head + '<input type="text" data-param="' + p.key + '" data-kind="string" value="' + escapeHTML(val ?? '') + '" style="width:150px"></label>';
      }
      if (p.type === 'role') {
        return head + '<select data-param="' + p.key + '" data-kind="ref">' + optionList(model.roles.map(r => [r.id, r.name[lang()] || r.name.en]), val, T.select[lang()]) + '</select></label>';
      }
      if (p.type === 'resource') {
        return head + '<select data-param="' + p.key + '" data-kind="ref">' + optionList(model.resources.map(r => [r.id, r.name[lang()] || r.name.en || T.unnamed[lang()]]), val, T.select[lang()]) + '</select></label>';
      }
      if (p.type === 'attribute') {
        return head + '<select data-param="' + p.key + '" data-kind="ref">' + optionList(model.attributes.map(a => [a.id, a.label[lang()] || a.label.en]), val, model.attributes.length ? null : T.select[lang()]) + '</select></label>';
      }
      if (p.type === 'dateList') {
        const dates = Array.isArray(val) ? val.slice().sort() : [];
        return '<div class="param-field"><span>' + escapeHTML(label(p.key)) + '</span><div class="date-chips">' +
          dates.map(d => '<span class="date-chip">' + escapeHTML(d) + '<button type="button" data-remove-date="' + escapeHTML(d) + '" data-param-key="' + p.key + '" aria-label="Remove ' + escapeHTML(d) + '">\u00d7</button></span>').join('') +
          '<input type="date" data-add-date="' + p.key + '" aria-label="' + escapeHTML(T.addDate[lang()]) + '" style="width:auto"></div></div>';
      }
      return '';
    }).join('');
  }

  function createRow(rule) {
    const el = h('<article class="card rule-card rule-row">' +
      '<div class="entity-top">' +
      '<div class="grow"><div class="rule-title"></div><div class="rule-preview"></div></div>' +
      '<button type="button" class="btn danger-ghost sm" data-act="remove-rule">' + T.delete[lang()] + '</button>' +
      '</div>' +
      '<div class="rule-controls">' +
      '<div class="seg mini rule-severity" role="group" aria-label="' + escapeHTML(T.severity[lang()]) + '">' +
      '<button type="button" data-sev="hard">' + T.hard[lang()] + '</button>' +
      '<button type="button" data-sev="soft">' + T.soft[lang()] + '</button>' +
      '<button type="button" data-sev="off">' + T.off[lang()] + '</button>' +
      '</div>' +
      '<label class="weight-ctl"><span class="sub-label">' + T.weight[lang()] + '</span>' +
      '<input type="range" class="rng rule-weight" min="0" max="100" step="5"><output></output></label>' +
      '</div>' +
      '<div class="rule-params"></div>' +
      '</article>');

    el.querySelector('.rule-severity').addEventListener('click', (e) => {
      const b = e.target.closest('[data-sev]');
      if (!b) return;
      const sev = b.dataset.sev;
      editRule(el.dataset.key, r => { r.severity = sev; r.enabled = sev !== 'off'; });
    });

    const weightEl = el.querySelector('.rule-weight');
    weightEl.addEventListener('input', () => {
      el.querySelector('.weight-ctl output').textContent = weightEl.value;
      weightEl.style.setProperty('--fill', weightEl.value + '%');
    });
    weightEl.addEventListener('change', () => {
      const v = +weightEl.value;
      editRule(el.dataset.key, r => { r.weight = v; });
    });

    const paramsEl = el.querySelector('.rule-params');
    paramsEl.addEventListener('change', (e) => {
      const inp = e.target;
      const id = el.dataset.key;
      if (inp.dataset.addDate) {
        const key = inp.dataset.addDate;
        const value = inp.value;
        if (!value) return;
        editRule(id, r => {
          const list = Array.isArray(r.params[key]) ? r.params[key] : [];
          if (!list.includes(value)) r.params[key] = [...list, value].sort();
        });
        return;
      }
      if (!inp.dataset.param) return;
      const key = inp.dataset.param;
      const kind = inp.dataset.kind;
      const meta = ruleType(store.state.rules.find(r => r.id === id)?.type)?.params.find(p => p.key === key);
      let v = inp.value;
      if (kind === 'int' || kind === 'number') {
        v = Number(v);
        if (!Number.isFinite(v)) v = meta?.def ?? 0;
        if (kind === 'int') v = Math.round(v);
        if (meta?.min != null) v = Math.max(meta.min, v);
        if (meta?.max != null) v = Math.min(meta.max, v);
        if (inp.type === 'number') inp.value = v;
      } else if (kind === 'ref') {
        v = v || null;
      }
      editRule(id, r => { r.params = { ...(r.params || {}), [key]: v }; });
    });
    paramsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-remove-date]');
      if (!btn) return;
      const date = btn.dataset.removeDate;
      const key = btn.dataset.paramKey;
      editRule(el.dataset.key, r => { r.params[key] = (r.params[key] || []).filter(d => d !== date); });
    });

    el.querySelector('[data-act="remove-rule"]').addEventListener('click', (e) => {
      const id = el.dataset.key;
      armDelete(e.currentTarget, lang(), () => dispatchEdit(m => { m.rules = m.rules.filter(x => x.id !== id); return m; }));
    });

    updateRow(el, rule);
    return el;
  }

  function updateRow(el, rule) {
    const type = ruleType(rule.type);
    const severity = rule.enabled ? rule.severity : 'off';
    el.querySelector('.rule-title').textContent = type ? (type.label[lang()] || type.label.en) : rule.type;
    el.querySelector('.rule-preview').textContent = rulePreview(rule, lang(), store.state);
    el.classList.toggle('muted', severity === 'off');
    for (const b of el.querySelectorAll('.rule-severity [data-sev]')) {
      b.classList.toggle('on', b.dataset.sev === severity);
      b.setAttribute('aria-pressed', String(b.dataset.sev === severity));
    }
    const weightEl = el.querySelector('.rule-weight');
    const weightWrap = el.querySelector('.weight-ctl');
    weightWrap.classList.toggle('disabled', severity !== 'soft');
    weightWrap.title = severity === 'soft' ? '' : T.weightHint[lang()];
    if (document.activeElement !== weightEl) {
      weightEl.value = rule.weight;
      weightEl.style.setProperty('--fill', rule.weight + '%');
      el.querySelector('.weight-ctl output').textContent = rule.weight;
    }
    const paramsEl = el.querySelector('.rule-params');
    if (!paramsEl.contains(document.activeElement)) paramsEl.innerHTML = paramInputsHTML(rule);
  }

  function render(container, full) {
    const model = store.state;
    if (full) {
      const options = CATEGORIES.map(cat =>
        '<optgroup label="' + escapeHTML(CATEGORY_LABEL[cat][lang()]) + '">' +
        RULE_TYPE_LIST.filter(id => (CATEGORY_OF[id] || 'resource') === cat).map(id => {
          const type = ruleType(id);
          return '<option value="' + id + '">' + escapeHTML(type.label[lang()] || type.label.en) + '</option>';
        }).join('') + '</optgroup>'
      ).join('');
      container.innerHTML = '<section class="card" style="margin-bottom:14px">' +
        '<div class="list-head"><div><div class="kicker">' + T.navRules[lang()] + '</div><h2 class="ctitle"></h2></div>' +
        '<div class="rule-add-row"><select id="rule-type-pick" aria-label="' + escapeHTML(T.addRule[lang()]) + '">' + options + '</select>' +
        '<button type="button" class="btn primary" id="rule-add">' + T.addRule[lang()] + '</button></div></div>' +
        '<p class="field-note">' + T.rulesHint[lang()] + '</p>' +
        '</section><div id="rule-list"></div>';
      container.querySelector('#rule-add').addEventListener('click', () => {
        const type = container.querySelector('#rule-type-pick').value;
        const meta = ruleType(type);
        const id = uid();
        dispatchEdit(m => {
          m.rules.push({ id, type, enabled: true, severity: 'hard', weight: 100, scope: { roles: [], tags: [], resources: [] }, params: defaultParams(m, meta) });
          return m;
        });
        requestAnimationFrame(() => {
          const row = listEl.querySelector('[data-key="' + id + '"]');
          if (row) row.scrollIntoView({ block: 'center', behavior: 'smooth' });
        });
      });
      listEl = container.querySelector('#rule-list');
    }
    const enforced = model.rules.filter(r => r.enabled && r.severity !== 'off').length;
    container.querySelector('.ctitle').textContent = T.rulesCount[lang()](model.rules.length, enforced);
    if (!model.rules.length) {
      listEl.innerHTML = '<div class="empty">' + T.emptyRules[lang()] + '</div>';
      return;
    }
    const groups = { resource: [], site: [], crew: [], attribute: [] };
    for (const r of model.rules) (groups[CATEGORY_OF[r.type]] || groups.resource).push(r);
    if (!listEl.querySelector('[data-cat]')) {
      listEl.innerHTML = CATEGORIES.map(cat =>
        '<section data-cat-wrap="' + cat + '"><h3 class="cat-title">' + CATEGORY_LABEL[cat][lang()] + '</h3><div data-cat="' + cat + '"></div></section>'
      ).join('');
    }
    for (const cat of CATEGORIES) {
      listEl.querySelector('[data-cat-wrap="' + cat + '"]').hidden = !groups[cat].length;
      patchList(listEl.querySelector('[data-cat="' + cat + '"]'), groups[cat], { key: r => r.id, create: createRow, update: updateRow });
    }
  }

  return {
    mount(container) { render(container, true); },
    patch(container) { render(container, false); },
    destroy() {}
  };
}
