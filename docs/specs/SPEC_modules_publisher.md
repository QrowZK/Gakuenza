# SPEC — Publisher / textbook-series attribution on module cards

**Issue:** #81 · **Status:** decisions locked, ready to build · **Written:** 2026-07-17

> **Placement note.** This lives in `docs/specs/` (not `docs/specs/pending/`)
> on purpose: the `pending/` path auto-fires `auto-build-module.yml`, which
> builds *modules*. This is an admin-page + schema change, not a module —
> hand it to a subagent or build it directly. Do not drop it in `pending/`.

## Decisions locked (by product owner, 2026-07-17)
- **Nullable free-text `publisher` column** on `modules` (no enum, no lookup table).
- **Migration-only** — no in-UI editing (consistent with how `subject` /
  `launch_url` are only changed via migration today). Read-only display on cards.
- One publisher per module for now (single column). A `module_publishers`
  junction is a future option only if multi-publisher-per-module becomes real.

## Motivation
The admin catalog (`hub/admin/modules.html`) gives no way to see which textbook
series a module aligns to. Publisher data exists only as prose in
`docs/planning/MODULE_ROADMAP.md`, never persisted or surfaced. A platform_admin
running multiple schools (different adopted textbooks) needs this visible.

## 1. Schema migration
`supabase/migrations/<applied_ts>_add_modules_publisher.sql` — apply via MCP
`apply_migration` (writes the ledger), commit the file **named to the applied
ledger version** in the same PR (avoid the filename↔ledger drift seen with the
Kadaiban migrations).

```sql
-- Nullable free-text publisher/textbook-series attribution for catalog cards (#81).
alter table public.modules add column if not exists publisher text;
comment on column public.modules.publisher is
  'Textbook series / publisher a module aligns to, for admin display. Free text, nullable.';
```
No RLS change: `modules` is already read-only to all authenticated users; a
descriptive column touches no policy and exposes no PII.

## 2. Backfill (one-time, idempotent)
From `MODULE_ROADMAP.md` §publisher-facts. Ship in the **same** migration:

```sql
update public.modules set publisher = case key
  when 'sansu3' then '東京書籍'  when 'sansu4' then '東京書籍'
  when 'sansu5' then '東京書籍'  when 'sansu6' then '東京書籍'
  when 'rika3'  then '東京書籍'  when 'rika4'  then '東京書籍'
  when 'rika5'  then '東京書籍'  when 'rika6'  then '東京書籍'
  when 'shakai3' then '東京書籍' when 'shakai4' then '東京書籍'
  when 'shakai5' then '東京書籍' when 'shakai6' then '東京書籍'
  when 'kokugo3' then '光村図書' when 'kokugo5' then '光村図書'
  when 'kokugo6' then '光村図書'
  when 'nh6' then '東京書籍（New Horizon Elementary）'
  when 'nhvocab' then '東京書籍（New Horizon）'
  when 'letstry1' then '文部科学省（Let''s Try!）'
  when 'letstry2' then '文部科学省（Let''s Try!）'
  when 'kanken3' then '日本漢字能力検定協会' when 'kanken4' then '日本漢字能力検定協会'
  when 'kanken5' then '日本漢字能力検定協会'
  when 'eiken' then '日本英語検定協会'
  else publisher
end
where key in ('sansu3','sansu4','sansu5','sansu6','rika3','rika4','rika5','rika6',
  'shakai3','shakai4','shakai5','shakai6','kokugo3','kokugo5','kokugo6',
  'nh6','nhvocab','letstry1','letstry2','kanken3','kanken4','kanken5','eiken');
```
> `eiken`/`kanken`/`letstry` attribute to the testing org / MEXT rather than a
> commercial textbook — reasonable, but the owner may prefer `null` for those;
> easy to change. Any module not listed stays `null` (renders with no badge).

## 3. Registration convention (going forward)
Future `register_<module>_module.sql` inserts should include `publisher` in the
idempotent insert…on-conflict-update, alongside `key/name/subject/…` (rule 5).
Add a line to `CLAUDE.md`'s registration-migration note so it isn't forgotten.

## 4. UI — `hub/admin/modules.html`
- `load()` (~line 119): add `publisher` to the `modules` select:
  `.select('id, key, name, name_en, subject, is_active, publisher')`.
- `renderCatalog()` (~line 154): render publisher as a small muted label inside
  `.md-cat-body`, under `name_en`, only when non-null:
  ```js
  ${m.publisher ? `<div class="md-cat-pub">${esc(m.publisher)}</div>` : ''}
  ```
- `admin.css` (self-contained per the resolved admin-CSS rule — copy tokens, do
  **not** link root `style.css`): add
  `.md-cat-pub { font-size: 11px; color: var(--ink-soft); margin-top: 2px; }`.

## 5. Testing bar
- **Migration idempotency:** run twice — `add column if not exists` + `update`
  produce no error and no duplicate effect.
- **UI:** a module with a publisher shows the label; a `null`-publisher module
  renders cleanly with no empty element. Verify in the real admin page.
- No generator/flow test needed (no module content changed).

## Out of scope (future, if requested)
- Editing publisher from the UI (would need a new admin RPC like
  `app_set_module_active`).
- Filtering/grouping the catalog by publisher.
- Surfacing publisher in `assign.html` / `module-assign-common.js`.
- `module_publishers` junction for multi-publisher modules.

## Acceptance
Publisher is stored on `modules`, backfilled for existing rows, visible read-only
on each catalog card, and null-safe — with the migration applied via MCP and the
matching file committed.
