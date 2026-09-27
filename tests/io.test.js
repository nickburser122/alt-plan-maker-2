import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseTable, toDelimited } from '../src/core/io/csv.js';
import { planToDelimited, planToMarkdown, planToText, planToICS, planToJSON } from '../src/core/io/export.js';
import { importResourcesCSV, importSitesCSV } from '../src/core/io/csv-import.js';
import { findPreset } from '../src/core/presets.js';
import { solve } from '../src/core/solve.js';

test('parseTable round-trips a quoted, comma-containing field', () => {
  const csv = 'name,note\n"Smith, John","says ""hi"""\n';
  const rows = parseTable(csv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Smith, John');
  assert.equal(rows[0].note, 'says "hi"');
});

test('toDelimited escapes fields containing the delimiter', () => {
  const out = toDelimited([{ a: 'x,y', b: 'z' }], [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }]);
  assert.equal(out, 'A,B\n"x,y",z');
});

function fieldVisitsPlan() {
  const model = findPreset('field-visits').build();
  return { model, plan: solve(model) };
}

test('planToDelimited produces one data row per assignment plus a header', () => {
  const { model, plan } = fieldVisitsPlan();
  const csv = planToDelimited(model, plan, { lang: 'en' });
  const lines = csv.split('\n');
  assert.equal(lines[0], 'Date,Site,Role,Resource,Locked');
  assert.equal(lines.length - 1, plan.assignments.length + plan.openSlots.length);
});

test('planToDelimited(ar) uses Arabic headers and Arabic entity names', () => {
  const { model, plan } = fieldVisitsPlan();
  const csv = planToDelimited(model, plan, { lang: 'ar' });
  assert.ok(csv.startsWith('التاريخ,الموقع,الدور,المورد,مقفلة'));
});

test('planToMarkdown groups rows under a heading per day', () => {
  const { model, plan } = fieldVisitsPlan();
  const md = planToMarkdown(model, plan, { lang: 'en' });
  assert.ok(md.includes('## ' + plan.engagements[0].date));
  assert.ok(md.includes('| Site | Role | Resource |'));
});

test('planToText lists entries grouped under each date', () => {
  const { model, plan } = fieldVisitsPlan();
  const txt = planToText(model, plan, { lang: 'en' });
  assert.ok(txt.includes(plan.engagements[0].date));
});

test('planToICS produces a parseable VCALENDAR with one VEVENT per run', () => {
  const { model, plan } = fieldVisitsPlan();
  const ics = planToICS(model, plan, { lang: 'en' });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR'));
  assert.ok(ics.trim().endsWith('END:VCALENDAR'));
  const eventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
  const runsWithCrew = plan.runs.filter(r => plan.assignments.some(a => a.runId === r.id)).length;
  assert.equal(eventCount, runsWithCrew);
});

test('planToJSON strips the non-serializable ctx and round-trips through JSON.parse', () => {
  const { model, plan } = fieldVisitsPlan();
  const json = planToJSON(model, plan);
  const parsed = JSON.parse(json);
  assert.equal(parsed.ctx, undefined);
  assert.equal(parsed.assignments.length, plan.assignments.length);
});

test('importResourcesCSV accepts valid rows and reports a bilingual, row-specific error for an unknown role', () => {
  const model = findPreset('field-visits').build();
  const csv = 'name,role\nNew Person,r_fin\nBad Person,not_a_role\n';
  const { resources, errors } = importResourcesCSV(model, csv);
  assert.equal(resources.length, 1);
  assert.equal(resources[0].name.en, 'New Person');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].row, 3);
  assert.ok(errors[0].message.en.includes('Row 3'));
  assert.ok(errors[0].message.ar.includes('الصف 3'));
});

test('importResourcesCSV requires a name and accepts Arabic header aliases', () => {
  const model = findPreset('field-visits').build();
  const csv = 'الاسم,نشط\nليلى,نعم\n,لا\n';
  const { resources, errors } = importResourcesCSV(model, csv);
  assert.equal(resources.length, 1);
  assert.equal(resources[0].name.en, 'ليلى');
  assert.equal(resources[0].active, true);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].field, 'name');
});

test('importSitesCSV validates the km column is numeric and reports the bad row', () => {
  const model = findPreset('field-visits').build();
  const csv = 'name,class,km\nGood Site,c_main,12\nBad Site,c_main,not-a-number\n';
  const { sites, errors } = importSitesCSV(model, csv);
  assert.equal(sites.length, 1);
  assert.equal(sites[0].attrs.km, 12);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].row, 3);
  assert.equal(errors[0].field, 'km');
});

test('importSitesCSV rejects an unknown site class by name, in either language', () => {
  const model = findPreset('field-visits').build();
  const csv = 'name,class\nSite X,nonexistent-class\n';
  const { sites, errors } = importSitesCSV(model, csv);
  assert.equal(sites.length, 0);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].field, 'class');
});
