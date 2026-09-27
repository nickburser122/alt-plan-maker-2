# Mauvine Rota

A bilingual English/Arabic, browser-based rota planner for people, sites, scheduling rules and generated assignments. The application is a static ES-module website; the scheduler runs in a browser Web Worker with a time-sliced main-thread fallback.

## Completed features

- Responsive workspace with six views: Plan, Resources, Sites, Rules, Summary and Settings.
- Toolbar with undo/redo (Ctrl+Z / Ctrl+Y or Ctrl+Shift+Z) and an English/Arabic switch; switching views or language does not create undo steps.
- Plan: descriptive title, date range, coverage/open-slot/hard/soft issue chips, labelled columns, role-tagged person buttons that lock and unlock assignments. Generate uses a new seed each time; locked assignments are kept.
- Resources: bilingual-safe name editing, role chips (the last role can't be removed), per-weekday availability, confirm-to-delete.
- Sites: name, class dropdown, distance (only shown when a km attribute exists), active toggle, confirm-to-delete.
- Rules: grouped rule-type picker, severity control (Off disables the rule), weight slider with value (applies to soft rules), typed editors for numbers, weekdays, roles, people, attributes and date lists, and previews that use real names.
- Summary: KPI cards, workload bars sorted by load, per-day counts and a violations table with severity, rule and readable details.
- Guided setup using field-visits, shift-roster, on-call, duty-rota or blank presets.
- Editable resources, sites, bilingual roles and site classes, weekly coverage and horizon dates, constraints and engine options; guarded removal prevents breaking referenced model data.
- Deterministic schedule generation, coverage and fairness summaries, open-slot explanations and assignment locking.
- English/Arabic interface with RTL support.
- CSV imports for resources and sites; plan exports as CSV, TSV, Markdown, text, ICS or JSON; model JSON export/import.
- Local undo/redo state, browser-local persistence, v1-to-v2 data migration and validation on restore/import.
- Included Node test files, dependency-free static build script, and GitHub Actions CI checks for tests and build output.

## Entry URIs and commands

- `/` or `/index.html` — application. No URL parameters are required; view selection and settings are kept in browser storage.
- `/tests/browser/*.html` — development-only harnesses. `probe.html` runs an end-to-end UI check (add, edit, confirm-delete, undo, rule editors, calendar, lock, RTL) and `core-probe.html` solves every preset; both report PASS/FAIL in the console. `views.html?view=…&preset=…`, `plan-ar.html` and `summary-ar.html` are visual previews. Exclude `tests/` from what you publish if you don't want these public.
- `npm test` — run Node's built-in test runner (Node 20+ recommended).
- `npm run build` — copy the deployable static application into `dist/`.
- Serve the repository root or `dist/` through a static web server. Do not open the page through `file://`; ES modules and workers require an HTTP(S) origin. For GitHub Pages, publish the repository root or deploy `dist/` through a GitHub Actions Pages workflow; ensure the chosen site path is served with the same relative `src/` directory structure.

## Data and storage

The v2 model contains `schema`, bilingual `lexicon`, `attributes`, `roles`, `siteClasses`, `sites`, `resources`, `patterns`, `calendar`, `rules`, `objectives`, `engine`, `locks`, and `ui`. Plans are computed from the model and are not stored as a server-side database. Changes are saved under the `rota.v2` key in the current browser's `localStorage`. If present, older `mauveineRota.v1` data is migrated on first load. Model backup and restore use JSON files downloaded and read in the browser. CSV import reads local files in the browser. No external API or data table is configured. Google Fonts is the only optional external design dependency; system fonts are used if unavailable.

## Public URLs

No production URL or public API endpoint has been configured. Publishing requires the project's Publish tab, or a separately approved Hosted Deploy.

## Not yet implemented / operational limits

- No account system, multi-device sync, collaboration, or secure central backup. Browser storage is per device and can be cleared by the browser; export a JSON backup regularly.
- No server-side processing or authenticated API. The static build does not provide protected admin access or access-controlled data.
- The supplied Node tests and build have not been executed in this editing environment. The browser UI probe and core preset probe both pass; still run `npm test` and `npm run build` (CI does this) before release.
- Advanced model fields (rule scope, resource caps and preferences, site cadence, rotation patterns, per-date overrides) are honoured by the engine but are only editable via JSON import/export, not in the UI.
