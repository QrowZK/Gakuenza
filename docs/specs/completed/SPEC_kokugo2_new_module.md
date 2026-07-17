# kokugo2 — 国語 2年 — new module build spec

**Issue/roadmap:** MODULE_ROADMAP §3.4, Tier B. **Status:** ready to build.
Kanji + kana/orthography + grammar; reading deferred. With `sansu2` this fills
the grade-2 hub.

> **Placement note.** In `docs/specs/` (not `pending/`) — hand-assigned to a subagent.

## Module identity
Directory `modules/kokugo2/`, key `kokugo2`, subject `'japanese'`,
launch_url `/modules/kokugo2/index.html`, name `国語 2年`, recommended_grades `[2]`.

## Publisher & scope
Publisher **光村図書 (Mitsumura Tosho)** — NOT Tokyo Shoseki's 国語 line (the
kokugo5 mistake). Ship **kanji + kana/orthography + grammar ONLY**; defer
Mitsumura reading units (same discipline as kokugo1/4/5/6).

## Units to build
1. **漢字 (grade-2 list)** — MEXT 学年別漢字配当表 grade-2 closed set (**verify
   the complete list + official count** against a dedicated reference). kokugo3
   `kanji-generator.js` pattern. Grade-2 kanji have more 音訓 pairs than grade 1
   — good reading-drill material.
2. **カタカナ** — forms + when to use カタカナ (外来語/擬音語)
3. **かなづかい** — は/わ, を/お, へ/え particle spelling; ぢ/じ, づ/ず;
   長音・拗音・促音 spelling
4. **主語と述語** — subject/predicate identification (grade-2 intro)
5. **なかまの言葉・反対の言葉** — word categories, antonyms
6. **丸・点・かぎ** — 句読点・かぎかっこ placement

## Design
kokugo3 architecture: procedural `kanji-generator.js` + closed rule-system
generators for the kana/orthography/grammar units (templated on kokugo3's
`grammar-generators.js`). Self-contained `style.css` (rule 1); furigana-friendly,
large targets (7-year-olds).

## Distractor-collision cautions (kokugo3 shipped this twice)
- Same kanji-generator discipline as kokugo1: reading distractors never a valid
  reading of the target; stroke-count ≥4 options, none equal to the true count.
- **かなづかい:** a "wrong spelling" distractor must be genuinely wrong — watch
  homophone traps where two spellings are both acceptable in different contexts;
  disambiguate by fixing the sentence context so exactly one is right.
- **antonyms/categories:** ensure only one option is the true antonym/member.
**Stress-test 500–5000 per generator.**

## Reporting (hard rule 2)
`HubCommon.reportActivityWithItems(...)` with populated `items`; context via
`enrollments → classes.school_id` (rules 2 & 3).

## module-units.js keys (`kokugo2`) — must equal internal keys exactly
`kanji`, `katakana`, `kanazukai`, `shugo_jutsugo`, `nakama` (なかま・反対の言葉),
`kutouten`. Add the `kokugo2` block to `hub/module-units.js`.

## Registration migration
Idempotent: `key='kokugo2'`, `subject='japanese'`,
`launch_url='/modules/kokugo2/index.html'`, `name='国語 2年'`,
`recommended_grades='{2}'`, `publisher='光村図書'`, `is_active=true` explicit.
Apply via MCP `apply_migration` + commit the file named to the applied ledger version.

## Testing / copyright
- **Testing bar:** generator stress-test at scale (distractor collisions) + a
  headless flow test (reporting + `activity_result_items`); migration idempotency.
- **Copyright:** closed systems / official kanji list — no passage risk in this scope.
