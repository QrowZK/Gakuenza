# kokugo3 tests

Tests live here (outside `gakuenza.com/`) so they are never rsynced to the
production host — the deploy workflow's rsync source is `./gakuenza.com/`.

## Run

```sh
# Generator stress test (structural + distractor-collision, 16k instances)
node tests/kokugo3/grammar-generators.test.js

# Reading-unit fixed-bank structural check
node tests/kokugo3/reading-units.test.js

# End-to-end quiz flow (kanji / reading / grammar) through the real UI,
# asserting HubCommon.reportActivityWithItems is called with the right
# module_id and a populated per-question items array (activity_result_items).
# Needs Playwright + Chromium. If Playwright isn't a local dep, point at it:
PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.js \
  node tests/kokugo3/flow.test.mjs
```

The flow test stubs the hub scripts (`supabase.js` / `config.js` /
`hub-common.js`) so no live backend is required.
