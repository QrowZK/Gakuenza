# kokugo4 tests

Tests live here (outside `gakuenza.com/`) so they are never rsynced to the
production host — the deploy workflow's rsync source is `./gakuenza.com/`.

kokugo4 ships the **kanji drill + grammar** only (no reading-comprehension
units yet — those are deferred to a correctly-sourced 光村図書 pass, per the
build spec).

## Grade-4 kanji list provenance

`kanji-data.js` holds the **202** grade-4 配当漢字 (MEXT 学年別漢字配当表,
2020年度〜 新課程 — the post-2020 count; the pre-2020 set was 200). The
character SET was cross-checked between two independent references that agreed
**character-for-character** — ieben.net's 新学習指導要領 grade-4 list and
みんなの知識ちょっと便利帳's 2020年度施行 grade-4 checker. Per-character
readings/strokes come from KANJIDIC (via kanjiapi.dev); KANJIDIC's own `grade`
field reflects the OLD assignment, so it was used ONLY for readings/strokes,
never for grade membership. Bound-form-marker readings (leading/trailing `-`)
were filtered so a "correct" reading is never a standalone form a 4th grader
would never see.

## Run

```sh
# Kanji generator stress test — 202 grade-4 kanji, 3 question types x 6000
# instances each, structural + the two distractor-collision bugs kokugo3
# shipped (same-reading distractor; <4 distinct stroke-count options).
node tests/kokugo4/kanji-generator.test.js

# Grammar generator stress test — 部首 / 熟語の組み立て / つなぎ言葉 /
# 主語述語 / 慣用句, 5000 instances each, structural + distractor-collision
# checks (radical uniqueness, single-category compounds, disjoint connective
# sets, single 主語/述語 per sentence, distinct-meaning idiom bank).
node tests/kokugo4/grammar-generators.test.js

# End-to-end quiz flow (kanji + all five grammar units) through the real UI,
# asserting HubCommon.reportActivityWithItems is called with the right
# module_id and a populated per-question items array (activity_result_items).
# Needs Playwright + Chromium. If Playwright isn't a local dep, point at it:
PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.js \
  node tests/kokugo4/flow.test.mjs
```

The flow test stubs the hub scripts (`supabase.js` / `config.js` /
`hub-common.js`) so no live backend is required.
