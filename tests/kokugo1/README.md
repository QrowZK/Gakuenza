# kokugo1 tests

Tests live here (outside `gakuenza.com/`) so they are never rsynced to the
production host — the deploy workflow's rsync source is `./gakuenza.com/`.

kokugo1 is the grade-1 国語 module. Grade 1 is the early-literacy grade, so the
centre of gravity is **かな**, not kanji. It ships **ひらがな / カタカナ / 助詞
は・を・へ / 句読点・かぎ / 漢字80字** only — Mitsumura (光村図書)
reading-comprehension units are deferred to a correctly-sourced research pass,
same discipline as kokugo4/5/6.

## Run

```sh
# Kanji generator stress test — 80 grade-1 kanji, 3 question types x 6000
# instances each, structural + the two distractor-collision bugs kokugo3
# shipped (same-reading distractor; <4 distinct stroke-count options).
node tests/kokugo1/kanji-generator.test.js

# かな / 助詞 / 句読点 generator stress test — 4 units x 5000 instances each,
# structural + distractor-collision checks (gojuon sound-uniqueness, 濁音/半濁音
# mapping, 促音・拗音・長音 spelling, は・を・へ twin-only distractors,
# 句読点 single-correct-mark authoring) + bank coverage.
node tests/kokugo1/unit-generators.test.js

# End-to-end quiz flow (all five units) through the real UI, asserting
# HubCommon.reportActivityWithItems is called with the right module_id and a
# populated per-question items array (activity_result_items).
# Needs Playwright + Chromium. If Playwright isn't a local dep, point at it:
PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.js \
  node tests/kokugo1/flow.test.mjs
```

The flow test stubs the hub scripts (`supabase.js` / `config.js` /
`hub-common.js`) so no live backend is required.
