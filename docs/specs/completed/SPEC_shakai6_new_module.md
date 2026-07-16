<!-- BUILD STATUS: completed 2026-07-16 (branch claude/build-from-spec-g0b5fl) -->
<!-- Built: modules/shakai6/ (3 units / 18 sections / 115 questions, 10 sequencing
     questions). National-scope content (歴史・政治・国際関係) — no region
     substitution needed. History (unit 2) is section-level focus-scoped with a
     distinct key per chronological period (u2a_jomon_kofun .. u2l_postwar_japan);
     units 1 & 3 share one key each (u1_politics / u3_japan_and_the_world).
     hub/module-units.js entry added. Registration migration committed
     (db/2026-07-16_register_shakai6_module.sql +
     supabase/migrations/20260716043000_register_shakai6_module.sql) but NOT yet
     applied to the live project — apply on merge, same as prior module
     registrations. (Version stamped after the live ledger tip 20260716041856;
     re-stamp to a fresh unique version at merge via MCP apply_migration, after
     the frontend deploys, per supabase/README.md.) Tested: structural/collision test (115 Q, 0 errors) +
     headless-browser flow test (activity_result_items populated, focus_units
     section-level foregrounding verified). -->

# shakai6 — new module build spec

Built against 東京書籍「新編 新しい社会」第6学年, 令和6年度版
(shakai_keikaku_ryakuan_6.pdf, fetched directly from Tokyo Shoseki).

## Module identity

Directory `modules/shakai6/`, key `shakai6`, subject `'social'`,
launch_url `/modules/shakai6/index.html`, name `社会 6年`.

## Verified unit structure — 3 units, 105 hours

1. **わたしたちの生活と政治** (19h) — the Japanese Constitution and
   daily life, the structure of national government and elections, a
   選択 sub-unit (child-rearing support policy vs. disaster-recovery
   policy — pick one, same reasoning as other 選択 units elsewhere:
   build both for a practice tool).
2. **日本の歴史** (72h, the largest unit in all of elementary social
   studies) — a clean, sequential 12-part history curriculum:
   縄文〜古墳時代 → 天皇中心の国づくり → 貴族のくらし → 武士の世 →
   室町文化 → 戦国〜天下統一 → 江戸幕府 → 町人文化・新しい学問 →
   明治の国づくり → 世界に歩み出した日本 → 長く続いた戦争と人々の
   くらし → 新しい日本、平和な日本へ.
3. **世界の中の日本** (14h) — Japan's international relationships,
   Japan's role in the world's future.

## This is genuinely the safest content in the whole grade-5/6 batch

Like shakai5, this is national-scope content, not regional — the
Miyagi/Ishikawa substitution problem doesn't apply. **History
specifically is about as safe as content gets**: historical facts and
timelines are extensively documented across countless independent
sources, definitively not any single textbook's copyrighted
expression. This is very well suited to a large, fact-based generated
or semi-generated question bank (dates, sequence-ordering, cause-
effect relationships across the 12 historical periods).

## Design approach

- **Unit 2 (history)** — the clean 12-part chronological structure is
  extremely well-suited to sequencing/ordering question types ("which
  came first"), period-identification questions, and cause-effect
  questions (what led to X). Given the sheer size of this unit (72 of
  105 total hours — over two-thirds of the year), it deserves
  proportionally more content than units 1 and 3.
- **Unit 1 (politics/constitution)** — fixed, authored content;
  government structure and constitutional facts are stable and
  well-documented, safe to build directly.
- **Unit 3 (international relations)** — smallest unit, straightforward
  fixed content on Japan's real international relationships and
  organizations.

## Copyright

Historical facts, constitutional structure, and international-
relations facts are all independently and extensively documented —
safe, original-wording content. Never reproduce the reference PDF's
specific phrasing regardless of how safe the underlying facts are.

## Testing

Same structural bar as every shakai module. Given history's natural
fit for sequencing questions, apply the same distractor-collision
discipline used elsewhere — a "which came first" question needs
genuinely unambiguous chronological distractors, not two periods close
enough in time to create a defensible alternate answer.

## focus_units

Build to honor `class_modules.focus_units` from the start. Given
unit 2's size, consider sub-unit-level keys for history specifically
rather than one single key for all 72 hours — e.g. `u2a_jomon_kofun`
through `u2l_postwar_japan`, alongside `u1_politics` and
`u3_japan_and_the_world`.

## Build notes (as implemented)

- **Sequencing / distractor discipline.** All 10 order questions use
  three items spanning clearly-separated dates so no alternate ordering
  is defensible (e.g. 鉄砲伝来 1543 → 長篠の戦い 1575 → 天下統一 1590;
  満州事変 1931 → 日中戦争 1937 → 太平洋戦争 1941). The disputed
  1185/1192 Kamakura date is deliberately avoided — the module asks for
  the place (鎌倉) and the person (源頼朝), never that year as a typed
  answer.
- **Section-level focus.** Because history is one 72h unit but the spec
  wants per-period focus keys, `focus_units` is matched at the section
  level (see `modules/shakai6/app.js` `partitionUnits`): a unit is
  foregrounded when any of its sections is assigned, and non-assigned
  sections stay visible but dimmed — never hard-hidden. Units 1 and 3
  give every section the same single key. Fails soft to "all units" on
  null/empty/no-match.
- **Sensitive content.** The wartime section (⑪) is handled factually
  and with restraint (a `care` note frames it around remembering the
  cost of war and valuing peace), consistent with the tonal care noted
  for emotionally-weighted content elsewhere in this project.
