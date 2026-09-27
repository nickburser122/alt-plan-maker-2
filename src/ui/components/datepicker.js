import { pISO, fISO, addISO, dowOf, monthBounds } from '../../core/dates.js';

const DOWS = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
};
const DOWS_SHORT = {
  en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  ar: ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']
};
const MOS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
};
const STR = {
  en: {
    chooseDate: 'Choose date', chooseRange: 'Choose date range',
    prevMonth: 'Previous month', nextMonth: 'Next month',
    prevYears: 'Previous years', nextYears: 'Next years',
    today: 'Today', clear: 'Clear',
    presetToday: 'Today', presetWeek: 'This week', presetNext7: 'Next 7 days',
    presetMonth: 'This month', presetNextMonth: 'Next month', presetCustom: 'Custom'
  },
  ar: {
    chooseDate: 'اختر تاريخ', chooseRange: 'اختر مدى تاريخي',
    prevMonth: 'الشهر السابق', nextMonth: 'الشهر التالي',
    prevYears: 'سنوات سابقة', nextYears: 'سنوات تالية',
    today: 'اليوم', clear: 'مسح',
    presetToday: 'اليوم', presetWeek: 'هذا الأسبوع', presetNext7: 'السبعة أيام القادمة',
    presetMonth: 'هذا الشهر', presetNextMonth: 'الشهر القادم', presetCustom: 'مخصص'
  }
};

function todayISO() { return fISO(new Date()); }

