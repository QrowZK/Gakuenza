# SPEC — Decentralize `module-units.js` (kill the shared-registry conflict class)

**Status:** scoped, ready to build. **Written:** 2026-07-17.

> **Placement note.** `docs/specs/` (not `pending/`) — this touches shared hub
> JS + every module, not a single new module; hand-assign to a subagent.

## Problem
`gakuenza.com/hub/module-units.js` is a single hand-edited object literal
(`window.MODULE_UNITS`, 17 module blocks) that **every module PR appends to**.
Parallel module builds therefore collide on it. The `.gitattributes`
`merge=union` stopgap auto-resolves without conflict markers **but corrupts the
file into invalid JS** — verified twice now (`node --check` failures on sansu1
and kokugo1 during the grade-1/2 merge; #88/#89/#90 had to be consolidated by
hand in #93). Union merge is fundamentally wrong for structured JS. As long as a
shared source file is the registry, this recurs on every parallel module batch.

## Goal
**A module PR touches only its own `modules/<key>/` directory** — never a shared
registry file. Eliminate `hub/module-units.js` as a hand-edited source of truth.

## Consumers today (all must be updated)
- `hub/module-assign-common.js` — `window.moduleUnitsFor(moduleKey)` / `window.MODULE_UNITS` (the focus-unit checkbox source).
- `hub/gradebook/assign.html:74,125` — loads `../module-units.js`, calls `moduleUnitsFor(key)`.
- `hub/admin/class-detail.html:331` — loads `../module-units.js`.
- (`modules.html` matrix renders pickers via `module-assign-common.js`.)

## Design (recommended) — per-module units file, lazy-loaded
Each module owns a tiny **`modules/<key>/units.js`** that self-registers:

```js
// modules/sansu1/units.js
(function () {
  window.MODULE_UNITS = window.MODULE_UNITS || {};
  window.MODULE_UNITS.sansu1 = [
    { key: 'u01_to10', label: '1. 10までのかず' },
    /* … */
  ];
})();
```

`moduleUnitsFor` becomes **async + cached**, loading the module's own file on
demand (the module list already comes from the DB `modules` catalog, so no
shared manifest is needed):

```js
// module-assign-common.js
const _unitCache = {};
window.moduleUnitsFor = async function (key) {
  if (_unitCache[key]) return _unitCache[key];
  if (!(window.MODULE_UNITS && window.MODULE_UNITS[key])) {
    await loadScriptOnce(`/modules/${key}/units.js`);  // 404 / no-units → []
  }
  return (_unitCache[key] = (window.MODULE_UNITS?.[key]) || []);
};
```

`loadScriptOnce` injects `<script>` once per key and resolves on load/error
(a module with no unit picker simply 404s → `[]`, exactly today's "no entry =
no picker" behavior). The two pages drop their static
`<script src="../module-units.js">` include; the picker render sites `await`
`moduleUnitsFor(key)` (they already render async against the DB).

**Then delete `hub/module-units.js` and its `.gitattributes merge=union` line.**
No shared file remains for module PRs to touch.

### Why not a generated registry
A CI/script that regenerates `module-units.js` from the modules would also work,
but it adds a build step to a deliberately no-build static site and still ships
a generated shared file. Per-module lazy load fits the architecture better.

## Migration (one-time)
1. For each of the 17 modules currently in `MODULE_UNITS`, create
   `modules/<key>/units.js` with its existing block (verbatim — keys already
   match each module's internal unit keys).
2. Update `module-assign-common.js` (`moduleUnitsFor` → async+cache+lazy-load),
   and the two consumer pages to `await` it and drop the static include.
3. Delete `hub/module-units.js`; remove its `merge=union` line from
   `.gitattributes`.
4. Update `CLAUDE.md`'s `module-units.js` schema note to the new convention:
   **"a module declares its units in `modules/<key>/units.js`; there is no
   shared registry — never reintroduce one."** Update the module-directory
   convention + every module spec (`SPEC_*_new_module.md`) to require `units.js`
   instead of a `module-units.js` edit.

## Testing
- Assignment UIs render the correct focus-unit picker for every existing module
  (sansu3, kokugo3, the grade-5/6 set, sansu1/2, kokugo1/2) — spot-check a few
  live, and a module with no `units.js` shows no picker (no error).
- `focus_units` write/read round-trip still works (unchanged data path).
- A new module added with only `modules/<key>/units.js` (no shared-file edit)
  gets a working picker — the whole point.

## Payoff
Kills the entire conflict class: parallel module PRs never touch a shared file,
so no union-merge corruption, no consolidation toil. Module specs get simpler
(one fewer shared-file step).
