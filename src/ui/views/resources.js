import { patchList, setValueIfNotFocused, toggleClass, h, escapeHTML } from '../render.js';
import { T } from '../i18n.js';
import { importResourcesCSV } from '../../core/io/csv-import.js';
import { armDelete, setName } from '../edit-helpers.js';

const DOW = { en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], ar: ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'] };

function uid() {
  return 'r_' + Math.random().toString(36).slice(2, 10);
}

export function create(helpers) {
  const { store, lang, requestSolve } = helpers;
  let listEl = null;
  let rootEl = null;

  function dispatchEdit(apply) {
    store.dispatch({ apply });
    requestSolve();
  }

  function editResource(id, fn) {
    dispatchEdit(m => { const r = m.resources.find(x => x.id === id); if (r) fn(r, m); return m; });
  }

  function roleChipsHTML(model, resource) {
    return model.roles.map(role => {
      const on = resource.roles.includes(role.id);
      return '<button type="button" class="chip' + (on ? '' : ' ghost') + '" aria-pressed="' + on + '" data-act="toggle-role" data-role="' + escapeHTML(role.id) + '">' + escapeHTML(role.name[lang()] || role.name.en) + '</button>';
    }).join('');
  }

  function weekdaysHTML(resource) {
    return resource.avail.weekdays.map((on, i) =>
      '<button type="button" class="wd' + (on ? ' on' : '') + '" aria-pressed="' + !!on + '" data-act="toggle-day" data-day="' + i + '">' + DOW[lang()][i] + '</button>'
    ).join('');
  }

  function createRow(resource) {
    const el = h('<article class="card entity-card res-row">' +
      '<div class="entity-top">' +
      '<input type="text" class="res-name grow" dir="auto" aria-label="' + escapeHTML(T.name[lang()]) + '" placeholder="' + escapeHTML(T.name[lang()]) + '">' +
      '<label class="toggle"><input type="checkbox" class="res-active">' + T.active[lang()] + '</label>' +
      '<button type="button" class="btn danger-ghost sm" data-act="remove-resource">' + T.delete[lang()] + '</button>' +
      '</div>' +
      '<div class="entity-sub">' +
      '<div><span class="sub-label">' + T.roles[lang()] + '</span><span class="chiprow res-roles" style="display:inline-flex;margin:0"></span></div>' +
      '<div><span class="sub-label">' + T.availability[lang()] + '</span><span class="wds res-days"></span></div>' +
      '</div></article>');

    const nameEl = el.querySelector('.res-name');
    nameEl.addEventListener('change', () => {
      editResource(el.dataset.key, r => setName(r, nameEl.value.trim(), lang()));
    });

    el.querySelector('.res-active').addEventListener('change', (e) => {
      editResource(el.dataset.key, r => { r.active = e.target.checked; });
    });

    el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const id = el.dataset.key;
      const act = btn.dataset.act;
      if (act === 'remove-resource') {
        armDelete(btn, lang(), () => dispatchEdit(m => {
          m.resources = m.resources.filter(x => x.id !== id);
          m.locks = m.locks.filter(l => l.resourceId !== id);
          return m;
        }));
      } else if (act === 'toggle-role') {
        const roleId = btn.dataset.role;
        const current = store.state.resources.find(x => x.id === id);
        if (current && current.roles.length === 1 && current.roles[0] === roleId) return;
        editResource(id, r => {
          r.roles = r.roles.includes(roleId) ? r.roles.filter(x => x !== roleId) : [...r.roles, roleId];
        });
      } else if (act === 'toggle-day') {
        const day = +btn.dataset.day;
        editResource(id, r => { r.avail.weekdays[day] = r.avail.weekdays[day] ? 0 : 1; });
      }
    });

    updateRow(el, resource);
    return el;
  }

  function updateRow(el, resource) {
    const model = store.state;
    const nameEl = el.querySelector('.res-name');
    setValueIfNotFocused(nameEl, resource.name[lang()] || resource.name.en || '');
    el.querySelector('.res-active').checked = resource.active;
    toggleClass(el, 'muted', !resource.active);
    el.querySelector('.res-roles').innerHTML = roleChipsHTML(model, resource);
    el.querySelector('.res-days').innerHTML = weekdaysHTML(resource);
  }

  function showImportMessage(text) {
    const errEl = rootEl.querySelector('#res-import-errors');
    if (errEl) errEl.textContent = text;
  }

  function render(container, full) {
    rootEl = container;
    const model = store.state;
    if (full) {
      container.innerHTML = '<section class="card" style="margin-bottom:14px">' +
        '<div class="list-head"><div><div class="kicker">' + escapeHTML(model.lexicon.resource[lang()] || model.lexicon.resource.en) + '</div><h2 class="ctitle"></h2></div>' +
        '<div class="btnrow">' +
        '<button type="button" class="btn" id="res-import-trigger">' + T.import[lang()] + ' CSV</button><input type="file" id="res-import" accept=".csv,text/csv" hidden>' +
        '<button type="button" class="btn primary" id="res-add">' + T.add[lang()] + '</button>' +
        '</div></div>' +
        '<p class="field-note">' + T.csvHintResources[lang()] + '</p>' +
        '<p class="form-error" id="res-import-errors" role="alert"></p>' +
        '</section><div id="res-list"></div>';
      container.querySelector('#res-add').addEventListener('click', () => {
        const id = uid();
        const m0 = store.state;
        const defaultRole = m0.roles[0] ? m0.roles[0].id : null;
        if (!defaultRole) { showImportMessage(T.needRole[lang()]); return; }
        dispatchEdit(m => {
          m.resources.push({
            id, name: { en: '', ar: '' }, roles: [defaultRole], tags: [],
            attrs: {}, avail: { weekdays: [1, 1, 1, 1, 1, 1, 1], off: [], only: [], patternId: null },
            caps: { maxPerDay: null, maxPerWeek: null, minRestDays: 0 }, prefs: [], weight: 1, active: true
          });
          return m;
        });
        requestAnimationFrame(() => {
          const row = listEl.querySelector('[data-key="' + id + '"] .res-name');
          if (row) { row.focus(); row.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        });
      });
      container.querySelector('#res-import-trigger').addEventListener('click', () => container.querySelector('#res-import').click());
      container.querySelector('#res-import').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onerror = () => showImportMessage(T.readError[lang()]);
        reader.onload = () => {
          const { resources, errors } = importResourcesCSV(store.state, String(reader.result || ''));
          const parts = errors.map(er => er.message[lang()] || er.message.en);
          if (resources.length) parts.unshift(T.imported[lang()](resources.length));
          else if (!errors.length) parts.push(T.nothingImported[lang()]);
          showImportMessage(parts.join(' \u00b7 '));
          if (resources.length) dispatchEdit(m => { m.resources.push(...resources); return m; });
        };
        reader.readAsText(file);
        e.target.value = '';
      });
      listEl = container.querySelector('#res-list');
    }
    const active = model.resources.filter(r => r.active).length;
    container.querySelector('.ctitle').textContent = T.countOf[lang()](model.resources.length, active);
    if (!model.resources.length) {
      listEl.innerHTML = '<div class="empty">' + T.emptyResources[lang()] + '</div>';
      return;
    }
    patchList(listEl, model.resources, { key: r => r.id, create: createRow, update: updateRow });
  }

  return {
    mount(container) { render(container, true); },
    patch(container) { render(container, false); },
    destroy() {}
  };
}
