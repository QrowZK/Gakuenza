# rika6 tests

Tests live here (outside `gakuenza.com/`) so they are never rsynced to the
production host — the deploy workflow's rsync source is `./gakuenza.com/`.

## Run

```sh
# Generator stress test (structural + distractor-collision, 100k instances)
# plus authored-data integrity and unit-key registry alignment
# (RIKA6_DATA.UNIT_KEYS <-> modules/rika6/units.js rika6).
node tests/rika6/rika6.test.js

# End-to-end quiz flow through the real UI (choice + order questions),
# asserting HubCommon.reportActivityWithItems is called with the right
# module_id and a populated per-question items array (activity_result_items).
# Needs Playwright + Chromium. If Playwright isn't a local dep, point at it:
PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.js \
  node tests/rika6/flow.test.mjs
```

The flow test stubs the hub scripts (`supabase.js` / `config.js` /
`hub-common.js`) so no live backend is required.
