# Gakuenza — Module & Page UI Redesign Scope

_Scoping/design doc. Written 2026-07-16. No code changed by this doc — it defines
direction and effort only._

Audience reminder: the pilot is **羽咋市立瑞穂小学校**, a Japanese public
elementary school. Most drills are played by **children (小1–小6)** on shared
tablets/Chromebooks. Legibility, big touch targets, furigana-friendliness, and a
calm-but-encouraging tone matter more here than in a typical adult web app. The
`kanken` family is the one exception (漢字検定, up to 中学卒業程度 — older
students); it needs the same legibility uplift but less of the playful
celebration layer.

---

## 0. The non-negotiable constraint (read first)

**Hard rule #1 forbids a shared module stylesheet.** The shared root
`style.css`'s generic `button { width:100% }` has broken production four times
when a module leaned on it. Every module's `style.css` is fully self-contained
and copies **token values literally** (`--ink #1c2530`, `--paper #f7f3ea`,
`--moss #4a6b4f`, `--gold #c9a24b`, `--clay #b5572e`, etc.). Modules already
follow two safe conventions:

- **Module-local variable names** to avoid cross-sheet collisions:
  `sansu3` uses `--m3-*`, `shakai4` uses `--s4-*` (see
  `modules/sansu3/style.css:8`, `modules/shakai4/style.css:6`).
- **Defensive `button { width:auto }`** so a future stray include can't
  re-introduce the footgun (`modules/sansu3/style.css:44`).

**Therefore the redesign shares _design_, never a _file_.** The mechanism
(section 2.0) is a documented, copy-pasted **"Module UI Kit"** — a canonical
block of tokens + component recipes kept in `docs/design/` as reference only,
**never linked via `<link>`**. Every module owns its own copy. This is the only
approach compatible with rule #1.

---

## 1. Audit — current visual quality, ranked

Line counts are a proxy, but combined with reading the actual CSS the tiers are
clear. Animation counts are `@keyframes`/`animation:` occurrences per module.

| Tier | Modules | CSS lines | Anim. | Assessment |
|---|---|---|---|---|
| **A — Polished** | `nhvocab`, `nh6`, `eiken` | 528 / 413 / 300 | 7 / 7 / 2 | Full design language: screen transitions, dark mode, signature motifs (`.eyebrow`, `.dot-rule`), rounded 16px cards with layered shadow, Zen Maru Gothic display type. `nhvocab` is the effective quality bar. |
| **B — Solid, static** | `sansu3/4/5/6`, `rika3/4/5/6`, `shakai3/4/5/6` | ~380–467 | 0 | Real component system: unit badges, lesson cards, `.point`/`.care` callouts, SVG figures, order/sequencing chips, hint rows, per-answer feedback panels, soft shadows (`modules/shakai4/style.css`). But **zero motion**, **no celebration/reward state**, static red/green feedback only. |
| **C — Plain** | `kokugo3/5/6`, `kanken3/4/5` | 78–80 / 88 | 0 | Flat vertical option lists, small type, no shadows/illustration, no reward state, instant border-color feedback, bare numeric result screen. These are the redesign's primary targets. |
| **—** | `letstry1`, `letstry2` | inline (1209 / 1375 line HTML, no `style.css`) | 0 / 2 | Ported apps with all CSS inline in the HTML. Out of visual scope for a first pass; noted for completeness. |

### What specifically makes Tier C "plain" (cited)

Using `kanken3` (`modules/kanken3/style.css`) and `kokugo3`
(`modules/kokugo3/style.css`) as the representatives:

1. **Body font is system sans, not the brand face.** Both set
   `body { font-family: -apple-system, …, sans-serif }`
   (`kanken3/style.css:23`, `kokugo3/style.css:21`) and apply Zen Maru Gothic
   **only** to titles/prompts. Tier B modules (`sansu3/style.css:36`,
   `shakai4/style.css:31`) set Zen Maru Gothic as the **body** font. The plain
   modules literally read less on-brand and less warm as a result.
