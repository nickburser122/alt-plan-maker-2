import { patchList, setValueIfNotFocused, toggleClass, h, escapeHTML } from '../render.js';
import { T } from '../i18n.js';
import { importSitesCSV } from '../../core/io/csv-import.js';
import { armDelete, setName } from '../edit-helpers.js';

function uid() { return 's_' + Math.random().toString(36).slice(2, 10); }

export function create(helpers) {
  const { store, lang, requestSolve } = helpers;
  let listEl = null;
  let rootEl = null;

  function dispatchEdit(apply) {
    store.dispatch({ apply });
    requestSolve();
  }

  function editSite(id, fn) {
    dispatchEdit(m => { const s = m.sites.find(x => x.id === id); if (s) fn(s, m); return m; });
  }

  function hasKm(model) { return model.attributes.some(a => a.id === 'km'); }

  function classOptionsHTML(model, site) {
    return model.siteClasses.map(c =>
      '<option value="' + escapeHTML(c.id) + '"' + (c.id === site.classId ? ' selected' : '') + '>' + escapeHTML(c.name[lang()] || c.name.en) + (c.planned ? '' : ' \u00b7 ' + T.notPlanned[lang()]) + '</option>'
    ).join('');
  }

  function createRow(site) {
    const el = h('<article class="card entity-card site-row">' +
      '<div class="entity-top">' +
      '<input type="text" class="site-name grow" dir="auto" aria-label="' + escapeHTML(T.name[lang()]) + '" placeholder="' + escapeHTML(T.name[lang()]) + '">' +
      '<select class="site-class" aria-label="' + escapeHTML(T.colClass[lang()]) + '"></select>' +
      '<label class="toggle km-wrap"><span class="sub-label">km</span><input type="number" class="site-km" min="0" step="1" style="width:88px" aria-label="' + escapeHTML(T.distance[lang()]) + '"></label>' +
      '<label class="toggle"><input type="checkbox" class="site-active">' + T.active[lang()] + '</label>' +
      '<button type="button" class="btn danger-ghost sm" data-act="remove-site">' + T.delete[lang()] + '</button>' +
      '</div></article>');

    const nameEl = el.querySelector('.site-name');
    nameEl.addEventListener('change', () => editSite(el.dataset.key, s => setName(s, nameEl.value.trim(), lang())));
    el.querySelector('.site-class').addEventListener('change', (e) => editSite(el.dataset.key, s => { s.classId = e.target.value; }));
    el.querySelector('.site-km').addEventListener('change', (e) => {
      const v = Math.max(0, Number(e.target.value) || 0);
      e.target.value = v;
      editSite(el.dataset.key, s => { s.attrs = { ...(s.attrs || {}), km: v }; });
    });
    el.querySelector('.site-active').addEventListener('change', (e) => editSite(el.dataset.key, s => { s.active = e.target.checked; }));
    el.querySelector('[data-act="remove-site"]').addEventListener('click', (e) => {
      const id = el.dataset.key;
      armDelete(e.currentTarget, lang(), () => dispatchEdit(m => { m.sites = m.sites.filter(x => x.id !== id); return m; }));
    });

    updateRow(el, site);
    return el;
  }

  function updateRow(el, site) {
    const model = store.state;
    setValueIfNotFocused(el.querySelector('.site-name'), site.name[lang()] || site.name.en || '');
    const classEl = el.querySelector('.site-class');
    if (document.activeElement !== classEl) classEl.innerHTML = classOptionsHTML(model, site);
    const kmWrap = el.querySelector('.km-wrap');
    kmWrap.hidden = !hasKm(model);
    const kmEl = el.querySelector('.site-km');
    if (document.activeElement !== kmEl) kmEl.value = site.attrs?.km ?? 0;
    el.querySelector('.site-active').checked = site.active;
    toggleClass(el, 'muted', !site.active);
  }

  function showImportMessage(text) {
    const errEl = rootEl.querySelector('#site-import-errors');
    if (errEl) errEl.textContent = text;
  }

  function render(container, full) {
    rootEl = container;
    const model = store.state;
    if (full) {
      container.innerHTML = '<section class="card" style="margin-bottom:14px">' +
        '<div class="list-head"><div><div class="kicker">' + escapeHTML(model.lexicon.site[lang()] || model.lexicon.site.en) + '</div><h2 class="ctitle"></h2></div>' +
        '<div class="btnrow">' +
        '<button type="button" class="btn" id="site-import-trigger">' + T.import[lang()] + ' CSV</button><input type="file" id="site-import" accept=".csv,text/csv" hidden>' +
        '<button type="button" class="btn primary" id="site-add">' + T.add[lang()] + '</button>' +
        '</div></div>' +
        '<p class="field-note">' + T.csvHintSites[lang()] + '</p>' +
        '<p class="form-error" id="site-import-errors" role="alert"></p>' +
        '</section><div id="site-list"></div>';
      container.querySelector('#site-add').addEventListener('click', () => {
        const id = uid();
        const m0 = store.state;
        const cls = m0.siteClasses.find(c => c.planned) || m0.siteClasses[0];
        if (!cls) { showImportMessage(T.needClass[lang()]); return; }
        dispatchEdit(m => {
          m.sites.push({ id, name: { en: '', ar: '' }, classId: cls.id, tags: [], attrs: hasKm(m) ? { km: 0 } : {}, weight: 1, active: true, cadence: { minGapDays: 0, targetPerHorizon: null, maxPerHorizon: null } });
          return m;
        });
        requestAnimationFrame(() => {
          const row = listEl.querySelector('[data-key="' + id + '"] .site-name');
          if (row) { row.focus(); row.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        });
      });
      container.querySelector('#site-import-trigger').addEventListener('click', () => container.querySelector('#site-import').click());
      container.querySelector('#site-import').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onerror = () => showImportMessage(T.readError[lang()]);
        reader.onload = () => {
          const { sites, errors } = importSitesCSV(store.state, String(reader.result || ''));
          const parts = errors.map(er => er.message[lang()] || er.message.en);
          if (sites.length) parts.unshift(T.imported[lang()](sites.length));
          else if (!errors.length) parts.push(T.nothingImported[lang()]);
          showImportMessage(parts.join(' \u00b7 '));
          if (sites.length) dispatchEdit(m => { m.sites.push(...sites); return m; });
        };
        reader.readAsText(file);
        e.target.value = '';
      });
      listEl = container.querySelector('#site-list');
    }
    const active = model.sites.filter(s => s.active).length;
    container.querySelector('.ctitle').textContent = T.countOf[lang()](model.sites.length, active);
    if (!model.sites.length) {
      listEl.innerHTML = '<div class="empty">' + T.emptySites[lang()] + '</div>';
      return;
    }
    patchList(listEl, model.sites, { key: s => s.id, create: createRow, update: updateRow });
  }

  return {
    mount(container) { render(container, true); },
    patch(container) { render(container, false); },
    destroy() {}
  };
}
