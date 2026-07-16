# kokugo5 tests

Tests live here (outside `gakuenza.com/`) so they are never rsynced to the
production host — the deploy workflow's rsync source is `./gakuenza.com/`.

kokugo5 ships the **kanji drill + grammar** only (no reading-comprehension
units yet — those are deferred to a correctly-sourced Mitsumura pass, per the
build spec).

## Run

```sh
# Kanji generator stress test — 193 grade-5 kanji, 3 question types x 6000
# instances each, structural + the two distractor-collision bugs kokugo3
# shipped (same-reading distractor; <4 distinct stroke-count options).
node tests/kokugo5/kanji-generator.test.js

# Grammar generator stress test — 敬語 / 慣用句 / 和語漢語外来語 / 同じ読み方の漢字,
# 5000 instances each, structural + distractor-collision checks.
node tests/kokugo5/grammar-generators.test.js

# End-to-end quiz flow (kanji + all four grammar units) through the real UI,
# asserting HubCommon.reportActivityWithItems is called with the right
# module_id and a populated per-question items array (activity_result_items).
# Needs Playwright + Chromium. If Playwright isn't a local dep, point at it:
PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.js \
  node tests/kokugo5/flow.test.mjs
```

The flow test stubs the hub scripts (`supabase.js` / `config.js` /
`hub-common.js`) so no live backend is required.