2. **Type is small for children.** Prompt is `1.15–1.18rem`, options `1rem`,
   category chip `0.7rem`, subtitle `0.8rem`, notes `0.72rem`
   (`kanken3/style.css:42,49,53`, `kokugo3/style.css:27,43,44`). For a 小3
   reader on a tablet at arm's length these are borderline.
3. **Option rows are visually flat.** `.kk3-opt` / `.k3-opt`:
   `1.5px` border, no shadow, `padding:13px 16px` → ~44px tall (the iOS minimum,
   not generous) (`kanken3/style.css:53`, `kokugo3/style.css:47`). No icon, no
   number, no press animation beyond a border-color hover.
4. **Feedback is instantaneous and unrewarding.** Correct = moss border +
   `--moss-tint` fill; wrong = error border + 8%-alpha fill
   (`kanken3/style.css:56–57`). No check/✗ glyph, no motion, no encouraging
   copy — the same treatment an adult form validation would use.
5. **Result screen is a bare number.** `.k3-result-score` is a `2.2rem` number +
   a grey label + a plain review list (`kokugo3/style.css:57–63`). No
   celebration for a strong score, no はなまる/stamp motif, no illustration —
   nothing that says "you did well" to a child. Tier A/B have no celebration
   either, but Tier C's result screen is the barest of all.
6. **No motion anywhere** (0 keyframes) and no `prefers-reduced-motion` handling
   because there's nothing to reduce.

### Hub pages (secondary surface)

`hub/*.html` (`index.html`, `grades.html`, `modules.html`, `settings.html`,
`login.html`) are **allowed** to link the shared root `style.css` +
`hub-shell.css` (they are not "modules" under rule #1 — see
`hub/index.html:7-8`). `hub-shell.css` is already well-developed: page-frame,
dark sidebar, dotted-gold section underlines, an animated logo mark and a
"つどう" login loader with `prefers-reduced-motion` support
(`hub-shell.css:20–97`). **Hub polish is good; leave it out of the first phase**
except to harvest its patterns (the dotted-gold `.section-title::after`
underline, `--shadow-card`, the progress-track recipe) into the Module UI Kit so
modules and hub feel like one product.

---

## 2. Shared design direction

The goal: bring Tier C up to Tier B's structural quality, then add a light,
**calm** reward/motion layer that also lifts Tier B — without ever crossing rule
#1. Everything below is expressed as concrete values ready to paste.

### 2.0 How to share design without sharing a stylesheet

Create **`docs/design/module-ui-kit.md`** (a companion follow-up to this doc, not
created here) containing:

- **The canonical `:root` token block** with literal values (the palette in
  CLAUDE.md rule #1) plus the additive tokens below (radii, spacing, shadow,
  motion). Modules copy it verbatim, renaming variables to their local prefix
  (`--k3-*`, `--kk3-*`, …) exactly as `sansu3`/`shakai4` already do.
- **Component recipes** (button, option card, progress, feedback, result) as
  paste-ready CSS with a `/* GZ-KIT: <component> vN */` header comment on each
  block, so a future audit can grep `GZ-KIT` across modules to find drift.
- **A version tag** (`GZ-KIT v1`) so we can tell which modules have been
  migrated.

This keeps every module self-contained (rule #1 satisfied — no `<link>`, no
runtime coupling) while giving us one source of truth to copy from and a
grep-able way to detect divergence. It is the deliberate answer to "a shared
stylesheet is banned but consistency still matters."

### 2.1 Type scale (child-first)

