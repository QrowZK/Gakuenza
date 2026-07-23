# 外国語 6年 (eigo6) — ported module

> **Rekeyed 2026-07-23 (roadmap debt #8):** module key `nh6` → `eigo6` and
> directory `modules/nh6/` → `modules/eigo6/`, to match the 外国語 5/6 pair
> (`eigo5`/`eigo6`) internally. `<key>-report.js` and the `<key>-*` localStorage
> keys moved with it; the `modules` row's `key`/`launch_url` were flipped by a
> migration once the renamed directory was live. Content is unchanged (still the
> New Horizons 6 port described below). A redirect stub remains at
> `modules/nh6/index.html` → `/modules/eigo6/index.html` for old links.

## Where this goes
`modules/eigo6/` (all 7 files) drops in alongside `modules/eiken/`, same
convention throughout. A registration migration registers it in the
`modules` table — run once, idempotent.

## What changed from the original NH6WebUtil repo
- **Deleted:** `supabase-client.js` (pointed at a different Supabase
  project — `rfntsrcguhldybddfgcl.supabase.co` — with its own auth and a
  `quiz_results` table), the login button + full auth modal (~100 lines
  removed from `app.js`, the modal markup removed from `index.html`), and
  everything PWA-related (`manifest.json`, `sw.js`, both icon files) —
  none of Gakuenza's other modules register a service worker or manifest,
  and one scoped to a module subpath risks caching/scope surprises for
  the rest of the site.
- **Added:** `eigo6-report.js` — same role as `eiken-report.js`. Trusts the
  Gakuenza session already established by the hub and defines a minimal
  `window.hk` (`getUser()` + `syncQuizResult()`) — the exact two calls
  `app.js`'s `showResults()` already made, unmodified. Also adds the
  module-topbar + account-bubble UI (back-to-hub link, real Gakuenza
  name, sign-out) — same markup/CSS as eiken, so the removed login button
  is replaced with something, not just deleted outright.
- **Unchanged:** `data.js`, `writing.js`, `tts.js`, and the entire quiz/
  writing engine in `app.js` — none of the actual pedagogical content or
  logic was touched, only the backend/auth seam.
- **Rebranded:** title, header, `module-name` → "New Horizons 6".
  `modules` table: `name` = "New Horizons 6 練習", `name_en` =
  "New Horizons 6", `subject` = `english`.

## Testing performed
Syntax-checked every JS file, then ran the real ported page (real
`supabase.js`, real app.js/quiz engine, nothing about the app's own logic
mocked) over local HTTP through Playwright, intercepting only the network
layer — including explicitly intercepting the *old* Hakui backend domain
to prove it's never contacted anymore. Played a full 10-question grammar
quiz for real (clicking actual answer choices) rather than stubbing the
result. All passing:

1. No trace of the old login button or auth modal anywhere in the DOM.
2. Title/header correctly rebranded.
3. Module topbar's back-link points at the hub; account bubble shows the
   *real* Gakuenza profile name (not a placeholder).
4. Full quiz playthrough reaches the results screen and shows the
   "✓ 成績を保存しました" confirmation.
5. The resulting `activity_results` insert has the correct `school_id`,
   `class_id`, `module_id`, `user_id`, an `activity_ref` shaped like
   `eigo6/u1/grammar/<timestamp>`, and correct `score`/`max_score`.
6. The old Hakui Supabase project (`rfntsrcguhldybddfgcl.supabase.co`) is
   never contacted — zero requests.
7. Writing-practice mode (which deliberately does *not* sync — handwriting
   isn't scored) loads and renders its canvas with zero console errors.

Registration migration applied and re-applied against a test database —
idempotent, correct row.

## One thing to revisit once TangoApp is ported
The vocab-practice link inside NH6 (unit screen → 単語練習 card, and the
per-unit deep link in `buildUnitScreen()`) still points at the *external*
`https://hakuicity.github.io/TangoApp/` — left as-is since TangoApp isn't
a Gakuenza module yet and a working external link beats a broken internal
one. Once TangoApp is ported, update both references in `app.js` to the
internal module path instead.
