import { parseTable } from './csv.js';
import { bi, biLabel } from '../bi.js';

const TRUE_WORDS = ['1', 'true', 'yes', 'y', 'نعم', 'صحيح', 'نشط', 'active'];
const FALSE_WORDS = ['0', 'false', 'no', 'n', 'لا', 'غير نشط', 'inactive'];

function pick(row, aliases) {
  for (const a of aliases) {
    for (const key of Object.keys(row)) {
      if (key.trim().toLowerCase() === a.toLowerCase()) return row[key];
    }
  }
  return undefined;
}

function parseBool(v, fallback = true) {
  if (v === undefined || v === '') return fallback;
  const s = String(v).trim().toLowerCase();
  if (TRUE_WORDS.includes(s)) return true;
  if (FALSE_WORDS.includes(s)) return false;
  return fallback;
}

function findRole(model, text) {
  const s = String(text || '').trim().toLowerCase();
  if (!s) return null;
  return model.roles.find(r =>
    r.id.toLowerCase() === s ||
    (r.name.en || '').toLowerCase() === s ||
    (r.name.ar || '').toLowerCase() === s
  ) || null;
}

function findSiteClass(model, text) {
  const s = String(text || '').trim().toLowerCase();
  if (!s) return null;
  return model.siteClasses.find(c =>
    c.id.toLowerCase() === s ||
    (c.name.en || '').toLowerCase() === s ||
    (c.name.ar || '').toLowerCase() === s
  ) || null;
}

function uid(p) { return p + '_' + Math.random().toString(36).slice(2, 9); }

export function importResourcesCSV(model, text) {
  const rows = parseTable(text);
  const resources = [];
  const errors = [];
  rows.forEach((row, i) => {
    const rowNum = i + 2;
    const name = pick(row, ['name', 'الاسم']);
    const roleText = pick(row, ['role', 'roles', 'الدور']);
    const activeText = pick(row, ['active', 'نشط']);
    if (!name || !name.trim()) {
      errors.push({ row: rowNum, field: 'name', message: bi(`Row ${rowNum}: name is required`, `الصف ${rowNum}: الاسم مطلوب`) });
      return;
    }
    const role = findRole(model, roleText);
    if (roleText && !role) {
      errors.push({ row: rowNum, field: 'role', message: bi(`Row ${rowNum}: unknown role "${roleText}"`, `الصف ${rowNum}: دور غير معروف "${roleText}"`) });
      return;
    }
    const fallbackRole = role || model.roles[0];
    resources.push({
      id: uid('r'), name: { en: name.trim(), ar: name.trim() }, roles: fallbackRole ? [fallbackRole.id] : [],
      tags: [], attrs: {}, avail: { weekdays: [1, 1, 1, 1, 1, 1, 1], off: [], only: [], patternId: null },
      caps: { maxPerDay: null, maxPerWeek: null, minRestDays: 0 }, prefs: [], weight: 1, active: parseBool(activeText, true)
    });
  });
  return { resources, errors };
}

export function importSitesCSV(model, text) {
  const rows = parseTable(text);
  const sites = [];
  const errors = [];
  rows.forEach((row, i) => {
    const rowNum = i + 2;
    const name = pick(row, ['name', 'الاسم']);
    const classText = pick(row, ['class', 'siteClass', 'type', 'الفئة', 'النوع']);
    const kmText = pick(row, ['km', 'distance', 'المسافة']);
    const activeText = pick(row, ['active', 'نشط']);
    if (!name || !name.trim()) {
      errors.push({ row: rowNum, field: 'name', message: bi(`Row ${rowNum}: name is required`, `الصف ${rowNum}: الاسم مطلوب`) });
      return;
    }
    const cls = findSiteClass(model, classText);
    if (classText && !cls) {
      errors.push({ row: rowNum, field: 'class', message: bi(`Row ${rowNum}: unknown site class "${classText}"`, `الصف ${rowNum}: فئة موقع غير معروفة "${classText}"`) });
      return;
    }
    const km = kmText !== undefined && kmText !== '' ? Number(kmText) : 0;
    if (kmText !== undefined && kmText !== '' && Number.isNaN(km)) {
      errors.push({ row: rowNum, field: 'km', message: bi(`Row ${rowNum}: "${kmText}" is not a number`, `الصف ${rowNum}: "${kmText}" ليس رقمًا`) });
      return;
    }
    const fallbackClass = cls || model.siteClasses[0];
    sites.push({
      id: uid('s'), name: { en: name.trim(), ar: name.trim() }, classId: fallbackClass ? fallbackClass.id : null,
      tags: [], attrs: model.attributes.some(a => a.id === 'km') ? { km } : {}, weight: 1, active: parseBool(activeText, true),
      cadence: { minGapDays: 0, targetPerHorizon: null, maxPerHorizon: null }
    });
  });
  return { sites, errors };
}

export function errorsToText(errors, lang) {
  return errors.map(e => biLabel(e.message, lang)).join(' \u00b7 ');
}
