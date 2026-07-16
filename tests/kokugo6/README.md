# kokugo6 tests

Tests live here (outside `gakuenza.com/`) so they are never rsynced to the
production host — the deploy workflow's rsync source is `./gakuenza.com/`.

## Run

```sh
# Kanji generator + data stress test (structural + distractor-collision,
# 24k instances; also asserts KANJI6 == 191 chars, the 2020-revision grade-6 set)
node tests/kokugo6/kanji-generator.test.js

# Grammar generator stress test (structural + distractor-collision + the
# curated per-unit invariants each collision guard relies on, 20k instances)
node tests/kokugo6/grammar-generators.test.js

# End-to-end quiz flow (kanji / grammar) through the real UI, asserting
# HubCommon.reportActivityWithItems is called with the right module_id and a
# populated per-question items array (activity_result_items).
# Needs Playwright + Chromium. If Playwright isn't a local dep, point at it:
PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.js \
  node tests/kokugo6/flow.test.mjs
```

The flow test stubs the hub scripts (`supabase.js` / `config.js` /
`hub-common.js`) so no live backend is required.

## Notes

- **Grade-6 kanji list (191).** `kanji-data.js` documents the three-way
  verification of the count and set (two independent references, the 2020
  per-grade totals, and a programmatic KANJIDIC2 delta). The kanji test
  re-asserts `KANJI6.length === 191` so a future edit can't silently drift.
- Reading-comprehension units are deliberately deferred (see the module spec),
  so there is no reading-flow test yet — only kanji and grammar.
