import { planToDelimited, planToMarkdown, planToText, planToICS, planToJSON } from '../core/io/export.js';

const STR = {
  en: { title: 'Export plan', format: 'FORMAT', copy: 'Copy', download: 'Download', close: 'Close', copied: 'Copied' },
  ar: { title: 'تصدير الخطة', format: 'الصيغة', copy: 'نسخ', download: 'تنزيل', close: 'إغلاق', copied: 'تم النسخ' }
};

const FORMATS = [
  { id: 'csv', label: 'CSV', ext: 'csv', mime: 'text/csv', gen: (m, p, lang) => planToDelimited(m, p, { lang, delimiter: ',' }) },
  { id: 'tsv', label: 'TSV', ext: 'tsv', mime: 'text/tab-separated-values', gen: (m, p, lang) => planToDelimited(m, p, { lang, delimiter: '\t' }) },
  { id: 'md', label: 'MD', ext: 'md', mime: 'text/markdown', gen: (m, p, lang) => planToMarkdown(m, p, { lang }) },
  { id: 'txt', label: 'TXT', ext: 'txt', mime: 'text/plain', gen: (m, p, lang) => planToText(m, p, { lang }) },
  { id: 'ics', label: 'ICS', ext: 'ics', mime: 'text/calendar', gen: (m, p, lang) => planToICS(m, p, { lang }) },
  { id: 'json', label: 'JSON', ext: 'json', mime: 'application/json', gen: (m, p) => planToJSON(m, p) }
];

export function openExportModal(model, plan, lang) {
  const s = STR[lang === 'ar' ? 'ar' : 'en'];
  let fmt = FORMATS[0];
  const previousFocus = document.activeElement;

  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'export-title');
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.documentElement.classList.add('modal-open');

  function close() {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    document.documentElement.classList.remove('modal-open');
    if (previousFocus && previousFocus.focus && previousFocus.isConnected) previousFocus.focus();
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  function content() {
    return fmt.gen(model, plan, lang);
  }

  function render() {
    modal.innerHTML =
      '<div class="mhead"><div><h2 class="ctitle" id="export-title">' + s.title + '</h2></div>' +
      '<button type="button" class="ibtn" data-act="close" aria-label="' + s.close + '">\u2715</button></div>' +
      '<div class="msec"><div class="mlab">' + s.format + '</div><div class="seg">' +
      FORMATS.map(f => '<button type="button" data-fmt="' + f.id + '" aria-pressed="' + (f.id === fmt.id) + '"' + (f.id === fmt.id ? ' class="on"' : '') + '>' + f.label + '</button>').join('') +
      '</div></div>' +
      '<div class="msec"><textarea readonly aria-label="' + s.title + '" class="export-preview" style="width:100%;min-height:220px;white-space:pre;overflow:auto" dir="' + (lang === 'ar' && fmt.id !== 'csv' && fmt.id !== 'tsv' ? 'rtl' : 'ltr') + '"></textarea></div>' +
      '<div class="mfoot">' +
      '<button type="button" class="btn primary" data-act="copy">' + s.copy + '</button>' +
      '<button type="button" class="btn" data-act="download">' + s.download + '</button>' +
      '<div class="grow"></div><button type="button" class="btn ghost" data-act="close">' + s.close + '</button>' +
      '</div>';
    modal.querySelector('textarea').value = content();
  }

  overlay.addEventListener('click', (e) => {
    const fmtBtn = e.target.closest('[data-fmt]');
    if (fmtBtn) {
      fmt = FORMATS.find(f => f.id === fmtBtn.dataset.fmt);
      render();
      return;
    }
    const actBtn = e.target.closest('[data-act]');
    if (!actBtn) return;
    if (actBtn.dataset.act === 'close') close();
    else if (actBtn.dataset.act === 'copy') {
      const ta = modal.querySelector('textarea');
      ta.select();
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(ta.value).then(() => { actBtn.textContent = s.copied; }).catch(() => {
          if (document.execCommand('copy')) actBtn.textContent = s.copied;
        });
      } else if (document.execCommand('copy')) {
        actBtn.textContent = s.copied;
      }
    } else if (actBtn.dataset.act === 'download') {
      const blob = new Blob([content()], { type: fmt.mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'rota-plan.' + fmt.ext;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  });

  document.addEventListener('keydown', onKey);

  render();
  const firstButton = modal.querySelector('[data-fmt].on');
  if (firstButton) firstButton.focus();
  return { close };
}
