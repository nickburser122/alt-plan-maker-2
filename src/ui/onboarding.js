import { PRESETS } from '../core/presets.js';

const STR = {
  en: {
    title: 'Set up your rota', step1: 'Choose a starting point', step2: 'Name your entities', step3: 'Name your roles',
    skip: 'Skip', back: 'Back', next: 'Next', finish: 'Finish', close: 'Close', step: 'Step',
    hint2: 'These words are used across the app. You can change them later in Settings.',
    hint3: 'Rename the roles people can take. You can add more later in Settings.',
    keys: { resource: 'Person', site: 'Place', engagement: 'Duty', run: 'Run' }
  },
  ar: {
    title: 'إعداد الجدول', step1: 'اختر نقطة بداية', step2: 'سمِّ عناصرك', step3: 'سمِّ أدوارك',
    skip: 'تخطي', back: 'رجوع', next: 'التالي', finish: 'إنهاء', close: 'إغلاق', step: 'الخطوة',
    hint2: 'تُستخدم هذه الكلمات في التطبيق. يمكنك تغييرها لاحقًا من الإعدادات.',
    hint3: 'أعد تسمية الأدوار. يمكنك إضافة المزيد لاحقًا من الإعدادات.',
    keys: { resource: 'الفرد', site: 'المكان', engagement: 'المهمة', run: 'السلسلة' }
  }
};

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

export function openOnboarding(store, { onDone, onSkip } = {}) {
  const lang = () => store.state.ui.lang === 'ar' ? 'ar' : 'en';
  const s = () => STR[lang()];
  const previousFocus = document.activeElement;

  let step = 0;
  let model = null;
  let roleDrafts = [];

  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  const modal = document.createElement('div');
  modal.className = 'modal onboarding';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'onboarding-title');
  modal.dir = lang() === 'ar' ? 'rtl' : 'ltr';
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.documentElement.classList.add('modal-open');

  function close() {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    document.documentElement.classList.remove('modal-open');
    if (previousFocus && previousFocus.focus && previousFocus.isConnected) previousFocus.focus();
  }

  function skip() {
    close();
    if (onSkip) onSkip();
  }

  function pickPreset(id) {
    const preset = PRESETS.find(p => p.id === id);
    const today = new Date();
    const iso = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    model = preset.build(iso);
    model.ui = { ...model.ui, lang: lang(), view: 'plan' };
    roleDrafts = model.roles.map(r => ({ id: r.id, en: r.name.en, ar: r.name.ar }));
    step = 1;
    render();
  }

  function collectLexicon() {
    for (const key of ['resource', 'site', 'engagement', 'run']) {
      const enEl = modal.querySelector('[data-lex="' + key + '"][data-l="en"]');
      const arEl = modal.querySelector('[data-lex="' + key + '"][data-l="ar"]');
      if (enEl && enEl.value.trim()) model.lexicon[key].en = enEl.value.trim();
      if (arEl && arEl.value.trim()) model.lexicon[key].ar = arEl.value.trim();
    }
  }

  function finish() {
    model.roles = model.roles.map(r => {
      const draft = roleDrafts.find(d => d.id === r.id);
      if (!draft) return r;
      return { ...r, name: { en: draft.en.trim() || r.name.en, ar: draft.ar.trim() || r.name.ar } };
    });
    close();
    if (onDone) onDone(model);
  }

  function head(title) {
    return '<div class="mhead"><div><div class="kicker">' + s().title + ' · ' + s().step + ' ' + (step + 1) + '/3</div><h2 class="ctitle" id="onboarding-title">' + title + '</h2></div>' +
      '<button type="button" class="ibtn" data-act="skip" aria-label="' + s().close + '">\u2715</button></div>';
  }

  function step1HTML() {
    return head(s().step1) +
      '<div class="msec" style="display:grid;gap:10px">' +
      PRESETS.map(p => '<button type="button" class="card" data-act="pick" data-id="' + p.id + '" style="text-align:start;cursor:pointer">' +
        '<b>' + esc(p.name[lang()] || p.name.en) + '</b>' +
        '<div style="font-size:12.5px;color:var(--ink-500);margin-top:4px">' + esc(p.blurb[lang()] || p.blurb.en) + '</div></button>'
      ).join('') + '</div>' +
      '<div class="mfoot"><div class="grow"></div><button type="button" class="btn ghost" data-act="skip">' + s().skip + '</button></div>';
  }

  function step2HTML() {
    return head(s().step2) +
      '<p style="color:var(--ink-500);font-size:13px;margin:6px 0 0">' + s().hint2 + '</p>' +
      '<div class="msec" style="display:grid;gap:10px">' +
      ['resource', 'site', 'engagement', 'run'].map(key =>
        '<div class="ob-row">' +
        '<span class="ob-key">' + s().keys[key] + '</span>' +
        '<input type="text" data-lex="' + key + '" data-l="en" value="' + esc(model.lexicon[key].en) + '" aria-label="' + s().keys[key] + ' (English)">' +
        '<input type="text" data-lex="' + key + '" data-l="ar" value="' + esc(model.lexicon[key].ar) + '" dir="rtl" aria-label="' + s().keys[key] + ' (العربية)">' +
        '</div>'
      ).join('') + '</div>' +
      '<div class="mfoot"><button type="button" class="btn ghost" data-act="back">' + s().back + '</button><div class="grow"></div>' +
      '<button type="button" class="btn ghost" data-act="skip">' + s().skip + '</button>' +
      '<button type="button" class="btn primary" data-act="next">' + s().next + '</button></div>';
  }

  function step3HTML() {
    return head(s().step3) +
      '<p style="color:var(--ink-500);font-size:13px;margin:6px 0 0">' + s().hint3 + '</p>' +
      '<div class="msec" style="display:grid;gap:10px" id="role-drafts">' +
      roleDrafts.map((r, i) =>
        '<div class="ob-row">' +
        '<input type="text" data-role-idx="' + i + '" data-l="en" value="' + esc(r.en) + '" aria-label="Role ' + (i + 1) + ' (English)">' +
        '<input type="text" data-role-idx="' + i + '" data-l="ar" value="' + esc(r.ar) + '" dir="rtl" aria-label="Role ' + (i + 1) + ' (العربية)">' +
        '</div>'
      ).join('') + '</div>' +
      '<div class="mfoot"><button type="button" class="btn ghost" data-act="back">' + s().back + '</button><div class="grow"></div>' +
      '<button type="button" class="btn primary" data-act="finish">' + s().finish + '</button></div>';
  }

  function render() {
    modal.innerHTML = step === 0 ? step1HTML() : step === 1 ? step2HTML() : step3HTML();
    const first = modal.querySelector(step === 0 ? '[data-act="pick"]' : 'input');
    if (first) first.focus();
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) return;
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'skip') skip();
    else if (act === 'pick') pickPreset(b.dataset.id);
    else if (act === 'back') { if (step === 1) collectLexicon(); step = Math.max(0, step - 1); render(); }
    else if (act === 'next') { collectLexicon(); step = 2; render(); }
    else if (act === 'finish') finish();
  });

  modal.addEventListener('input', (e) => {
    const inp = e.target;
    if (inp.dataset.roleIdx !== undefined) roleDrafts[+inp.dataset.roleIdx][inp.dataset.l] = inp.value;
  });

  function onKey(e) {
    if (e.key === 'Escape') { skip(); return; }
    if (e.key !== 'Tab') return;
    const focusables = [...modal.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(el => !el.disabled);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  document.addEventListener('keydown', onKey);

  render();
  return { close };
}
