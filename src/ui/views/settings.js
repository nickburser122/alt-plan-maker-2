import { T } from '../i18n.js';
import { escapeHTML as esc } from '../render.js';
import { validateModel } from '../../core/schema.js';
import { armDelete } from '../edit-helpers.js';

function uid(prefix) { return prefix + '_' + Math.random().toString(36).slice(2, 10); }
const LEX_KEYS = {
  en: { resource: 'Person', site: 'Place', engagement: 'Duty', run: 'Run' },
  ar: { resource: 'الفرد', site: 'المكان', engagement: 'المهمة', run: 'السلسلة' }
};
const DAYS = { en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], ar: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'] };

export function create(helpers) {
  const { store, lang, requestSolve } = helpers;
  let containerEl;

  function text(en, ar) { return lang() === 'ar' ? ar : en; }
  function dispatchEdit(apply) {
    const errEl = containerEl && containerEl.querySelector('#settings-error');
    if (errEl) errEl.textContent = '';
    store.dispatch({ apply });
    requestSolve();
  }
  function error(message) {
    const el = containerEl.querySelector('#settings-error');
    if (!el) return;
    el.textContent = message;
    if (message) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function input(id, field, value, label, extra = '') {
    return '<label class="field-stack"><span>' + label + '</span><input type="text" data-item="' + esc(id) + '" data-field="' + field + '" value="' + esc(value) + '" ' + extra + '></label>';
  }
  function lexiconHTML(model) {
    return ['resource', 'site', 'engagement', 'run'].map(key =>
      '<div class="form-row"><strong class="field-key">' + esc(LEX_KEYS[lang()][key]) + '</strong>' +
      input(key, 'lex-en', model.lexicon[key].en, 'English') +
      input(key, 'lex-ar', model.lexicon[key].ar, 'العربية', 'dir="rtl"') + '</div>'
    ).join('');
  }
  function rolesHTML(model) {
    return model.roles.map(role =>
      '<div class="form-row entity-row">' +
      input(role.id, 'role-en', role.name.en, 'English') +
      input(role.id, 'role-ar', role.name.ar, 'العربية', 'dir="rtl"') +
      '<button type="button" class="btn ghost" data-remove="role" data-id="' + esc(role.id) + '" aria-label="' + esc(text('Remove role', 'حذف الدور')) + '">' + T.delete[lang()] + '</button></div>'
    ).join('');
  }
  function attributesHTML(model) {
    return model.attributes.map(attr =>
      '<div class="form-row entity-row">' + input(attr.id, 'attr-en', attr.label.en, 'English') +
      input(attr.id, 'attr-ar', attr.label.ar || '', 'العربية', 'dir="rtl"') +
      '<span class="chip">' + esc(attr.unit) + '</span>' +
      '<button type="button" class="btn ghost" data-remove="attr" data-id="' + esc(attr.id) + '">' + T.delete[lang()] + '</button></div>'
    ).join('') || '<p class="field-note">' + text('Optional measurements for advanced rules.', 'قياسات اختيارية للقواعد المتقدمة.') + '</p>';
  }
  function siteClassesHTML(model) {
    return model.siteClasses.map(cls =>
      '<div class="entity-row class-editor">' +
      '<div class="form-row">' + input(cls.id, 'class-en', cls.name.en, 'English') +
      input(cls.id, 'class-ar', cls.name.ar || '', 'العربية', 'dir="rtl"') +
      '<label class="check-label"><input type="checkbox" data-item="' + esc(cls.id) + '" data-field="planned"' + (cls.planned ? ' checked' : '') + '> ' + T.active[lang()] + '</label>' +
      '<button type="button" class="btn ghost" data-remove="class" data-id="' + esc(cls.id) + '">' + T.delete[lang()] + '</button></div>' +
      '<div class="form-row">' + model.roles.map(role => {
        const demand = cls.demand.find(d => d.roleId === role.id);
        return '<label class="field-stack"><span>' + esc(role.name[lang()] || role.name.en) + ' · ' + text('Minimum', 'الحد الأدنى') + '</span>' +
          '<input type="number" min="0" max="50" step="1" data-item="' + esc(cls.id) + '" data-role="' + esc(role.id) + '" data-field="demand" value="' + (demand?.min ?? 0) + '"></label>';
      }).join('') + '</div></div>'
    ).join('');
  }
  function calendarHTML(model) {
    const horizon = model.calendar.horizon;
    return '<div class="form-row">' +
      '<label class="field-stack"><span>' + text('Start date', 'تاريخ البدء') + '</span><input type="date" data-calendar="start" value="' + esc(horizon.start || '') + '"></label>' +
      '<label class="field-stack"><span>' + text('End date', 'تاريخ الانتهاء') + '</span><input type="date" data-calendar="end" value="' + esc(horizon.end || '') + '"></label></div>' +
      '<p class="field-note">' + text('Set how many sites to cover on each weekday.', 'حدد عدد المواقع المطلوب تغطيتها في كل يوم من الأسبوع.') + '</p>' +
      '<div class="weekday-grid">' + model.calendar.weekdayDefaults.map((config, day) =>
        '<label class="field-stack"><span>' + DAYS[lang()][day] + '</span><input type="number" min="0" max="50" step="1" data-weekday="' + day + '" value="' + (config.on ? config.blocks.reduce((total, block) => total + (Number(block.slots) || 0), 0) : 0) + '"></label>'
      ).join('') + '</div>';
  }
  function engineHTML(model) {
    return '<div class="form-row">' + [['seed', 'Seed'], ['restarts', text('Restarts', 'إعادات المحاولة')], ['lnsIterations', text('Iterations', 'التكرارات')]].map(([key, label]) =>
      '<label class="field-stack"><span>' + label + '</span><input type="number" min="' + (key === 'seed' ? 0 : 1) + '" max="' + (key === 'lnsIterations' ? 500 : 100) + '" step="1" data-engine="' + key + '" value="' + esc(model.engine[key]) + '"></label>'
    ).join('') + '<label class="field-stack"><span>' + text('Constraint mode', 'وضع القيود') + '</span><select data-engine="relaxMode"><option value="relaxed"' + (model.engine.relaxMode === 'relaxed' ? ' selected' : '') + '>' + text('Relaxed', 'مرن') + '</option><option value="strict"' + (model.engine.relaxMode === 'strict' ? ' selected' : '') + '>' + text('Strict', 'صارم') + '</option></select></label></div>';
  }
  function section(title, body, action = '') {
    return '<section class="card settings-section"><div class="card-head"><h2 class="ctitle">' + title + '</h2>' + action + '</div>' + body + '</section>';
  }
  function focusKey(el) {
    if (!el || !containerEl || !containerEl.contains(el)) return null;
    for (const attr of ['data-field', 'data-calendar', 'data-weekday', 'data-engine', 'data-add', 'data-remove', 'id']) {
      if (el.hasAttribute(attr)) {
        let sel = '[' + attr + '="' + CSS.escape(el.getAttribute(attr)) + '"]';
        if (el.hasAttribute('data-item')) sel += '[data-item="' + CSS.escape(el.getAttribute('data-item')) + '"]';
        if (el.hasAttribute('data-id')) sel += '[data-id="' + CSS.escape(el.getAttribute('data-id')) + '"]';
        if (el.hasAttribute('data-role')) sel += '[data-role="' + CSS.escape(el.getAttribute('data-role')) + '"]';
        return sel;
      }
    }
    return null;
  }
  function render(container) {
    const selector = focusKey(document.activeElement);
    containerEl = container;
    const model = store.state;
    const previousError = container.querySelector('#settings-error')?.textContent || '';
    container.innerHTML =
      section(T.navSettings[lang()], '<p class="field-note">' + text('Adjust the workspace and save a backup of your model.', 'اضبط مساحة العمل واحتفظ بنسخة احتياطية من النموذج.') + '</p><button type="button" class="btn" id="set-onboard">' + T.reopenWizard[lang()] + '</button>') +
      '<p class="notice" id="settings-error" role="alert"></p>' +
      section(T.lexicon[lang()], lexiconHTML(model)) +
      section(T.roles[lang()], rolesHTML(model), '<button type="button" class="btn" data-add="role">' + T.add[lang()] + '</button>') +
      section(T.attributes[lang()], attributesHTML(model), '<button type="button" class="btn" data-add="attr">' + T.add[lang()] + '</button>') +
      section(T.siteClasses[lang()], siteClassesHTML(model), '<button type="button" class="btn" data-add="class">' + T.add[lang()] + '</button>') +
      section(text('Calendar & coverage', 'التقويم والتغطية'), calendarHTML(model)) +
      section(T.engine[lang()], engineHTML(model)) +
      section(T.data[lang()], '<div class="form-row"><button type="button" class="btn" id="set-export">' + T.export[lang()] + '</button><button type="button" class="btn" id="set-import-trigger">' + T.import[lang()] + '</button><input type="file" id="set-import" accept=".json,application/json" hidden><div class="grow"></div><button type="button" class="btn danger-ghost" id="set-reset">' + text('Start over', 'البدء من جديد') + '</button></div><p class="field-note">' + text('Export saves everything as a JSON file you can import later or on another device.', 'التصدير يحفظ كل شيء في ملف JSON يمكن استيراده لاحقًا أو على جهاز آخر.') + '</p>');
    container.querySelector('#settings-error').textContent = previousError;
    if (selector) {
      const target = container.querySelector(selector);
      if (target) target.focus({ preventScroll: true });
    }
  }
  function exportJSON() {
    const blob = new Blob([JSON.stringify(store.state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mauvine-rota-model.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function importJSON(file) {
    const reader = new FileReader();
    reader.onerror = () => error(text('Could not read the selected file.', 'تعذرت قراءة الملف المحدد.'));
    reader.onload = () => {
      let parsed;
      try { parsed = JSON.parse(reader.result); }
      catch { error(text('Invalid JSON file.', 'ملف JSON غير صالح.')); return; }
      const errors = validateModel(parsed);
      if (errors.length) { error(errors.slice(0, 4).join(' · ')); return; }
      error('');
      const ui = store.state.ui;
      dispatchEdit(() => ({ ...parsed, ui: { ...(parsed.ui || {}), lang: ui.lang, view: 'settings' } }));
    };
    reader.readAsText(file);
  }
  function editField(el) {
    const id = el.dataset.item;
    const field = el.dataset.field;
    if (!field) return false;
    if (field === 'planned') {
      dispatchEdit(m => { m.siteClasses.find(c => c.id === id).planned = el.checked; return m; });
      return true;
    }
    if (field === 'demand') {
      const n = Math.max(0, Math.min(50, Math.floor(Number(el.value) || 0)));
      dispatchEdit(m => {
        const cls = m.siteClasses.find(c => c.id === id);
        const demand = cls.demand.find(d => d.roleId === el.dataset.role);
        if (demand) { demand.min = n; demand.max = Math.max(n, demand.max); }
        else cls.demand.push({ roleId: el.dataset.role, min: n, max: n });
        return m;
      });
      return true;
    }
    const group = field.split('-')[0], language = field.split('-')[1];
    dispatchEdit(m => {
      if (group === 'lex') m.lexicon[id][language] = el.value;
      if (group === 'role') m.roles.find(r => r.id === id).name[language] = el.value;
      if (group === 'class') m.siteClasses.find(c => c.id === id).name[language] = el.value;
      if (group === 'attr') m.attributes.find(a => a.id === id).label[language] = el.value;
      return m;
    });
    return true;
  }
  function handleChange(event) {
    const el = event.target;
    if (el.dataset.field) { editField(el); return; }
    if (el.dataset.calendar) {
      const key = el.dataset.calendar;
      const other = store.state.calendar.horizon[key === 'start' ? 'end' : 'start'];
      if (!el.value || (key === 'start' ? el.value > other : el.value < other)) {
        error(text('The end date must not be before the start date.', 'يجب ألا يسبق تاريخ الانتهاء تاريخ البدء.'));
        el.value = store.state.calendar.horizon[key];
        return;
      }
      dispatchEdit(m => { m.calendar.horizon[key] = el.value; return m; });
      return;
    }
    if (el.dataset.weekday !== undefined) {
      const day = Number(el.dataset.weekday);
      const slots = Math.max(0, Math.min(50, Math.floor(Number(el.value) || 0)));
      dispatchEdit(m => {
        const config = m.calendar.weekdayDefaults[day];
        config.on = slots > 0;
        const blockId = config.blocks[0]?.blockId || m.calendar.blocks[0].id;
        config.blocks = slots ? [{ blockId, slots, bias: 'auto' }] : [];
        return m;
      });
      return;
    }
    if (el.dataset.engine) {
      const key = el.dataset.engine;
      const value = key === 'relaxMode' ? el.value : Math.max(key === 'seed' ? 0 : 1, Math.min(key === 'lnsIterations' ? 500 : 100, Math.floor(Number(el.value) || 0)));
      dispatchEdit(m => { m.engine[key] = value; return m; });
      return;
    }
    if (el.id === 'set-import' && el.files[0]) { importJSON(el.files[0]); el.value = ''; }
  }
  function handleClick(event) {
    const btn = event.target.closest('button');
    if (!btn || !containerEl.contains(btn)) return;
    if (btn.id === 'set-onboard') { helpers.openOnboarding(); return; }
    if (btn.id === 'set-export') { exportJSON(); return; }
    if (btn.id === 'set-import-trigger') { containerEl.querySelector('#set-import').click(); return; }
    if (btn.id === 'set-reset') { armDelete(btn, lang(), () => helpers.openOnboarding()); return; }
    if (btn.dataset.add === 'role') {
      dispatchEdit(m => { m.roles.push({ id: uid('r'), name: { en: 'New role', ar: 'دور جديد' }, short: 'R', color: '--role-1' }); return m; });
    } else if (btn.dataset.add === 'attr') {
      dispatchEdit(m => { m.attributes.push({ id: uid('attr'), label: { en: 'New attribute', ar: 'سمة جديدة' }, unit: '', domain: [0, 999], agg: 'sum' }); return m; });
    } else if (btn.dataset.add === 'class') {
      const roleId = store.state.roles[0]?.id;
      if (!roleId) { error(text('Add a role first.', 'أضف دورًا أولًا.')); return; }
      dispatchEdit(m => { m.siteClasses.push({ id: uid('c'), name: { en: 'New site class', ar: 'فئة مواقع جديدة' }, planned: true, demand: [{ roleId, min: 1, max: 1 }], runLength: 1, cohesion: 'full' }); return m; });
    } else if (btn.dataset.remove) {
      const id = btn.dataset.id;
      const m = store.state;
      if (btn.dataset.remove === 'role') {
        if (m.roles.length < 2 || m.resources.some(r => r.roles.includes(id)) || m.siteClasses.some(c => c.demand.some(d => d.roleId === id))) {
          error(text('This role is in use. Remove its assignments first.', 'هذا الدور قيد الاستخدام. أزل ارتباطاته أولًا.')); return;
        }
        dispatchEdit(next => { next.roles = next.roles.filter(r => r.id !== id); return next; });
      } else if (btn.dataset.remove === 'attr') {
        if (m.resources.some(r => id in r.attrs || r.prefs.some(p => p.attr === id)) || m.sites.some(s => id in s.attrs) || m.rules.some(r => r.params?.attr === id)) {
          error(text('This attribute is in use.', 'هذه السمة قيد الاستخدام.')); return;
        }
        dispatchEdit(next => { next.attributes = next.attributes.filter(a => a.id !== id); return next; });
      } else if (btn.dataset.remove === 'class') {
        if (m.siteClasses.length < 2 || m.sites.some(s => s.classId === id)) {
          error(text('This site class is in use. Reassign its sites first.', 'فئة المواقع هذه قيد الاستخدام. غيّر تصنيف مواقعها أولًا.')); return;
        }
        dispatchEdit(next => { next.siteClasses = next.siteClasses.filter(c => c.id !== id); return next; });
      }
    }
  }
  return {
    mount(container) { render(container); container.addEventListener('change', handleChange); container.addEventListener('click', handleClick); },
    patch(container) { render(container); },
    destroy() { containerEl?.removeEventListener('change', handleChange); containerEl?.removeEventListener('click', handleClick); }
  };
}
