import { toDelimited } from './csv.js';
import { biLabel } from '../bi.js';

function assignmentRows(model, plan) {
  const bySite = new Map(model.sites.map(s => [s.id, s]));
  const byRun = new Map(plan.runs.map(r => [r.id, r]));
  const byResource = new Map(model.resources.map(r => [r.id, r]));
  const byRole = new Map(model.roles.map(r => [r.id, r]));
  const out = [];
  for (const eng of plan.engagements) {
    const run = byRun.get(eng.runId);
    const site = bySite.get(eng.siteId);
    const crew = plan.assignments.filter(a => a.runId === eng.runId);
    for (const a of crew) {
      const resource = byResource.get(a.resourceId);
      const role = byRole.get(a.roleId);
      out.push({
        date: eng.date,
        site: site ? biLabel(site.name, 'en') : eng.siteId,
        siteAr: site ? biLabel(site.name, 'ar') : eng.siteId,
        role: role ? biLabel(role.name, 'en') : a.roleId,
        roleAr: role ? biLabel(role.name, 'ar') : a.roleId,
        resource: resource ? biLabel(resource.name, 'en') : a.resourceId,
        resourceAr: resource ? biLabel(resource.name, 'ar') : a.resourceId,
        locked: model.locks.some(l => l.engagementId === eng.id && l.roleId === a.roleId && l.slotIndex === a.unitIndex) ? 'yes' : ''
      });
    }
    for (const s of plan.openSlots.filter(s => s.runId === eng.runId)) {
      const role = byRole.get(s.roleId);
      out.push({
        date: eng.date, site: site ? biLabel(site.name, 'en') : eng.siteId, siteAr: site ? biLabel(site.name, 'ar') : eng.siteId,
        role: role ? biLabel(role.name, 'en') : s.roleId, roleAr: role ? biLabel(role.name, 'ar') : s.roleId,
        resource: '(open)', resourceAr: '(شاغر)', locked: ''
      });
    }
  }
  return out.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
}

const COLUMNS_EN = [
  { key: 'date', label: 'Date' }, { key: 'site', label: 'Site' }, { key: 'role', label: 'Role' },
  { key: 'resource', label: 'Resource' }, { key: 'locked', label: 'Locked' }
];
const COLUMNS_AR = [
  { key: 'date', label: 'التاريخ' }, { key: 'siteAr', label: 'الموقع' }, { key: 'roleAr', label: 'الدور' },
  { key: 'resourceAr', label: 'المورد' }, { key: 'locked', label: 'مقفلة' }
];

export function planToDelimited(model, plan, { lang = 'en', delimiter = ',' } = {}) {
  const rows = assignmentRows(model, plan);
  const columns = lang === 'ar' ? COLUMNS_AR : COLUMNS_EN;
  return toDelimited(rows, columns, delimiter);
}

export function planToMarkdown(model, plan, { lang = 'en' } = {}) {
  const rows = assignmentRows(model, plan);
  const byDate = new Map();
  for (const r of rows) {
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date).push(r);
  }
  const siteCol = lang === 'ar' ? 'siteAr' : 'site';
  const roleCol = lang === 'ar' ? 'roleAr' : 'role';
  const resCol = lang === 'ar' ? 'resourceAr' : 'resource';
  const parts = [];
  for (const [date, list] of [...byDate.entries()].sort()) {
    parts.push('## ' + date);
    parts.push('| ' + (lang === 'ar' ? 'الموقع' : 'Site') + ' | ' + (lang === 'ar' ? 'الدور' : 'Role') + ' | ' + (lang === 'ar' ? 'المورد' : 'Resource') + ' |');
    parts.push('|---|---|---|');
    for (const r of list) parts.push('| ' + r[siteCol] + ' | ' + r[roleCol] + ' | ' + r[resCol] + ' |');
    parts.push('');
  }
  return parts.join('\n');
}

export function planToText(model, plan, { lang = 'en' } = {}) {
  const rows = assignmentRows(model, plan);
  const siteCol = lang === 'ar' ? 'siteAr' : 'site';
  const roleCol = lang === 'ar' ? 'roleAr' : 'role';
  const resCol = lang === 'ar' ? 'resourceAr' : 'resource';
  let lastDate = null;
  const lines = [];
  for (const r of rows) {
    if (r.date !== lastDate) { lines.push(''); lines.push(r.date); lastDate = r.date; }
    lines.push('  ' + r[siteCol] + ' — ' + r[roleCol] + ': ' + r[resCol]);
  }
  return lines.join('\n').trim();
}

function icsEscape(s) {
  return String(s).replace(/[\\,;]/g, m => '\\' + m).replace(/\n/g, '\\n');
}
function icsDate(iso) {
  return iso.replace(/-/g, '');
}

export function planToICS(model, plan, { lang = 'en' } = {}) {
  const bySite = new Map(model.sites.map(s => [s.id, s]));
  const byResource = new Map(model.resources.map(r => [r.id, r]));
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//mauvine-rota//EN', 'CALSCALE:GREGORIAN'];
  for (const run of plan.runs) {
    const crew = plan.assignments.filter(a => a.runId === run.id);
    if (!crew.length) continue;
    const site = bySite.get(run.siteId);
    const names = crew.map(a => { const r = byResource.get(a.resourceId); return r ? biLabel(r.name, lang) : a.resourceId; }).join(', ');
    const start = run.dates[0];
    const end = run.dates[run.dates.length - 1];
    lines.push('BEGIN:VEVENT');
    lines.push('UID:' + run.id + '@mauvine-rota');
    lines.push('DTSTART;VALUE=DATE:' + icsDate(start));
    lines.push('DTEND;VALUE=DATE:' + icsDate(end));
    lines.push('SUMMARY:' + icsEscape(site ? biLabel(site.name, lang) : run.siteId));
    lines.push('DESCRIPTION:' + icsEscape(names));
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function planToJSON(model, plan) {
  const { ctx, ...rest } = plan;
  return JSON.stringify(rest, null, 2);
}