Zen Maru Gothic as the **body** face everywhere (fix Tier C's system-font body).
Bump the base and the interactive text up a notch from Tier C's current values:

| Role | Value | Line-height | Note |
|---|---|---|---|
| Prompt / question | `1.35rem` (was ~1.15) | 1.9 | roomy for furigana |
| Option text | `1.15rem` (was 1rem) | 1.6 | |
| Body / lead | `1.0rem` | 1.8 | |
| Section / mode title | `1.1rem` display | 1.4 | |
| Category chip / meta | `0.82rem` (was 0.7) | 1.5 | |
| Result score | `2.6rem` display | — | bigger, celebratory |

Furigana rule: any prompt that may carry `<ruby>` gets `line-height ≥ 1.9` and
`ruby rt { font-size: 0.5em; }` so the reading doesn't collide with the line
above. Add this to the kit even for modules that don't use ruby yet.

### 2.2 Spacing & radius (harvest from hub-shell.css:5-6)

```
--gz-space-2: 8px; --gz-space-3: 12px; --gz-space-4: 16px;
--gz-space-5: 24px; --gz-space-6: 32px;
--gz-radius-sm: 10px; --gz-radius-md: 14px; --gz-radius-lg: 16px; --gz-radius-pill: 999px;
--gz-shadow-card: 0 2px 8px rgba(28,37,48,0.08), 0 8px 24px rgba(28,37,48,0.10);
--gz-shadow-float: 0 4px 16px rgba(28,37,48,0.18);
```

Cards move from Tier C's flat `1px border, no shadow` to `border + --gz-shadow-card`
(matching Tier B `--s4-shadow` and hub `--shadow-card`).

### 2.3 Color usage

Keep the paper/moss/gold palette exactly. Standardize **roles**:

- **Moss** = primary action, correct, progress fill.
- **Gold** = reward/achievement accent only (stamp, star, streak) — never a
  default button, so it stays "special."
- **Clay** = secondary highlight / "ポイント" callouts (as `shakai4` already does,
  `shakai4/style.css:238`).
- **Error/clay-red** = wrong feedback. Never pure `#f00`.
- Surface `#fffdf8`/`#fffcf5` for cards on the `--paper` field (both already in
  use; standardize on `#fffdf8`).

### 2.4 Component patterns (paste-ready intent)

**Primary button.** `background:var(--moss); color:#fff; border-radius:12px;
padding:14px 26px; font:700 1.05rem` display; `min-height:48px`; hover
`translateY(-1px)` + `--moss-deep`; **active** `translateY(1px) scale(0.98)` (new
— tactile press for touch). Ghost/secondary keeps bordered paper style.

**Option card.** Upgrade from the flat row: `min-height:56px`, `1.15rem` text, a
leading **circular index badge** (①②③ or A/B/C) in a `28px` moss-tint circle, soft
shadow, `border-radius:12px`. States:
- default: paper surface + `--gz-shadow-card`.
- correct: moss border, `--moss-tint` fill, a **✓ glyph** fades/pops in on the
  badge.
- wrong: clay border, faint clay fill, a **✗ glyph**; the correct option
  simultaneously gets the correct treatment so the child sees the answer.
- disabled-after-answer keeps cursor default (as today).

**Progress.** Keep the existing 6–8px moss track/fill (`kanken3/style.css:46-47`,
`shakai4/style.css:295-308`) but add a small "◯問中△問目" (Q x of y) label and
animate `width` (already `transition: width` in some). Consider a tiny
gold pip that lights per completed question for a sense of accumulation.

**Feedback state.** Replace instant border-only feedback with a short (≤ 300ms),
`prefers-reduced-motion`-guarded reveal: option settles into its state + a
one-line encouraging caption ("せいかい！" / "おしい！こたえは…"). Reuse Tier B's
`.feedback.ok/.ng` panel recipe (`shakai4/style.css:338-352`) so B and C converge.

**Result / celebration screen.** This is the biggest child-UX gap. New layered
result:
- Big display score (`2.6rem`) + a **band**: 満点 → gold はなまる stamp + gentle
  star pop; 8割+ → gold ribbon "よくできました"; below → calm moss "もう一回やってみよう"
  (never punitive).
- One **restrained** celebratory motion on high scores only: a stamp scale-pop
  (`cubic-bezier(0.34,1.56,0.64,1)`, ~0.5s) — the exact easing already used in
  `hub-shell.css:87` (`gz-loader-pop`) and `nhvocab`. No confetti storm; keep it
  "calm/warm," not arcade.
- Keep the existing per-question review list, restyled as Tier B review cards.

**Motion tokens & reduced-motion.** Standardize:
```
--gz-ease-pop: cubic-bezier(0.34,1.56,0.64,1);
--gz-ease-out: cubic-bezier(0.22,1,0.36,1);
--gz-dur-fast: 140ms; --gz-dur-med: 240ms;
```
**Every** module that gains motion must add a `@media (prefers-reduced-motion:
reduce)` block that zeroes animations (pattern already in `hub-shell.css:48-50,
92-97` — copy it). This is a hard requirement of the kit, not optional.

---

## 3. Child-UX specifics

- **Touch targets:** interactive elements `min-height:48px` (buttons, option
  cards). Current Tier C options are ~44px — bump. Space adjacent tap targets ≥
  8px apart (already roughly true).
- **Font sizes:** body/questions min `1.0rem`, interactive text `1.15rem`,
  prompts `1.35rem` (section 2.1). No child-facing text below `0.82rem`.
- **Furigana:** `line-height ≥ 1.9` on any ruby-bearing line; `rt { font-size:
  0.5em }`; never `overflow:hidden` on a line that could carry ruby.
- **Contrast:** verify against WCAG AA. `--ink #1c2530` on `--paper #f7f3ea` is
  ~13:1 (excellent). Watch the light greys: `--muted #8a8570` and `--ink-soft`
  on paper for **small** text — keep muted text ≥ `0.82rem` and prefer
  `--ink-soft` over `--muted` for anything a child must read. White on `--moss`
  and white on `--gold` must be checked for buttons (white on `--gold #c9a24b`
  is marginal — use `--ink` text on gold, as `hub-shell.css:144` badge-progress
  already does).
- **Motion/feedback:** celebratory motion is opt-in-by-score, brief, and always
  `prefers-reduced-motion`-guarded. Feedback copy is encouraging and never
  punitive (おしい／もう一回, not ×/不正解).
- **Focus visibility:** add `:focus-visible { outline: 2.5px solid var(--gold);
  outline-offset: 2px }` to interactive elements (pattern from
  `hub-shell.css:30`) — helps keyboard/switch access and is currently absent in
  Tier C.
- **Language:** keep hiragana-forward child copy in elementary modules
  (`kokugo3` already does: "れんしゅう", "もういちど").

---

## 4. Phased plan & per-module effort

Effort: **S** ≈ ½ day (copy an established pattern to a sibling), **M** ≈ 1–1.5
days (build the reference implementation for a family), **L** ≈ 2+ days
(reference build + new component from scratch).

**Phase 0 — Author the kit (M).** Write `docs/design/module-ui-kit.md` (tokens +
component recipes + `GZ-KIT v1` markers + reduced-motion block). Nothing ships to
a module until this exists — it's the single source every later phase copies.

**Phase 1 — Tier C uplift (highest impact).** These are the plainest and most
used by young children.

| Module | Effort | Notes |
|---|---|---|
| `kokugo3` | **M** | Reference build for the kokugo family; Zen Maru body, new option cards, celebration result. Elementary, most child-facing. |
| `kokugo5` | **S** | Copy kokugo3 pattern. |
| `kokugo6` | **S** | Copy kokugo3 pattern. |
| `kanken5` | **M** | Reference for kanken family (4/5 skew younger; 3 is JHS-level — keep celebration lighter). Shares markup with kokugo drills. |
| `kanken4` | **S** | Copy. |
| `kanken3` | **S** | Copy; dial celebration down (older audience). |

**Phase 2 — Tier B enrichment (motion + reward).** These are already structurally
good; the work is adding the celebration/feedback/motion layer and aligning type.

| Module | Effort | Notes |
|---|---|---|
| `sansu3` | **M** | Reference build for the sansu family (it's already the code reference for `focus_units`). |
| `sansu4/5/6` | **S** each | Copy sansu3. |
| `shakai4` | **M** | Reference for shakai family (richest existing CSS — lesson cards, figures, order chips). |
| `shakai3/5/6` | **S** each | Copy shakai4. (`shakai3` also hand-rolls reporting per CLAUDE.md rule #2 — that's a separate bug, don't fold it into the visual PR.) |
| `rika4` | **M** | Reference for rika family. |
| `rika3/5/6` | **S** each | Copy rika4. |

**Phase 3 — Tier A alignment (light touch).** `eiken`, `nh6`, `nhvocab` are
already polished and even have dark mode. Only reconcile them to shared token
names/celebration copy where cheap; **S** each, or defer. `letstry1/2` (inline
CSS) are a larger extraction job — **L**, defer to a later pass.

**Phase 4 — Hub harvest (optional, S).** Fold any new kit motifs back so hub and
modules match; hub is already strong, so this is cosmetic.

**Recommended first PR:** Phase 0 + `kokugo3` (the before/after in section 5), so
reviewers see the whole direction on one real module before the S-copies fan out.
Per CLAUDE.md's headless-run guidance, each module PR must also pass the flow test
(reporting helper still called, `activity_result_items` still populated) — the
redesign must not touch the report shims.

---

## 5. Before/After — `kokugo3` (国語3年) as the worked example

**Files:** `modules/kokugo3/index.html`, `modules/kokugo3/style.css` (78 lines
today). Markup already has the right screens: `#view-select` (3 mode buttons),
`#view-quiz` (`.k3-prompt` + `.k3-options`), `#view-result` (`.k3-result-score` +
`#k3-review`) — see `index.html:27-68`. **The redesign is almost entirely CSS
plus a small result-screen markup addition; the quiz logic and report shim are
untouched.**

**BEFORE (current):**
- Body renders in system sans; only the `国語3年` title and prompt use Zen Maru
  Gothic (`style.css:21` vs `:26,43`).
- Mode buttons: flat `1.5px` bordered cards, `1.05rem` title, hover = border
  color + 1px lift (`style.css:32-38`).
- Quiz: `1.15rem` prompt, a `0.7rem` category pill, options are flat `1rem` rows
  with a `1.5px` border; correct/wrong = instant border+tint, no glyph, no
  motion (`style.css:43-51`).
- Result: a `2.2rem` number, a grey label, and a plain bordered review list — no
  reward, no illustration (`style.css:57-63`).

**AFTER (kit-applied):**
- **Type & face:** Zen Maru Gothic becomes the body font; prompt → `1.35rem`/1.9
  line-height (furigana-safe), options → `1.15rem`, category pill → `0.82rem`.
- **Mode cards:** paper surface + `--gz-shadow-card`, `14px` radius, `min-height`
  bump, `:active` press; the `k3-focus` "今週" badge (already present,
  `style.css:35-36`) restyled as a gold pill so assigned units pop.
- **Option cards:** each gets a leading ①②③ moss-tint index circle, `56px` min
  height, soft shadow. On answer, correct card grows a ✓ that pops in via
  `--gz-ease-pop`; a wrong pick shows ✗ **and** the correct card lights up, with
  a one-line "おしい！こたえは〜" caption. All motion `prefers-reduced-motion`-guarded.
- **Progress:** existing text progress (`#k3-progress`) gains a moss track/fill
  bar with a "◯問中△問目" label and gold pips that fill as questions are cleared.
- **Result:** score grows to `2.6rem`; a band computes from the score — 満点 →
  gold **はなまる** stamp with a single ~0.5s scale-pop + calm star; 8割+ → gold
  ribbon "よくできました"; lower → warm moss "もういちど やってみよう" (the existing
  もういちど button stays). The review list becomes Tier-B-style cards
  (`.review-item.ok/.ng` with ✓/✗ marks).
- **Net:** identical DOM structure and identical reporting; `style.css` grows
  from ~78 to roughly the ~380–450 range of the Tier B modules, and `kokugo3`
  now reads like `sansu3`/`shakai4` with an added, calm reward moment — turning
  the plainest child-facing drill into the visual reference for the family.