function monthAdd(y, m, delta) {
  let nm = m + delta, ny = y;
  while (nm < 0) { nm += 12; ny--; }
  while (nm > 11) { nm -= 12; ny++; }
  return { y: ny, m: nm };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function fmtFull(iso, lang) {
  const d = pISO(iso);
  return DOWS[lang][d.getDay()] + ' ' + d.getDate() + ' ' + MOS[lang][d.getMonth()] + ' ' + d.getFullYear();
}

function inRange(iso, min, max) {
  if (min && iso < min) return false;
  if (max && iso > max) return false;
  return true;
}

function isDisabled(iso, opts) {
  if (!inRange(iso, opts.min, opts.max)) return true;
  if (!opts.disabledDays) return false;
  if (typeof opts.disabledDays === 'function') return !!opts.disabledDays(iso);
  return opts.disabledDays.includes(iso);
}

function svgIcon(dir) {
  const path = dir === 'left'
    ? 'M15 4.5L7 12l8 7.5'
    : 'M9 4.5l8 7.5-8 7.5';
  return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + path + '"/></svg>';
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

class Picker {
  constructor(btn, opts) {
    this.btn = btn;
    this.opts = Object.assign({
      mode: 'single', value: null, min: null, max: null,
      presets: true, disabledDays: null, locale: 'en', dir: 'ltr', onCommit: () => {}
    }, opts);
    this.lang = this.opts.locale === 'ar' ? 'ar' : 'en';
    this.rtl = this.opts.dir === 'rtl';
    this.str = STR[this.lang];

    this.mode = this.opts.mode;
    this.value = this.mode === 'range'
      ? (this.opts.value && typeof this.opts.value === 'object' ? { ...this.opts.value } : { start: null, end: null })
      : (this.opts.value || null);

    const anchorIso = this.mode === 'range' ? (this.value.start || todayISO()) : (this.value || todayISO());
    const anchor = pISO(anchorIso);
    this.cursor = { y: anchor.getFullYear(), m: anchor.getMonth() };
    this.view = 'days';
    this.yearsPage = Math.floor(this.cursor.y / 12) * 12;
    this.hoverIso = null;
    this.focusIso = anchorIso;
    this.dualMonth = false;

    this.el = null;
    this.bodyH = null;
    this.prevFocus = null;

    this._onDocPointer = this._onDocPointer.bind(this);
    this._onDocKey = this._onDocKey.bind(this);
    this._onWinClose = this._onWinClose.bind(this);
  }

  open() {
    if (this.el) return;
    this.prevFocus = document.activeElement;
    this.dualMonth = this.mode === 'range' && this.opts.presets !== false && (window.innerWidth - 16) >= 620;

    const el = document.createElement('div');
    el.className = 'dpk-pop' + (this.dualMonth ? ' wide' : '');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', this.mode === 'range' ? this.str.chooseRange : this.str.chooseDate);
    el.setAttribute('dir', this.opts.dir);
    document.body.appendChild(el);
    this.el = el;

    this.btn.classList.add('open');
    this.btn.setAttribute('aria-expanded', 'true');

    this.render(false);
    this.position();

    document.addEventListener('mousedown', this._onDocPointer, true);
    document.addEventListener('keydown', this._onDocKey, true);
    window.addEventListener('scroll', this._onWinClose, true);
    window.addEventListener('resize', this._onWinClose, true);

    const initial = el.querySelector('.dpk-day.sel') || el.querySelector('.dpk-day.today') || el.querySelector('.dpk-day:not(.mute)') || el.querySelector('button');
    if (initial) initial.focus();
  }

  close(restoreFocus) {
    if (!this.el) return;
    this.btn.classList.remove('open');
    this.btn.setAttribute('aria-expanded', 'false');
    this.el.remove();
    this.el = null;
    document.removeEventListener('mousedown', this._onDocPointer, true);
    document.removeEventListener('keydown', this._onDocKey, true);
    window.removeEventListener('scroll', this._onWinClose, true);
    window.removeEventListener('resize', this._onWinClose, true);
    if (restoreFocus && this.prevFocus && this.prevFocus.isConnected) this.prevFocus.focus();
    else if (restoreFocus && this.btn.isConnected) this.btn.focus();
  }

  destroy() {
    this.close(false);
  }

  setValue(v) {
    this.value = this.mode === 'range' ? { ...v } : v;
    if (this.el) this.render(false);
  }

  _onWinClose() { this.close(false); }

  _onDocPointer(e) {
    if (!this.el) return;
    if (this.el.contains(e.target) || this.btn.contains(e.target)) return;
    this.close(false);
  }

  position() {
    const r = this.btn.getBoundingClientRect();
    const pw = this.el.offsetWidth, ph = this.el.offsetHeight;
    let top = r.bottom + 8;
    if (top + ph > window.innerHeight - 8) top = r.top - ph - 8;
    top = clamp(top, 8, Math.max(8, window.innerHeight - ph - 8));
    let left = this.rtl ? r.right - pw : r.left;
    left = clamp(left, 8, Math.max(8, window.innerWidth - pw - 8));
    this.el.style.top = top + 'px';
    this.el.style.left = left + 'px';
  }

  announce(iso) {
    if (!this.liveEl) return;
    this.liveEl.textContent = fmtFull(iso, this.lang);
  }

  presetList() {
    const t = todayISO();
    const weekStart = addISO(t, -dowOf(t));
    const nm = monthAdd(pISO(t).getFullYear(), pISO(t).getMonth(), 1);
    const nmIso = nm.y + '-' + String(nm.m + 1).padStart(2, '0') + '-01';
    return [
      { key: 'today', label: this.str.presetToday, value: { start: t, end: t } },
      { key: 'week', label: this.str.presetWeek, value: { start: weekStart, end: addISO(weekStart, 6) } },
      { key: 'next7', label: this.str.presetNext7, value: { start: t, end: addISO(t, 6) } },
      { key: 'month', label: this.str.presetMonth, value: monthBounds(t) },
      { key: 'nextMonth', label: this.str.presetNextMonth, value: monthBounds(nmIso) },
      { key: 'custom', label: this.str.presetCustom, value: null }
    ];
  }

  presetsHTML() {
    if (this.mode !== 'range' || this.opts.presets === false) return '';
    const items = this.presetList().map(p =>
      '<button type="button" class="dpk-preset-btn" data-act="preset" data-k="' + p.key + '">' + esc(p.label) + '</button>'
    ).join('');
    return '<div class="dpk-presets" role="group" aria-label="' + esc(this.str.chooseRange) + '">' + items + '</div>';
  }

  monthGridHTML(y, m, forFocusCapture) {
    const first = new Date(y, m, 1);
    const gridStart = new Date(y, m, 1 - first.getDay());
    const cells = [];
    for (let w = 0; w < 6; w++) {
      const rowCells = [];
      for (let d = 0; d < 7; d++) {
        const i = w * 7 + d;
        const dt = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
        const iso = fISO(dt);
        const disabled = isDisabled(iso, this.opts);
        const cls = ['dpk-day'];
        if (dt.getMonth() !== m) cls.push('mute');
        if (iso === todayISO()) cls.push('today');
        if (disabled) cls.push('off');

        let selected = false;
        if (this.mode === 'range') {
          const { start, end } = this.value;
          const hiEnd = end || (start && this.hoverIso && this.hoverIso >= start ? this.hoverIso : null);
          if (start && iso === start) { cls.push('range-start'); selected = true; }
          if (end && iso === end) { cls.push('range-end'); selected = true; }
          if (start && hiEnd && iso > start && iso < hiEnd) cls.push(end ? 'range' : 'range-hover');
          if (start && !end && hiEnd && iso === hiEnd && iso !== start) cls.push('range-hover', 'range-hover-end');
        } else if (this.value && iso === this.value) {
          cls.push('sel'); selected = true;
        }

        const tabbable = iso === this.focusIso;
        rowCells.push(
          '<button type="button" class="' + cls.join(' ') + '" role="gridcell" data-act="dpk-day" data-iso="' + iso + '"' +
          ' tabindex="' + (tabbable ? '0' : '-1') + '"' +
          ' aria-selected="' + selected + '"' +
          (disabled ? ' aria-disabled="true"' : '') +
          '>' + dt.getDate() + '</button>'
        );
      }
      cells.push('<div role="row" style="display:contents">' + rowCells.join('') + '</div>');
    }
    const prevIc = svgIcon(this.rtl ? 'right' : 'left');
    const nextIc = svgIcon(this.rtl ? 'left' : 'right');
    return '<div class="dpk-month" data-y="' + y + '" data-m="' + m + '">'
      + '<div class="dpk-head">'
      + (forFocusCapture ? '<button type="button" class="dpk-nav" data-act="dpk-nav" data-dir="prev" aria-label="' + esc(this.str.prevMonth) + '">' + prevIc + '</button>' : '<span class="dpk-nav" aria-hidden="true"></span>')
      + '<button type="button" class="dpk-title" data-act="dpk-view" data-v="months">' + esc(MOS[this.lang][m]) + ' ' + y + '</button>'
      + (forFocusCapture ? '<button type="button" class="dpk-nav" data-act="dpk-nav" data-dir="next" aria-label="' + esc(this.str.nextMonth) + '">' + nextIc + '</button>' : '<span class="dpk-nav" aria-hidden="true"></span>')
      + '</div>'
      + '<div class="dpk-grid" role="grid" aria-label="' + esc(MOS[this.lang][m]) + ' ' + y + '">'
      + DOWS_SHORT[this.lang].map(d => '<span class="dpk-dow" aria-hidden="true">' + d + '</span>').join('')
      + cells.join('')
      + '</div></div>';
  }

  daysViewHTML() {
    if (this.mode === 'range' && this.dualMonth) {
      const next = monthAdd(this.cursor.y, this.cursor.m, 1);
      return this.monthGridHTML(this.cursor.y, this.cursor.m, true)
        + this.monthGridHTML(next.y, next.m, false);
    }
    return this.monthGridHTML(this.cursor.y, this.cursor.m, true);
  }

  yearsMonthsHTML() {
    const prevIc = svgIcon(this.rtl ? 'right' : 'left');
    const nextIc = svgIcon(this.rtl ? 'left' : 'right');
    if (this.view === 'years') {
      const sY = this.yearsPage, eY = sY + 11;
      const cells = [];
      for (let y = sY; y <= eY; y++) {
        cells.push('<button type="button" class="dpk-pcell' + (y === this.cursor.y ? ' sel' : '') + '" role="gridcell" data-act="dpk-pick-year" data-y="' + y + '" tabindex="' + (y === this.cursor.y ? '0' : '-1') + '" aria-selected="' + (y === this.cursor.y) + '">' + y + '</button>');
      }
      return '<div class="dpk-head">'
        + '<button type="button" class="dpk-nav" data-act="dpk-nav" data-dir="prev" aria-label="' + esc(this.str.prevYears) + '">' + prevIc + '</button>'
        + '<span class="dpk-range-lbl">' + sY + '–' + eY + '</span>'
        + '<button type="button" class="dpk-nav" data-act="dpk-nav" data-dir="next" aria-label="' + esc(this.str.nextYears) + '">' + nextIc + '</button>'
        + '</div><div class="dpk-pgrid" role="grid" aria-label="' + sY + '-' + eY + '">' + cells.join('') + '</div>';
    }
    const cells = MOS[this.lang].map((mn, i) =>
      '<button type="button" class="dpk-pcell' + (i === this.cursor.m ? ' sel' : '') + '" role="gridcell" data-act="dpk-pick-month" data-m="' + i + '" tabindex="' + (i === this.cursor.m ? '0' : '-1') + '" aria-selected="' + (i === this.cursor.m) + '">' + esc(mn) + '</button>'
    ).join('');
    return '<div class="dpk-head">'
      + '<button type="button" class="dpk-nav" data-act="dpk-nav" data-dir="prev" aria-label="' + esc(this.str.prevYears) + '">' + prevIc + '</button>'
      + '<button type="button" class="dpk-title" data-act="dpk-view" data-v="years">' + this.cursor.y + '</button>'
      + '<button type="button" class="dpk-nav" data-act="dpk-nav" data-dir="next" aria-label="' + esc(this.str.nextYears) + '">' + nextIc + '</button>'
      + '</div><div class="dpk-pgrid" role="grid" aria-label="' + this.cursor.y + '">' + cells + '</div>';
  }

  bodyHTML() {
    if (this.view === 'days') {
      const foot = this.mode === 'single'
        ? '<div class="dpk-foot"><button type="button" class="dpk-today-btn" data-act="dpk-today">' + esc(this.str.today) + '</button></div>'
        : '';
      return '<div class="dpk-months">' + this.daysViewHTML() + '</div>' + foot;
    }
    return this.yearsMonthsHTML();
  }

  render(animate) {
    const body = this.el.querySelector('.dpk-body');
    const html = this.presetsHTML() + '<div class="dpk-body">' + this.bodyHTML() + '</div>';
    if (!this.liveEl) {
      this.liveEl = document.createElement('div');
      this.liveEl.className = 'sr-only';
      this.liveEl.setAttribute('aria-live', 'polite');
    }
    this.el.innerHTML = html;
    this.el.appendChild(this.liveEl);

    const newBody = this.el.querySelector('.dpk-body');
    if (this.bodyH) newBody.style.minHeight = this.bodyH + 'px';
    if (animate) {
      newBody.classList.add('dpk-fade');
      requestAnimationFrame(() => { newBody.classList.remove('dpk-fade'); });
    }
    if (this.view === 'days' && !this.bodyH) {
      this.bodyH = newBody.offsetHeight;
      newBody.style.minHeight = this.bodyH + 'px';
    }
    this.position();
  }

  focusAfterViewChange() {
    let sel;
    if (this.view === 'years') sel = '.dpk-pcell[data-y="' + this.cursor.y + '"]';
    else if (this.view === 'months') sel = '.dpk-pcell[data-m="' + this.cursor.m + '"]';
    else sel = '.dpk-day[data-iso="' + this.focusIso + '"]';
    const cell = this.el.querySelector(sel);
    if (cell) cell.focus();
    if (this.view === 'days') this.announce(this.focusIso);
  }

  focusCell(iso) {
    this.focusIso = iso;
    this.render(false);
    const cell = this.el.querySelector('.dpk-day[data-iso="' + iso + '"]');
    if (cell) cell.focus();
    this.announce(iso);
  }

  gotoMonth(y, m) {
    this.cursor.y = y; this.cursor.m = m; this.view = 'days';
    this.render(true);
  }

  pickDay(iso) {
    if (isDisabled(iso, this.opts)) return;
    if (this.mode === 'single') {
      this.value = iso;
      this.opts.onCommit(iso);
      this.close(true);
      return;
    }
    const { start, end } = this.value;
    if (!start || end) {
      this.value = { start: iso, end: null };
    } else if (iso < start) {
      this.value = { start: iso, end: null };
    } else {
      this.value = { start, end: iso };
      this.opts.onCommit({ ...this.value });
      this.close(true);
      return;
    }
    this.focusIso = iso;
    this.render(false);
  }

  applyPreset(key) {
    if (key === 'custom') {
      this.value = { start: null, end: null };
      this.render(false);
      return;
    }
    const preset = this.presetList().find(p => p.key === key);
    if (!preset) return;
    this.value = { ...preset.value };
    this.opts.onCommit({ ...this.value });
    this.close(true);
  }

  navPage(dir) {
    const d = dir === 'next' ? 1 : -1;
    const refocusNav = () => {
      const nav = this.el.querySelector('.dpk-nav[data-dir="' + dir + '"]');
      if (nav) nav.focus();
    };
    if (this.view === 'years') { this.yearsPage += d * 12; this.render(true); refocusNav(); return; }
    if (this.view === 'months') { this.cursor.y += d; this.render(true); refocusNav(); return; }
    const nm = monthAdd(this.cursor.y, this.cursor.m, d);
    this.cursor.y = nm.y; this.cursor.m = nm.m;
    this.render(true);
    refocusNav();
  }

  handleClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b || !this.el.contains(b)) return;
    const act = b.dataset.act;
    if (act === 'dpk-nav') this.navPage(b.dataset.dir);
    else if (act === 'dpk-view') {
      this.view = b.dataset.v;
      if (this.view === 'years') this.yearsPage = Math.floor(this.cursor.y / 12) * 12;
      this.render(true); this.focusAfterViewChange();
    } else if (act === 'dpk-pick-year') {
      this.cursor.y = +b.dataset.y; this.view = 'months';
      this.render(true); this.focusAfterViewChange();
    } else if (act === 'dpk-pick-month') {
      const day = Math.min(pISO(this.focusIso).getDate(), 28);
      this.cursor.m = +b.dataset.m; this.view = 'days';
      this.focusIso = fISO(new Date(this.cursor.y, this.cursor.m, day));
      this.render(true); this.focusAfterViewChange();
    }
    else if (act === 'dpk-day') this.pickDay(b.dataset.iso);
    else if (act === 'dpk-today') this.pickDay(todayISO());
    else if (act === 'preset') this.applyPreset(b.dataset.k);
  }

  applyRangeClasses() {
    if (this.mode !== 'range') return;
    const { start, end } = this.value;
    const hiEnd = end || (start && this.hoverIso && this.hoverIso >= start ? this.hoverIso : null);
    this.el.querySelectorAll('.dpk-day').forEach(cell => {
      const iso = cell.dataset.iso;
      cell.classList.remove('range', 'range-start', 'range-end', 'range-hover');
      let selected = false;
      if (start && iso === start) { cell.classList.add('range-start'); selected = true; }
      if (end && iso === end) { cell.classList.add('range-end'); selected = true; }
      if (start && hiEnd && iso > start && iso < hiEnd) cell.classList.add(end ? 'range' : 'range-hover');
      if (start && !end && hiEnd && iso === hiEnd && iso !== start) cell.classList.add('range-hover', 'range-hover-end');
      cell.setAttribute('aria-selected', String(selected));
    });
  }

  handleMouseOver(e) {
    if (this.mode !== 'range') return;
    const cell = e.target.closest('.dpk-day');
    if (!cell || cell.classList.contains('off')) return;
    if (this.value.start && !this.value.end && this.hoverIso !== cell.dataset.iso) {
      this.hoverIso = cell.dataset.iso;
      this.applyRangeClasses();
    }
  }

  focusableEls() {
    return [...this.el.querySelectorAll('button[tabindex="0"], button:not([tabindex])')]
      .filter(x => x.offsetParent !== null || x === document.activeElement);
  }

  handleKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); this.close(true); return; }

    if (e.key === 'Tab') {
      const items = this.focusableEls();
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      return;
    }

    if (e.shiftKey && (e.key === 'PageUp' || e.key === 'PageDown')) {
      e.preventDefault();
      const d = e.key === 'PageUp' ? -1 : 1;
      if (this.view === 'days') { this.cursor.y += d; this.render(true); this.focusCell(this.focusIso.replace(/^\d+/, String(pISO(this.focusIso).getFullYear() + d))); }
      else if (this.view === 'months') { this.cursor.y += d; this.render(true); }
      else { this.yearsPage += d * 12; this.render(true); }
      return;
    }

    if (this.view === 'days') {
      const cell = e.target.closest('.dpk-day');
      if (!cell) return;
      let delta = 0, jumpMonth = 0;
      if (e.key === 'ArrowLeft') delta = this.rtl ? 1 : -1;
      else if (e.key === 'ArrowRight') delta = this.rtl ? -1 : 1;
      else if (e.key === 'ArrowUp') delta = -7;
      else if (e.key === 'ArrowDown') delta = 7;
      else if (e.key === 'PageUp') jumpMonth = -1;
      else if (e.key === 'PageDown') jumpMonth = 1;
      else if (e.key === 'Home') delta = -dowOf(cell.dataset.iso);
      else if (e.key === 'End') delta = 6 - dowOf(cell.dataset.iso);
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.pickDay(cell.dataset.iso); return; }
      else return;
      e.preventDefault();
      if (jumpMonth) {
        const dt = pISO(cell.dataset.iso);
        const nm = monthAdd(dt.getFullYear(), dt.getMonth(), jumpMonth);
        this.cursor.y = nm.y; this.cursor.m = nm.m;
        this.focusCell(fISO(new Date(nm.y, nm.m, dt.getDate())));
      } else {
        this.focusCell(addISO(cell.dataset.iso, delta));
      }
      return;
    }

    if (this.view === 'months') {
      const cell = e.target.closest('.dpk-pcell');
      if (!cell) return;
      let delta = 0;
      if (e.key === 'ArrowLeft') delta = this.rtl ? 1 : -1;
      else if (e.key === 'ArrowRight') delta = this.rtl ? -1 : 1;
      else if (e.key === 'ArrowUp') delta = -3;
      else if (e.key === 'ArrowDown') delta = 3;
      else if (e.key === 'PageUp') { e.preventDefault(); this.cursor.y--; this.render(true); return; }
      else if (e.key === 'PageDown') { e.preventDefault(); this.cursor.y++; this.render(true); return; }
      else if (e.key === 'Home') delta = -this.cursor.m;
      else if (e.key === 'End') delta = 11 - this.cursor.m;
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const day = Math.min(pISO(this.focusIso).getDate(), 28);
        this.cursor.m = +cell.dataset.m; this.view = 'days';
        this.focusIso = fISO(new Date(this.cursor.y, this.cursor.m, day));
        this.render(true); this.focusAfterViewChange();
        return;
      }
      else return;
      e.preventDefault();
      let nm = this.cursor.m + delta, ny = this.cursor.y;
      nm = clamp(nm, 0, 11);
      this.cursor.m = nm;
      this.render(true);
      const next = this.el.querySelector('.dpk-pcell[data-m="' + nm + '"]');
      if (next) next.focus();
      return;
    }

    if (this.view === 'years') {
      const cell = e.target.closest('.dpk-pcell');
      if (!cell) return;
      const y = +cell.dataset.y;
      let ny = y, jumpPage = 0;
      if (e.key === 'ArrowLeft') ny += this.rtl ? 1 : -1;
      else if (e.key === 'ArrowRight') ny += this.rtl ? -1 : 1;
      else if (e.key === 'ArrowUp') ny -= 3;
      else if (e.key === 'ArrowDown') ny += 3;
      else if (e.key === 'PageUp') jumpPage = -1;
      else if (e.key === 'PageDown') jumpPage = 1;
      else if (e.key === 'Home') ny = this.yearsPage;
      else if (e.key === 'End') ny = this.yearsPage + 11;
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.cursor.y = y; this.view = 'months'; this.render(true); this.focusAfterViewChange(); return; }
      else return;
      e.preventDefault();
      if (jumpPage) { this.yearsPage += jumpPage * 12; this.cursor.y = ny + jumpPage * 12; }
      else if (ny < this.yearsPage) { this.yearsPage -= 12; this.cursor.y = ny; }
      else if (ny > this.yearsPage + 11) { this.yearsPage += 12; this.cursor.y = ny; }
      else this.cursor.y = ny;
      this.render(true);
      const next = this.el.querySelector('.dpk-pcell[data-y="' + this.cursor.y + '"]');
      if (next) next.focus();
    }
  }

  _onDocKey(e) {
    if (!this.el) return;
    if (!this.el.contains(e.target) && e.target !== this.btn) return;
    this.handleKey(e);
  }

  wire() {
    this.el.addEventListener('click', e => this.handleClick(e));
    this.el.addEventListener('mouseover', e => this.handleMouseOver(e));
  }
}

export const DatePicker = {
  attach(button, options) {
    const p = new Picker(button, options || {});
    p.wire = p.wire.bind(p);

    const toggle = () => { if (p.el) p.close(true); else p.open(); };
    button.addEventListener('click', toggle);

    const origOpen = p.open.bind(p);
    p.open = () => { origOpen(); p.wire(); };

    return {
      open: () => p.open(),
      close: () => p.close(true),
      destroy: () => { button.removeEventListener('click', toggle); p.destroy(); },
      setValue: v => p.setValue(v),
      getValue: () => p.value
    };
  }
};
