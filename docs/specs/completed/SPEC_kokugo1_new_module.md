# kokugo1 — 国語 1年 — new module build spec

**Issue/roadmap:** MODULE_ROADMAP §3.5, Tier B. **Status:** ready to build.
With `sansu1` this fills the grade-1 hub. **This is NOT a smaller kokugo3** —
grade 1 is the early-literacy grade; the center of gravity is **かな**, not kanji.

> **Placement note.** In `docs/specs/` (not `pending/`) — hand-assigned to a subagent.

## Module identity
Directory `modules/kokugo1/`, key `kokugo1`, subject `'japanese'`,
launch_url `/modules/kokugo1/index.html`, name `国語 1年`, recommended_grades `[1]`.

## Publisher & scope (READ — this is where kokugo5 nearly went wrong)
Publisher **光村図書 (Mitsumura Tosho)** — the same line kokugo3/5/6 were built
against. **Do NOT pull Tokyo Shoseki's 国語 line** (the exact mistake the kokugo5
spec caught). Ship **kana + 80 kanji + basic grammar/orthography ONLY**; defer
Mitsumura reading-comprehension units to a properly-sourced research pass (same
discipline as kokugo4/5/6 — a kana+kanji module is real and testable on its own).

## Build priority (kana-first)
1. **ひらがな** recognition/reading — 50音, 濁音/半濁音, 拗音・促音・長音
2. **カタカナ** recognition/reading
3. **助詞 は・を・へ** — particle usage (the canonical grade-1 orthography point)
4. **句読点・かぎ** — basic punctuation placement
5. **漢字 80字** — kokugo3 `kanji-generator.js` pattern, small closed list

**Verify the grade-1 MEXT 学年別漢字配当表 (the 80-kanji list) against a
dedicated reference** — do not reconstruct from memory (same rigor kokugo3's
list got).

## Design
Follow kokugo3's architecture: `kanji-generator.js` (reading / character-select
/ stroke-count question types, procedural — not a fixed bank) + closed
rule-system generators for the kana/orthography units, templated on kokugo3's
`grammar-generators.js`. Self-contained `style.css` (rule 1). Furigana-friendly,
large touch targets — this is 6-year-olds (see UI_REDESIGN child-UX notes).

## Distractor-collision cautions (kokugo3 shipped this bug class TWICE)
- かな/kanji reading: a distractor character/reading must **never** also be a
  correct reading of the prompt (同訓/同音 leakage) — draw distractors from
  readings provably not attached to the target, by construction.
- 拗音(きゃ/きゅ/きょ) vs 促音 vs 長音 spelling: fix sentence context so exactly
  one spelling is right.
- 助詞 は/わ・を/お・へ/え: disambiguate by fixed context — never emit two
  options both valid.
- Stroke-count: ≥4 options, no distractor equals the true count.
**Stress-test 500–5000 per generator** — these bugs only surface at scale.

## Reporting (hard rule 2)
`HubCommon.reportActivityWithItems(...)` with populated `items`; context via
`enrollments → classes.school_id` (rules 2 & 3).

## module-units.js keys (`kokugo1`) — must equal internal keys exactly
`hiragana`, `katakana`, `joshi` (は・を・へ), `kutouten` (句読点・かぎ), `kanji`
(80字). Match kokugo5/6's convention of registering only kana/kanji/grammar keys
(no reading keys). Add the `kokugo1` block to `hub/module-units.js`.

## Registration migration
Idempotent: `key='kokugo1'`, `subject='japanese'`,
`launch_url='/modules/kokugo1/index.html'`, `name='国語 1年'`,
`recommended_grades='{1}'`, `publisher='光村図書'`, `is_active=true` explicit.
Apply via MCP `apply_migration` + commit the file named to the applied ledger version.

## Testing / copyright
- **Testing bar:** generator stress-test at scale (distractor collisions) + a
  headless flow test (reporting + `activity_result_items`); migration idempotency.
- **Copyright:** closed systems / official kanji list — **no passage
  reproduction in this scope**. Reading units, when eventually built, follow
  "reference, don't reproduce" exactly as kokugo3.
